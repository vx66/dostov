import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../store.js';
test('Ciclo de vida: fechas automáticas, reapertura y cancelación validada', () => {
  const store = createStore(':memory:');
  try {
    const task = store.save({ title: 'Mi tarea', description: 'Detalles', createdAt: 'fake' });
    const nextTask = store.save({ title: 'Otra tarea' });
    assert.notEqual(task.color, nextTask.color);
    assert.equal(task.status, 'pending'); assert.ok(!Number.isNaN(Date.parse(task.createdAt)));
    const done = store.save({ ...task, status: 'done', completedAt: 'fake' }, task.id);
    assert.ok(!Number.isNaN(Date.parse(done.completedAt))); assert.equal(done.createdAt, task.createdAt);
    assert.equal(done.color, task.color);
    assert.equal(store.save({ ...done, title: 'Editada' }, task.id).completedAt, done.completedAt);
    assert.equal(store.save({ ...done, status: 'progress' }, task.id).completedAt, null);
    assert.throws(() => store.save({ ...task, status: 'cancelled', cancellationReason: '  ' }, task.id));
    const cancelled = store.save({ ...task, status: 'cancelled', cancellationReason: 'Cambio de prioridad' }, task.id);
    assert.equal(cancelled.cancellationReason, 'Cambio de prioridad'); assert.equal(cancelled.completedAt, null);
    assert.equal(store.save({ ...cancelled, status: 'pending' }, task.id).cancellationReason, '');
    assert.throws(() => store.save({ title: '  ' }));
    assert.throws(() => store.save({ title: 'a', status: 'invalid' }));
    assert.throws(() => store.save({ title: 'a' }, 'missing'), { status: 404 });
  } finally { store.close(); }
});
test('Las tareas persisten después de cerrar la base de datos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dostov-test-'));
  try {
    const path = join(dir, 'db.sqlite'); const first = createStore(path);
    const task = first.save({ title: 'Persistente' }); first.close();
    const second = createStore(path); assert.equal(second.list()[0].id, task.id); assert.equal(second.list()[0].color, task.color); second.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
