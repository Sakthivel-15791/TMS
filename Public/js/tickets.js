const ticketToken = localStorage.getItem('officeDeskToken');
if (!ticketToken) location.href = '/login.html';
const ticketApi = async (url, options = {}) => { const response = await fetch(`/api/tickets${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ticketToken}`, ...(options.headers || {}) } }); if (response.status === 401) location.href = '/login.html'; const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Request failed'); return data; };
const ticketBadge = value => `<span class="badge badge-${String(value).toLowerCase().replace('_', '-')}\">${String(value).replace('_', ' ')}</span>`;
const ticketDate = value => value ? new Date(value).toLocaleString() : '-';
async function loadTickets() {
  const data = await ticketApi(`?search=${encodeURIComponent(document.getElementById('ticketSearch').value)}`);
    document.getElementById('ticketRows').innerHTML = data.map(ticket => `<tr><td class="fw-semibold">${ticket.ticket_number}</td><td><strong>${ticket.title}</strong><small class="d-block text-secondary">${ticket.department_name || 'No department'} · ${ticket.creator_name}</small></td><td>${ticketBadge(ticket.priority)}</td><td>${ticketBadge(ticket.status)}</td><td>${ticketDate(ticket.created_at)}</td><td class="text-end"><a class="btn btn-sm btn-outline-primary" href="/tickets/ticketdetails.html?id=${ticket.id}">View Ticket</a></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-secondary py-5">No tickets assigned to you</td></tr>';
  document.querySelectorAll('.pick-ticket').forEach(button => button.addEventListener('click', async () => { try { await ticketApi(`/${button.dataset.id}/pick`, { method: 'POST' }); loadTickets(); } catch (error) { alert(error.message); } }));
}
document.getElementById('ticketSearch').addEventListener('input', loadTickets);
loadTickets();
