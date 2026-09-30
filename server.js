import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { createStore } from './store.js';
const port = Number(process.env.PORT || 3000);
const dir = resolve(process.env.DATA_DIR || 'data');
const user = process.env.APP_USER, password = process.env.APP_PASSWORD;
if (!user || !password) throw new Error('Configura APP_USER y APP_PASSWORD en .env o en el entorno.');
mkdirSync(dir, { recursive: true });
const store = createStore(resolve(dir, 'dostov.sqlite'));
const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64);
const sessions = new Map();
const attempts = new Map();
const sessionLifetime = 12 * 60 * 60 * 1000;
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const cookie = (token, age) => `dostov_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookie}`;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sessions) if (value <= now) sessions.delete(key);
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
}, 60000).unref();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health' && req.method === 'GET') return send(200, { ok: true });
    const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('dostov_session='))?.slice(15);
    const authenticated = token && sessions.get(token) > Date.now();
    let input;
    if (['POST', 'PUT'].includes(req.method)) {
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) return send(403, { error: 'Origen no permitido.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Se requiere JSON.' });
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 32000) return send(413, { error: 'Contenido demasiado grande.' }); }
      try { input = JSON.parse(body); } catch { return send(400, { error: 'JSON inválido.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return send(400, { error: 'Contenido inválido.' });
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const key = req.socket.remoteAddress;
      const now = Date.now();
      const attempt = attempts.get(key);
      if (attempt?.expires > now && attempt.count >= 10) return send(429, { error: 'Demasiados intentos. Espera 15 minutos antes de intentar nuevamente.' });
      const validPassword = typeof input.password === 'string' && input.password.length <= 1000 && timingSafeEqual(scryptSync(input.password, salt, 64), passwordHash);
      if (input.username !== user || !validPassword) {
        attempts.set(key, { count: attempt?.expires > now ? attempt.count + 1 : 1, expires: attempt?.expires > now ? attempt.expires : now + 15 * 60000 });
        return send(401, { error: 'Usuario o contraseña incorrectos.' });
      }
      attempts.delete(key);
      if (token) sessions.delete(token);
      const session = randomBytes(32).toString('hex');
      sessions.set(session, now + sessionLifetime);
      res.setHeader('Set-Cookie', cookie(session, sessionLifetime / 1000));
      return send(200, { ok: true });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      if (token) sessions.delete(token);
      res.setHeader('Set-Cookie', cookie('', 0));
      return send(200, { ok: true });
    }
    const publicAssets = ['/login', '/login.js', '/style.css', '/fonts/archivo.woff2', '/fonts/mono.woff2'];
    if (!authenticated && !publicAssets.includes(url.pathname)) {
      if (url.pathname.startsWith('/api/')) return send(401, { error: 'Inicia sesión para continuar.' });
      res.writeHead(302, { Location: '/login' }); return res.end();
    }
    if (authenticated && url.pathname === '/login') {
      res.writeHead(302, { Location: '/' }); return res.end();
    }
    if (url.pathname === '/api/tasks' && req.method === 'GET') return send(200, store.list());
    if (req.method === 'DELETE') {
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) return send(403, { error: 'Origen no permitido.' });
      const match = url.pathname.match(/^\/api\/tasks\/([a-z0-9-]+)$/);
      if (!match) return send(404, { error: 'Ruta no encontrada.' });
      store.delete(match[1]);
      return send(200, { ok: true });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) return send(403, { error: 'Origen no permitido.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Se requiere JSON.' });
      const match = url.pathname.match(/^\/api\/tasks\/([a-z0-9-]+)$/);
      if (!(req.method === 'POST' && url.pathname === '/api/tasks') && !(req.method === 'PUT' && match)) return send(404, { error: 'Ruta no encontrada.' });
      return send(req.method === 'POST' ? 201 : 200, store.save(input, match?.[1]));
    }
    if (req.method !== 'GET') return send(405, { error: 'Método no permitido.' });
    const assets = { '/login': 'login.html', '/login.js': 'login.js', '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/fonts/archivo.woff2': 'fonts/archivo.woff2', '/fonts/mono.woff2': 'fonts/mono.woff2' };
    const file = assets[url.pathname];
    if (!file) return send(404, { error: 'No encontrado.' });
    res.writeHead(200, { 'Content-Type': mime[extname(file)] }); res.end(readFileSync(resolve('public', file)));
  } catch (error) { console.error(error); send(error.status || 500, { error: error.status ? error.message : 'No se pudo guardar. Intenta nuevamente.' }); }
});
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Dostov disponible en http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
