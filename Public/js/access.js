const accessToken = localStorage.getItem('officeDeskToken');
if (!accessToken) location.href = '/login.html';
const accessApi = async (url, options = {}) => {
  const response = await fetch(`/api/access${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
  if (response.status === 401) location.href = '/login.html';
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};
let roles = [];
let editingRoleId = null;
let users = [];
let editingUserId = null;
const roleModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('roleModal'));
const userModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal'));
const showError = error => window.alert(error.message);

async function loadRoles() {
  roles = await accessApi('/roles');
  document.getElementById('roleRows').innerHTML = roles.map(role => `<tr><td class="fw-semibold">${role.role_name}</td><td>${role.user_count}</td><td>${role.page_count}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary edit-role" data-id="${role.id}">Edit</button> <a class="btn btn-sm btn-outline-primary" href="/role-permissions.html?role=${role.id}">Manage roles</a></td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-secondary py-5">No roles found</td></tr>';
  document.querySelectorAll('.edit-role').forEach(button => button.addEventListener('click', () => { const role = roles.find(item => item.id === Number(button.dataset.id)); editingRoleId = role.id; document.getElementById('roleModalTitle').textContent = 'Edit role'; document.getElementById('roleName').value = role.role_name; roleModal().show(); }));
}
async function loadUsers() {
  users = await accessApi('/users');
  document.getElementById('userRows').innerHTML = users.map(user => `<tr><td class="fw-semibold">${user.username}</td><td>${user.employee_name || '-'}</td><td>${user.role}</td><td><span class="badge badge-${user.status.toLowerCase()}">${user.status}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-secondary edit-user" data-id="${user.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-secondary py-5">No users found</td></tr>';
  document.querySelectorAll('.edit-user').forEach(button => button.addEventListener('click', () => { const user = users.find(item => item.id === Number(button.dataset.id)); editingUserId = user.id; document.getElementById('userModalTitle').textContent = 'Edit user'; document.getElementById('userNameInput').value = user.username; document.getElementById('userPassword').required = false; document.getElementById('userPassword').placeholder = 'Leave blank to keep current password'; document.getElementById('userRole').value = user.role_id; document.getElementById('userStatus').value = user.status; userModal().show(); }));
}
async function loadRoleOptions() { document.getElementById('userRole').innerHTML = roles.map(role => `<option value="${role.id}">${role.role_name}</option>`).join(''); }
document.querySelectorAll('#accessTabs button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('#accessTabs button').forEach(item => item.classList.remove('active')); button.classList.add('active'); document.getElementById('rolesView').classList.toggle('d-none', button.dataset.view !== 'roles'); document.getElementById('usersView').classList.toggle('d-none', button.dataset.view !== 'users'); if (button.dataset.view === 'users') loadUsers(); }));
document.getElementById('addRoleButton').addEventListener('click', () => { editingRoleId = null; document.getElementById('roleModalTitle').textContent = 'Add role'; document.getElementById('roleForm').reset(); });
document.getElementById('roleForm').addEventListener('submit', async event => { event.preventDefault(); try { const body = JSON.stringify({ role_name: document.getElementById('roleName').value }); await accessApi(editingRoleId ? `/roles/${editingRoleId}` : '/roles', { method: editingRoleId ? 'PUT' : 'POST', body }); roleModal().hide(); await loadRoles(); await loadRoleOptions(); } catch (error) { showError(error); } });
document.getElementById('addUserButton').addEventListener('click', () => { editingUserId = null; document.getElementById('userModalTitle').textContent = 'Add user'; document.getElementById('userForm').reset(); document.getElementById('userPassword').required = true; document.getElementById('userPassword').placeholder = ''; });
document.getElementById('userForm').addEventListener('submit', async event => { event.preventDefault(); try { const body = { username: document.getElementById('userNameInput').value, password: document.getElementById('userPassword').value, role_id: Number(document.getElementById('userRole').value), status: document.getElementById('userStatus').value }; if (editingUserId && !body.password) delete body.password; await accessApi(editingUserId ? `/users/${editingUserId}` : '/users', { method: editingUserId ? 'PUT' : 'POST', body: JSON.stringify(body) }); userModal().hide(); await loadUsers(); } catch (error) { showError(error); } });
(async () => { try { await loadRoles(); await loadRoleOptions(); } catch (error) { showError(error); } })();
