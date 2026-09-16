(() => {
  const path = window.location.pathname.toLowerCase();
  const root = path.split('/').filter(Boolean).pop() || 'index.html';
  const currentUser = JSON.parse(localStorage.getItem('officeDeskUser') || '{}');
  const menu = [
    { label: 'Dashboard', icon: 'bi-grid-1x2', href: '/dashboard.html', key: 'dashboard' },
    { label: 'Employees', icon: 'bi-people', href: '/employee/emp.html', key: 'employees' },
    { label: 'Products', icon: 'bi-box-seam', href: '#', key: 'products' },
    { label: 'Customer', icon: 'bi-person-vcard', href: '#', key: 'customers' },
    { label: 'Invoice', icon: 'bi-receipt', href: '#', key: 'invoices' },
    { label: 'Expense', icon: 'bi-wallet2', href: '#', key: 'expenses' },
    { label: 'Assets', icon: 'bi-hdd-stack', href: '/assets.html', key: 'assets' },
    { label: 'My Tickets', icon: 'bi-ticket-perforated', href: '/tickets/ticket.html', key: 'tickets' },
    { label: 'My Department Tickets', icon: 'bi-diagram-3', href: '/tickets/department.html', key: 'department-tickets' },
    { label: 'Ticket Dashboard', icon: 'bi-bar-chart-line', href: '/dashboard.html', key: 'ticket-dashboard' },
    { label: 'Manage Tickets', icon: 'bi-kanban', href: '/tickets/manage.html', key: 'manage-tickets' },
    { label: 'Reports', icon: 'bi-file-earmark-bar-graph', href: '#', key: 'reports' },
    { label: 'Settings', icon: 'bi-sliders', href: '#', key: 'settings' }
  ];
  const settings = [
    { label: 'Company', icon: 'bi-building', href: '#company', key: 'company' },
    { label: 'Meta Data', icon: 'bi-database', href: '#metadata', key: 'metadata' },
    { label: 'Roles', icon: 'bi-person-badge', href: '/settings.html#roles', key: 'roles' },
    { label: 'Users', icon: 'bi-person-gear', href: '/settings.html#users', key: 'users' }
  ];

  const link = item => `<a class="sidebar-link" href="${item.href}" data-nav-key="${item.key || ''}" title="${item.label}"><i class="bi ${item.icon}"></i><span>${item.label}</span></a>`;
  const settingsLinks = settings.map(link).join('');
  const navigation = menu.map(item => link(item)).join('');
  const shell = document.createElement('aside');
  shell.className = 'app-sidebar';
  shell.id = 'appSidebar';
  shell.innerHTML = `<div class="sidebar-brand"><a href="/dashboard.html"><span class="brand-mark">O</span><span class="sidebar-label">Office Desk</span></a></div>
    <div class="sidebar-scroll"><div class="sidebar-section"><span class="sidebar-section-title">Workspace</span>${navigation}</div>
    <div class="sidebar-section settings-section"><span class="sidebar-section-title">System Settings</span>${settingsLinks}</div></div>
    <div class="sidebar-footer"><div class="sidebar-user"><span class="sidebar-avatar">${(currentUser.employee_name || currentUser.username || 'U')[0].toUpperCase()}</span><span class="sidebar-label"><strong>${currentUser.employee_name || currentUser.username || 'Guest'}</strong><small>${currentUser.role || 'Workspace user'}</small></span></div><button class="sidebar-link sidebar-logout" id="sidebarLogout" title="Logout"><i class="bi bi-box-arrow-right"></i><span>Logout</span></button></div>`;
  document.body.prepend(shell);

  const toggle = document.createElement('button');
  toggle.className = 'sidebar-toggle';
  toggle.id = 'sidebarToggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Expand sidebar');
  toggle.innerHTML = '<i class="bi bi-chevron-right"></i>';
  document.body.append(toggle);
  document.body.classList.add('has-sidebar', 'sidebar-collapsed');

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/style/sidebar.css';
  document.head.append(style);
  const icons = document.createElement('link');
  icons.rel = 'stylesheet';
  icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css';
  document.head.append(icons);

  toggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    document.body.classList.toggle('sidebar-expanded', !collapsed);
    toggle.innerHTML = `<i class="bi bi-chevron-${collapsed ? 'right' : 'left'}"></i>`;
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  });

  const activeKey = path.includes('settings') ? (window.location.hash.includes('users') ? 'users' : 'roles') : path.includes('dashboard') ? 'dashboard' : path.includes('employee') ? 'employees' : path.includes('ticket') ? 'tickets' : '';
  shell.querySelectorAll('[data-nav-key]').forEach(item => {
    if (item.dataset.navKey === activeKey) item.classList.add('active');
  });
  if (currentUser.role_id) {
    fetch(`/api/access/roles/${currentUser.role_id}/pages`, { headers: { Authorization: `Bearer ${localStorage.getItem('officeDeskToken')}` } })
      .then(response => response.ok ? response.json() : [])
      .then(async selectedIds => {
        const pages = await fetch('/api/access/pages', { headers: { Authorization: `Bearer ${localStorage.getItem('officeDeskToken')}` } }).then(response => response.ok ? response.json() : []);
        const allowed = new Set(pages.filter(page => selectedIds.includes(page.id)).map(page => page.page_key));
        shell.querySelectorAll('[data-nav-key]').forEach(item => { if (!allowed.has(item.dataset.navKey)) item.remove(); });
      }).catch(() => {});
  }
  document.getElementById('sidebarLogout').addEventListener('click', async () => {
    const token = localStorage.getItem('officeDeskToken');
    if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    localStorage.clear();
    window.location.href = '/login.html';
  });
})();
