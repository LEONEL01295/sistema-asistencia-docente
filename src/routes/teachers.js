const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, roles } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const teacherSelect = `
  SELECT t.*,
         u.id access_user_id,
         u.active access_active,
         CASE WHEN u.id IS NULL THEN 0 ELSE 1 END has_access
  FROM teachers t
  LEFT JOIN users u ON u.teacher_id=t.id AND u.role='DOCENTE'
`;

function internalTeacherUsername(employeeNumber) {
  return `doc:${String(employeeNumber || '').trim().toLowerCase()}`;
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

router.get('/', (req, res) => {
  if (req.user.role === 'DOCENTE') {
    if (!req.user.teacherId) return res.json([]);
    const teacher = db.prepare(`${teacherSelect} WHERE t.id=? ORDER BY t.full_name`).get(req.user.teacherId);
    return res.json(teacher ? [teacher] : []);
  }

  res.json(db.prepare(`${teacherSelect} ORDER BY t.full_name`).all());
});

router.post('/', roles('ADMIN', 'RH'), (req, res) => {
  const b = req.body || {};
  const employeeNumber = String(b.employee_number || '').trim();
  const biometricId = String(b.biometric_id || '').trim();
  const fullName = String(b.full_name || '').trim();
  const password = String(b.password || '');

  if (!employeeNumber || !biometricId || !fullName) {
    return res.status(400).json({ error: 'Número de empleado, ID biométrico y nombre son obligatorios' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'La contraseña inicial debe tener al menos 8 caracteres' });
  }

  db.exec('BEGIN');
  try {
    const teacherInfo = db.prepare(`
      INSERT INTO teachers(employee_number,biometric_id,full_name,department,email,photo_url)
      VALUES(?,?,?,?,?,?)
    `).run(
      employeeNumber,
      biometricId,
      fullName,
      String(b.department || '').trim(),
      String(b.email || '').trim(),
      String(b.photo_url || '').trim()
    );

    const teacherId = Number(teacherInfo.lastInsertRowid);
    db.prepare(`
      INSERT INTO users(username,password_hash,full_name,role,teacher_id,active)
      VALUES(?,?,?,?,?,1)
    `).run(
      internalTeacherUsername(employeeNumber),
      bcrypt.hashSync(password, 10),
      fullName,
      'DOCENTE',
      teacherId
    );

    db.prepare(`
      INSERT INTO audit_logs(user_id,action,entity,entity_id,details)
      VALUES(?,?,?,?,?)
    `).run(
      req.user.id,
      'CREATE',
      'TEACHER',
      String(teacherId),
      `Acceso creado para número de empleado ${employeeNumber}`
    );

    db.exec('COMMIT');
    res.status(201).json(db.prepare(`${teacherSelect} WHERE t.id=?`).get(teacherId));
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(409).json({ error: 'El número de empleado o ID biométrico ya está registrado' });
  }
});

router.put('/:id', roles('ADMIN', 'RH'), (req, res) => {
  const b = req.body || {};
  const current = db.prepare('SELECT * FROM teachers WHERE id=?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Docente no encontrado' });

  db.exec('BEGIN');
  try {
    const employeeNumber = String(b.employee_number ?? current.employee_number).trim();
    const fullName = String(b.full_name ?? current.full_name).trim();
    const active = b.active === undefined ? current.active : Number(Boolean(b.active));

    db.prepare(`
      UPDATE teachers
      SET employee_number=?,biometric_id=?,full_name=?,department=?,email=?,photo_url=?,active=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      employeeNumber,
      String(b.biometric_id ?? current.biometric_id).trim(),
      fullName,
      String(b.department ?? current.department ?? '').trim(),
      String(b.email ?? current.email ?? '').trim(),
      String(b.photo_url ?? current.photo_url ?? '').trim(),
      active,
      req.params.id
    );

    db.prepare(`
      UPDATE users
      SET username=?,full_name=?,active=?
      WHERE teacher_id=? AND role='DOCENTE'
    `).run(
      internalTeacherUsername(employeeNumber),
      fullName,
      active,
      req.params.id
    );

    db.exec('COMMIT');
    res.json(db.prepare(`${teacherSelect} WHERE t.id=?`).get(req.params.id));
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(409).json({ error: 'El número de empleado o ID biométrico ya está registrado' });
  }
});

router.post('/:id/access', roles('ADMIN', 'RH'), (req, res) => {
  const teacher = db.prepare('SELECT * FROM teachers WHERE id=?').get(req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Docente no encontrado' });

  const password = String(req.body?.password || '');
  const existing = db.prepare(`
    SELECT * FROM users WHERE teacher_id=? AND role='DOCENTE'
  `).get(teacher.id);

  if (!existing && !validatePassword(password)) {
    return res.status(400).json({ error: 'La contraseña inicial debe tener al menos 8 caracteres' });
  }
  if (existing && password && !validatePassword(password)) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  try {
    if (existing) {
      if (password) {
        db.prepare(`
          UPDATE users
          SET username=?,password_hash=?,full_name=?,active=1
          WHERE id=?
        `).run(
          internalTeacherUsername(teacher.employee_number),
          bcrypt.hashSync(password, 10),
          teacher.full_name,
          existing.id
        );
      } else {
        db.prepare(`
          UPDATE users SET username=?,full_name=?,active=1 WHERE id=?
        `).run(
          internalTeacherUsername(teacher.employee_number),
          teacher.full_name,
          existing.id
        );
      }
    } else {
      db.prepare(`
        INSERT INTO users(username,password_hash,full_name,role,teacher_id,active)
        VALUES(?,?,?,?,?,1)
      `).run(
        internalTeacherUsername(teacher.employee_number),
        bcrypt.hashSync(password, 10),
        teacher.full_name,
        'DOCENTE',
        teacher.id
      );
    }

    db.prepare(`
      INSERT INTO audit_logs(user_id,action,entity,entity_id,details)
      VALUES(?,?,?,?,?)
    `).run(
      req.user.id,
      existing ? 'RESET_PASSWORD' : 'CREATE_ACCESS',
      'TEACHER',
      String(teacher.id),
      `Acceso por número de empleado ${teacher.employee_number}`
    );

    res.json(db.prepare(`${teacherSelect} WHERE t.id=?`).get(teacher.id));
  } catch (error) {
    res.status(409).json({ error: 'No fue posible configurar el acceso del docente' });
  }
});

router.delete('/:id', roles('ADMIN'), (req, res) => {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE teachers SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    db.prepare(`UPDATE users SET active=0 WHERE teacher_id=? AND role='DOCENTE'`).run(req.params.id);
    db.exec('COMMIT');
    res.status(204).end();
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'No fue posible desactivar al docente' });
  }
});

module.exports = router;
