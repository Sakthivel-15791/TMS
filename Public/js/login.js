document.getElementById('loginForm').addEventListener('submit', async (event) => {
	event.preventDefault();
	const error = document.getElementById('loginError');
	const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value }) });
	const data = await response.json();
	if (!response.ok) { error.textContent = data.message; error.classList.remove('d-none'); return; }
	localStorage.setItem('officeDeskToken', data.token); localStorage.setItem('officeDeskUser', JSON.stringify(data.user)); location.href = '/dashboard.html';
});
