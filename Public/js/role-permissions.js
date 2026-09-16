const permissionToken = localStorage.getItem('officeDeskToken');
if (!permissionToken) location.href = '/login.html';
const permissionApi = async (url, options = {}) => { const response = await fetch(`/api/access${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${permissionToken}`, ...(options.headers || {}) } }); if (response.status === 401) location.href = '/login.html'; const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Request failed'); return data; };
const roleId = new URLSearchParams(location.search).get('role');
if (!roleId) location.href = '/settings.html#roles';
(async () => {
  try {
    const [roles, pages, selected] = await Promise.all([permissionApi('/roles'), permissionApi('/pages'), permissionApi(`/roles/${roleId}/pages`)]);
    const role = roles.find(item => item.id === Number(roleId));
    document.getElementById('permissionRoleName').textContent = `${role ? role.role_name : 'Role'} permissions`;
    const groups = pages.reduce((result, page) => { (result[page.page_group] ||= []).push(page); return result; }, {});
    document.getElementById('pageGroups').innerHTML = Object.entries(groups).map(([group, items]) => `<div class="col-md-6 col-xl-4"><div class="border rounded p-3 h-100"><h6>${group}</h6>${items.map(page => `<label class="d-flex align-items-center gap-2 py-2"><input class="form-check-input page-check" type="checkbox" value="${page.id}" ${selected.includes(page.id) ? 'checked' : ''}><span>${page.page_name}</span></label>`).join('')}</div></div>`).join('');
    document.getElementById('savePermissions').addEventListener('click', async () => { const page_ids = [...document.querySelectorAll('.page-check:checked')].map(input => Number(input.value)); await permissionApi(`/roles/${roleId}/pages`, { method: 'PUT', body: JSON.stringify({ page_ids }) }); window.alert('Role permissions saved.'); });
  } catch (error) { window.alert(error.message); }
})();
