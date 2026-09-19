require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const initSockets = require('./sockets');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const providerRoutes = require('./routes/provider');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = initSockets(httpServer);
app.set('io', io); // routes reach it via req.app.get('io')

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
