import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export const statuses = ['pending', 'progress', 'done', 'cancelled'];
export function createStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    status TEXT NOT NULL, createdAt TEXT NOT NULL, completedAt TEXT, cancellationReason TEXT NOT NULL
  )`);
  if (!db.prepare('PRAGMA table_info(tasks)').all().some(column => column.name === 'color')) {
    db.exec('ALTER TABLE tasks ADD COLUMN color INTEGER NOT NULL DEFAULT 0');
    const existing = db.prepare('SELECT id FROM tasks ORDER BY createdAt, id').all();
    const updateColor = db.prepare('UPDATE tasks SET color=? WHERE id=?');
    existing.forEach((task, index) => updateColor.run(index % 12, task.id));
  }
  return {
    list: () => db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC, id').all(),
    save(input, id) {
      const old = id ? db.prepare('SELECT * FROM tasks WHERE id=?').get(id) : null;
      if (id && !old) throw Object.assign(new Error('La tarea ya no existe.'), { status: 404 });
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      const status = input.status ?? 'pending';
      const reason = typeof input.cancellationReason === 'string' ? input.cancellationReason.trim() : '';
      if (!title || title.length > 160 || description.length > 5000 || !statuses.includes(status) || reason.length > 2000 || (status === 'cancelled' && !reason)) {
        throw Object.assign(new Error('Revisa el título, el estado y el motivo de cancelación.'), { status: 400 });
      }
      const task = { id: old?.id ?? randomUUID(), title, description, status,
        createdAt: old?.createdAt ?? new Date().toISOString(),
        completedAt: status === 'done' ? (old?.completedAt ?? new Date().toISOString()) : null,
        cancellationReason: status === 'cancelled' ? reason : '',
        color: old?.color ?? (db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count % 12) };
      db.prepare(`INSERT INTO tasks (id,title,description,status,createdAt,completedAt,cancellationReason,color) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, status=excluded.status,
        completedAt=excluded.completedAt, cancellationReason=excluded.cancellationReason`).run(...Object.values(task));
      return task;
    },
    delete(id) {
      const result = db.prepare('DELETE FROM tasks WHERE id=?').run(id);
      if (!result.changes) throw Object.assign(new Error('La tarea ya no existe.'), { status: 404 });
    },
    close: () => db.close()
  };
}
