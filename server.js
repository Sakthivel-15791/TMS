require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const reportRoutes = require('./routes/reportRoutes');
const roleRoutes = require('./routes/roleRoutes');
const assetRoutes = require('./routes/assetRoutes');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/access', roleRoutes);
app.use('/api/assets', assetRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'employee-ticket-management' }));
app.use((req, res, next) => {
	if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(__dirname, 'Public', 'index.html'));
	next();
});
app.use((error, req, res, next) => { console.error(error); res.status(500).json({ message: 'Server error' }); });

if (require.main === module) app.listen(port, () => console.log(`Employee and ticket management running at http://localhost:${port}`));
module.exports = app;
