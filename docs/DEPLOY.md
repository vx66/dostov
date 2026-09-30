# Desplegar Dostov

## 1. GitHub

Crea un repositorio vacío llamado `dostov` en tu cuenta de GitHub (sin README, licencia ni .gitignore generados). Luego, en PowerShell, reemplaza `TU_USUARIO_GITHUB` por tu cuenta:

```powershell
cd C:\Users\maufi\Documents\ChatGPT\dostov
git add .
git diff --cached --stat
git commit -m "Preparar Dostov para Docker y Dokploy"
git branch -M main
git remote add origin https://github.com/TU_USUARIO_GITHUB/dostov.git
git push -u origin main
```

No hay un remoto configurado actualmente. Si ya agregaste `origin`, utiliza `git remote set-url origin https://github.com/TU_USUARIO_GITHUB/dostov.git` en lugar de `git remote add`.

`.env` y `data/` quedan fuera de Git y del contexto Docker. Las plantillas `.env.example` y `.env.production.example` sí se suben: contienen el usuario `xergno` y una contraseña vacía. No uses `git add -f .env`.

## 2. Dokploy: Application con Dockerfile

1. Crea un proyecto y dentro un servicio de tipo **Application** llamado `dostov`.
2. En **General / Provider**, conecta GitHub y selecciona tu repositorio `dostov`, rama `main`. Si el repositorio es privado, da acceso a la integración GitHub de Dokploy.
3. Selecciona **Dockerfile** como tipo de construcción: archivo `Dockerfile`, contexto `.` (raíz del repositorio); deja la etapa de construcción vacía. No requiere comandos npm de instalación ni compilación.
4. En **Environment**, pega el siguiente bloque y completa `APP_PASSWORD` con tu contraseña. Guarda los cambios. No hace falta crear un archivo `.env` dentro del contenedor.

```dotenv
APP_USER=xergno
APP_PASSWORD=
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATA_DIR=/app/data
```

La contraseña vacía es intencional en esta guía: debes completarla en Dokploy. El servidor no arranca sin ella.

5. En **Advanced / Mounts**, crea un montaje de tipo **Volume**, con nombre `dostov-data` y ruta de montaje `/app/data`. Debe ser un volumen Docker, no un montaje del código fuente. El proceso utiliza el usuario `node` (UID 1000); el Dockerfile prepara el directorio con sus permisos.
6. Usa **una sola réplica**. En un clúster, fija la aplicación al nodo que contiene el volumen, ya que SQLite y el volumen son locales a ese nodo.
7. En **Domains**, agrega tu dominio o subdominio, ruta `/`, puerto interno **3000**, HTTPS activado y certificado Let's Encrypt. Apunta antes el registro DNS del dominio a la IP de tu servidor. No necesitas publicar el puerto 3000 en el host: Dokploy enruta el tráfico al contenedor.
8. Guarda y pulsa **Deploy**. Comprueba los logs y abre `https://TU_DOMINIO/health`: debe responder `{"ok":true}`. Abre después `https://TU_DOMINIO` e inicia sesión con `xergno` y la contraseña configurada.

HTTPS es necesario para la cookie de sesión en producción. Cambiar credenciales o reiniciar el contenedor cierra las sesiones activas. El tablero inicial estará vacío: las tareas locales no se suben a GitHub.

## Datos y actualizaciones

Conserva siempre el volumen `/app/data`. Para respaldarlo de forma consistente, detén la aplicación y copia el contenido completo del volumen. Si transfieres tareas locales, copia el directorio de datos con ambas aplicaciones detenidas y asigna permisos al UID 1000 en el destino.

Para publicar cambios futuros:

```powershell
git add .
git commit -m "Actualizar Dostov"
git push
```

Después pulsa Deploy en Dokploy, o configura Auto Deploy si lo deseas. El volumen conserva las tareas entre despliegues.

## Docker Compose opcional

`compose.yaml` también permite desplegar con un servicio de tipo **Docker Compose** en Dokploy. Configura **Compose Path** como `./compose.yaml`. En Environment define `APP_USER=xergno` y completa `APP_PASSWORD`. En Domains selecciona el servicio `dostov`, puerto interno `3000`, ruta `/` y HTTPS. Guarda y despliega.

Compose expone el puerto 3000 únicamente en la red Docker, sin reservar un puerto del servidor. Dokploy enruta el dominio hacia ese puerto interno. No agregues un mapeo `3000:3000` en Ports ni en el archivo Compose. El volumen `dostov-data` ya está declarado y montado en `/app/data`.

## Referencias

- [Aplicaciones en Dokploy](https://docs.dokploy.com/docs/core/applications)
- [Dominios en Dokploy](https://docs.dokploy.com/docs/core/domains)
