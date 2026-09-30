const $ = id => document.getElementById(id);
const states = [ ['pending', 'Pendientes', 'Por aquí empieza todo.', '01'], ['progress', 'En proceso', 'Dale espacio a tu siguiente paso.', '02'], ['done', 'Finalizado', 'Lo que terminas vive aquí.', '03'], ['cancelled', 'Cancelado', 'También está bien cambiar de rumbo.', '04'] ];
let tasks = [], loaded = false, saving = false, toastTimer;
const date = value => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
$('today').textContent = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();
async function api(path, options) {
  const response = await fetch(path, options);
  if (response.status === 401) { window.location.replace('/login'); throw new Error('La sesión terminó. Inicia sesión nuevamente.'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase('es');
  const filtered = tasks.filter(t => `${t.title} ${t.description} ${t.cancellationReason}`.toLocaleLowerCase('es').includes(query));
  const done = tasks.filter(t => t.status === 'done').length;
  const eligible = tasks.filter(t => t.status !== 'cancelled').length;
  const percent = eligible ? Math.round(done / eligible * 100) : 0;
  $('total').textContent = tasks.length.toString().padStart(2, '0');
  $('active').textContent = tasks.filter(t => ['pending', 'progress'].includes(t.status)).length.toString().padStart(2, '0');
  $('finished').textContent = done.toString().padStart(2, '0');
  $('percent').textContent = `${percent}%`;
  $('completion').value = percent;
  $('completion').textContent = `${percent}%`;
  $('visible-count').textContent = query ? `${filtered.length} RESULTADOS` : 'VISTA GENERAL';
  $('board').innerHTML = states.map(([status, label, empty, number]) => {
    const items = filtered.filter(t => t.status === status);
    return `<section class="column ${status}" data-status="${status}" aria-label="${label}"><div class="column-head"><h2><i></i>${label}<span>${items.length}</span></h2><button class="add" data-add="${status}" aria-label="Añadir tarea en ${label}">+</button></div><div class="cards">${items.map(t => `<button class="card color-${Number.isInteger(t.color) ? t.color % 12 : 0}" draggable="true" data-id="${t.id}"><div class="card-top"><span>${status === 'done' ? '✓ COMPLETADA' : status === 'cancelled' ? '× CANCELADA' : 'TAREA'}</span><span>↗</span></div><h3>${escape(t.title)}</h3>${t.description ? `<p>${escape(t.description)}</p>` : ''}${t.cancellationReason ? `<div class="cancel-reason">MOTIVO<span>${escape(t.cancellationReason)}</span></div>` : ''}<div class="card-date"><span>CREADA ${date(t.createdAt)}</span>${t.completedAt ? `<span>FIN ${date(t.completedAt)}</span>` : ''}</div></button>`).join('')}${!items.length ? `<div class="empty"><span class="empty-symbol">${status === 'done' ? '✓' : status === 'cancelled' ? '↗' : '+'}</span><h3>${query ? 'Sin coincidencias' : 'Espacio para lo que viene'}</h3><p>${query ? 'Prueba con otra búsqueda.' : empty}</p></div>` : ''}</div><button class="column-add" data-add="${status}">+ AÑADIR TAREA</button><div class="column-index">/ ${number}</div></section>`;
  }).join('');
  document.querySelectorAll('[data-id]').forEach(card => {
    card.onclick = () => openEditor(tasks.find(t => t.id === card.dataset.id));
    card.ondragstart = event => { event.dataTransfer.setData('text/plain', card.dataset.id); event.dataTransfer.effectAllowed = 'move'; };
  });
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => openEditor(null, button.dataset.add));
  document.querySelectorAll('.column').forEach(column => {
    column.ondragover = event => { event.preventDefault(); column.classList.add('dragover'); };
    column.ondragleave = event => { if (!column.contains(event.relatedTarget)) column.classList.remove('dragover'); };
    column.ondrop = async event => {
      event.preventDefault(); column.classList.remove('dragover');
      const task = tasks.find(t => t.id === event.dataTransfer.getData('text/plain'));
      if (!task || task.status === column.dataset.status || saving) return;
      if (column.dataset.status === 'cancelled') return openEditor(task, 'cancelled');
      try { await persist({ ...task, status: column.dataset.status }); } catch (e) { toast(e.message); }
    };
  });
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
function reasonVisibility() { const cancelled = $('status').value === 'cancelled'; $('reason-field').hidden = !cancelled; $('reason').required = cancelled; }
function openEditor(task, status) {
  if (!loaded) return toast('Espera a que se cargue el tablero.');
  $('task-form').reset(); $('task-id').value = task?.id || ''; $('title').value = task?.title || '';
  $('delete-task').hidden = !task;
  $('description').value = task?.description || ''; $('status').value = status || task?.status || 'pending'; $('reason').value = task?.cancellationReason || '';
  $('modal-label').textContent = task ? 'DETALLE DE TAREA' : 'NUEVA TAREA'; $('modal-title').textContent = task ? 'Cada paso cuenta.' : 'Un nuevo comienzo.';
  $('dates').textContent = task ? `Creada el ${date(task.createdAt)}${task.completedAt ? ` · Finalizada el ${date(task.completedAt)}` : ''}` : 'La fecha de creación se registra automáticamente.';
  $('form-error').textContent = ''; reasonVisibility(); $('editor').showModal(); $('title').focus();
}
async function persist(task) {
  saving = true; $('save').disabled = true;
  try {
    const saved = await api(task.id ? `/api/tasks/${task.id}` : '/api/tasks', { method: task.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) });
    tasks = [saved, ...tasks.filter(t => t.id !== saved.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); render(); toast('Tarea guardada. Un paso más.');
  } finally { saving = false; $('save').disabled = false; }
}
$('task-form').onsubmit = async event => {
  event.preventDefault(); if (saving) return;
  try { await persist({ id: $('task-id').value, title: $('title').value, description: $('description').value, status: $('status').value, cancellationReason: $('reason').value }); $('editor').close(); }
  catch (error) { $('form-error').textContent = error.message; }
};
$('status').onchange = reasonVisibility;
const deleteButton = document.createElement('button');
deleteButton.id = 'delete-task'; deleteButton.type = 'button'; deleteButton.textContent = 'ELIMINAR TAREA'; deleteButton.hidden = true;
document.querySelector('.modal-actions').prepend(deleteButton);
deleteButton.onclick = async () => {
  const id = $('task-id').value;
  if (saving || !id) return;
  const task = tasks.find(task => task.id === id);
  $('delete-title').textContent = task?.title || 'Esta tarea';
  $('delete-error').textContent = '';
  $('delete-confirmation').showModal();
  $('cancel-delete').focus();
};
$('cancel-delete').onclick = () => { if (!saving) $('delete-confirmation').close(); };
$('delete-confirmation').addEventListener('cancel', event => { if (saving) event.preventDefault(); });
$('confirm-delete').onclick = async () => {
  const id = $('task-id').value;
  if (saving || !id) return;
  saving = true; deleteButton.disabled = true; $('save').disabled = true;
  $('confirm-delete').disabled = true; $('cancel-delete').disabled = true;
  try {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(task => task.id !== id);
    render(); $('delete-confirmation').close(); $('editor').close(); toast('Tarea eliminada.');
  } catch (error) { $('delete-error').textContent = error.message; }
  finally { saving = false; deleteButton.disabled = false; $('save').disabled = false; $('confirm-delete').disabled = false; $('cancel-delete').disabled = false; }
};
$('close').onclick = $('discard').onclick = () => { if (!saving) $('editor').close(); };
$('editor').addEventListener('cancel', event => { if (saving) event.preventDefault(); });
$('new-task').onclick = () => openEditor(); $('search').oninput = render;
async function load() {
  $('new-task').disabled = true;
  try { tasks = await api('/api/tasks'); loaded = true; $('load-error').hidden = true; render(); }
  catch { $('load-error').hidden = false; }
  finally { $('board').setAttribute('aria-busy', 'false'); $('new-task').disabled = !loaded; }
}
$('retry').onclick = load;
load();
const logout = document.createElement('button');
logout.className = 'logout'; logout.textContent = 'CERRAR SESIÓN ↗';
logout.onclick = async () => {
  logout.disabled = true;
  try { await api('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); window.location.replace('/login'); }
  catch (error) { toast(error.message); logout.disabled = false; }
};
document.querySelector('header .online').replaceWith(logout);
