const form = document.getElementById('login-form');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('login-submit');
  const error = document.getElementById('login-error');
  button.disabled = true; error.textContent = '';
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.username.value.trim(), password: form.password.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    window.location.replace('/');
  } catch (e) { error.textContent = e.message || 'No se pudo conectar. Intenta nuevamente.'; }
  finally { button.disabled = false; }
});
