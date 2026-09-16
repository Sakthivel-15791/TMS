const employeeToken = localStorage.getItem('officeDeskToken');
if (!employeeToken) location.href = '/login.html';
const employeeApi = async (url, options = {}) => {
  const response = await fetch(`/api/employees${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${employeeToken}`, ...(options.headers || {}) } });
  if (response.status === 401) location.href = '/login.html';
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};
let employeePage = 1;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));

async function loadFilters() {
  const [departments, designations] = await Promise.all([employeeApi('/departments'), employeeApi('/designations')]);
  document.getElementById('departmentFilter').insertAdjacentHTML('beforeend', departments.map(item => `<option value="${item.id}">${escapeHtml(item.department_name)}</option>`).join(''));
  document.getElementById('designationFilter').insertAdjacentHTML('beforeend', designations.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join(''));
}

async function loadEmployees() {
  const params = new URLSearchParams({ page: employeePage, search: document.getElementById('employeeSearch').value, designation: document.getElementById('designationFilter').value, department_id: document.getElementById('departmentFilter').value });
  const data = await employeeApi(`/?${params}`);
  const rows = data.rows;
  document.getElementById('employeeRows').innerHTML = rows.map(employee => `<tr><td class="fw-semibold">${escapeHtml(employee.employee_code)}</td><td><div class="d-flex align-items-center gap-2">${employee.image_url ? `<img class="employee-thumb" src="${escapeHtml(employee.image_url)}" alt="">` : `<span class="avatar">${escapeHtml(employee.name[0])}</span>`}<span>${escapeHtml(employee.name)}<small class="d-block text-secondary">${escapeHtml(employee.email)}</small></span></div></td><td>${escapeHtml(employee.designation || '-')}</td><td>${escapeHtml(employee.department_name || '-')}</td><td class="text-end"><a class="btn btn-sm btn-outline-secondary" href="/employee/details.html?id=${employee.id}">Edit</a> <button class="btn btn-sm btn-outline-danger deactivate-employee" data-id="${employee.id}">Deactivate</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-secondary py-5">No employees found</td></tr>';
  const start = data.pagination.total ? (data.pagination.page - 1) * data.pagination.limit + 1 : 0;
  const end = Math.min(data.pagination.page * data.pagination.limit, data.pagination.total);
  document.getElementById('employeeSummary').textContent = `Showing ${start}-${end} of ${data.pagination.total} employees`;
  renderPagination(data.pagination.pages);
  document.querySelectorAll('.deactivate-employee').forEach(button => button.addEventListener('click', async () => { if (window.confirm('Deactivate this employee?')) { await employeeApi(`/${button.dataset.id}`, { method: 'DELETE' }); loadEmployees(); } }));
}

function renderPagination(totalPages) {
  document.getElementById('employeePagination').innerHTML = Array.from({ length: totalPages }, (_, index) => index + 1).map(page => `<li class="page-item ${page === employeePage ? 'active' : ''}"><button class="page-link" data-page="${page}">${page}</button></li>`).join('');
  document.querySelectorAll('#employeePagination button').forEach(button => button.addEventListener('click', () => { employeePage = Number(button.dataset.page); loadEmployees(); }));
}

document.getElementById('employeeSearch').addEventListener('input', () => { employeePage = 1; loadEmployees(); });
document.getElementById('designationFilter').addEventListener('change', () => { employeePage = 1; loadEmployees(); });
document.getElementById('departmentFilter').addEventListener('change', () => { employeePage = 1; loadEmployees(); });
document.getElementById('clearFilters').addEventListener('click', () => { document.getElementById('employeeSearch').value = ''; document.getElementById('designationFilter').value = ''; document.getElementById('departmentFilter').value = ''; employeePage = 1; loadEmployees(); });
(async () => { try { await loadFilters(); await loadEmployees(); } catch (error) { window.alert(error.message); } })();
