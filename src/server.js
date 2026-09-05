const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { port, jwtSecret } = require('./config');
require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: false,
  lastModified: false,
  maxAge: 0
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/attendance', require('./routes/attendance')(io));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/justifications', require('./routes/justifications'));
app.use('/api/reports', require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'Sistema de Asistencia Docente',
  version: 'PORTALES_SEPARADOS_V7',
  time: new Date().toISOString()
}));

app.get('/', (req, res) => {
  res.redirect(302, '/docente');
});

app.get(['/docente', '/portal-docente'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, '..', 'public', 'docente.html'));
});

app.get(['/admin', '/administrador'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ruta de API no encontrada' });
  }
  res.redirect(302, '/docente');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Sesión requerida'));
    socket.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    next(new Error('Sesión inválida'));
  }
});

io.on('connection', (socket) => {
  if (socket.user.role === 'DOCENTE' && socket.user.teacherId) {
    socket.join(`teacher:${socket.user.teacherId}`);
  } else {
    socket.join('staff');
  }
  socket.emit('connected', { message: 'Canal de asistencia en tiempo real activo' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Sistema de asistencia disponible en http://localhost:${port}`);
  console.log(`Para otros equipos use http://IP-DE-ESTA-PC:${port}`);
});
