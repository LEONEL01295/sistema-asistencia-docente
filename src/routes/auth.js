const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { jwtSecret } = require('../config');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function publicUser(user, teacher = null) {
  return {
    id: user.id,
    username: user.username,
    name: user.full_name,
    role: user.role,
    teacherId: user.teacher_id || null,
    employeeNumber: teacher?.employee_number || null
  };
}

function createSession(user, teacher = null) {
  const payload = publicUser(user, teacher);
  const token = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
  return { token, user: payload };
}

router.post('/admin-login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = db.prepare(`
    SELECT * FROM users
    WHERE username=? AND role='ADMIN' AND active=1
  `).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña de administrador incorrectos' });
  }

  res.json(createSession(user));
});

router.post('/teacher-login', (req, res) => {
  const employeeNumber = String(req.body?.employeeNumber || '').trim();
  const password = String(req.body?.password || '');

  const row = db.prepare(`
    SELECT
      u.*,
      t.employee_number,
      t.biometric_id,
      t.department,
      t.email,
      t.photo_url,
      t.active teacher_active
    FROM users u
    JOIN teachers t ON t.id=u.teacher_id
    WHERE t.employee_number = ? COLLATE NOCASE
      AND u.role='DOCENTE'
      AND u.active=1
      AND t.active=1
    LIMIT 1
  `).get(employeeNumber);

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Número de empleado o contraseña incorrectos' });
  }

  res.json(createSession(row, row));
});

// Ruta conservada para compatibilidad con versiones anteriores.
router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  if (user.role === 'DOCENTE') {
    const teacher = db.prepare('SELECT * FROM teachers WHERE id=? AND active=1').get(user.teacher_id);
    if (!teacher) {
      return res.status(403).json({ error: 'La cuenta docente no está vinculada a un docente activo' });
    }
    return res.json(createSession(user, teacher));
  }

  res.json(createSession(user));
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'La cuenta ya no está disponible' });

  let teacher = null;
  if (user.teacher_id) {
    teacher = db.prepare(`
      SELECT id,employee_number,biometric_id,full_name,department,email,photo_url,active
      FROM teachers WHERE id=? AND active=1
    `).get(user.teacher_id) || null;

    if (user.role === 'DOCENTE' && !teacher) {
      return res.status(403).json({ error: 'El docente vinculado ya no está activo' });
    }
  }

  const result = publicUser(user, teacher);
  result.teacher = teacher;
  res.json({ user: result });
});

router.put('/password', authRequired, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(req.user.id);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }

  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
    bcrypt.hashSync(newPassword, 10),
    user.id
  );
  res.json({ ok: true });
});

module.exports = router;
