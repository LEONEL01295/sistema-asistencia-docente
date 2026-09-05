const jwt = require('jsonwebtoken');
const { jwtSecret, deviceSharedKey } = require('../config');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function roles(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'No cuenta con permisos para esta operación' });
    }
    next();
  };
}

function deviceAuth(req, res, next) {
  const key = req.headers['x-device-key'];
  if (!key || key !== deviceSharedKey) return res.status(401).json({ error: 'Credencial de dispositivo inválida' });
  next();
}

module.exports = { authRequired, roles, deviceAuth };
