const express = require('express');
const db = require('../db');
const { authRequired, roles } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const base = `
    SELECT s.*,t.full_name,t.employee_number
    FROM schedules s
    JOIN teachers t ON t.id=s.teacher_id
  `;

  if (req.user.role === 'DOCENTE') {
    return res.json(db.prepare(`${base} WHERE s.teacher_id=? ORDER BY s.weekday,s.start_time`).all(req.user.teacherId));
  }

  res.json(db.prepare(`${base} ORDER BY s.weekday,s.start_time,t.full_name`).all());
});

router.post('/', roles('ADMIN', 'RH', 'JEFE'), (req, res) => {
  const b = req.body || {};
  if (!b.teacher_id || b.weekday === undefined || !b.start_time || !b.end_time) {
    return res.status(400).json({ error: 'Docente, día, entrada y salida son obligatorios' });
  }

  const info = db.prepare(`
    INSERT INTO schedules(teacher_id,weekday,start_time,end_time,tolerance_minutes,subject,classroom,period)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    b.teacher_id,
    b.weekday,
    b.start_time,
    b.end_time,
    b.tolerance_minutes ?? 10,
    b.subject || '',
    b.classroom || '',
    b.period || '2026-1'
  );

  res.status(201).json(db.prepare(`
    SELECT s.*,t.full_name
    FROM schedules s JOIN teachers t ON t.id=s.teacher_id
    WHERE s.id=?
  `).get(info.lastInsertRowid));
});

router.put('/:id', roles('ADMIN', 'RH', 'JEFE'), (req, res) => {
  const current = db.prepare('SELECT * FROM schedules WHERE id=?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Horario no encontrado' });

  const b = req.body || {};
  db.prepare(`
    UPDATE schedules
    SET teacher_id=?,weekday=?,start_time=?,end_time=?,tolerance_minutes=?,subject=?,classroom=?,period=?,active=?
    WHERE id=?
  `).run(
    b.teacher_id ?? current.teacher_id,
    b.weekday ?? current.weekday,
    b.start_time ?? current.start_time,
    b.end_time ?? current.end_time,
    b.tolerance_minutes ?? current.tolerance_minutes,
    b.subject ?? current.subject,
    b.classroom ?? current.classroom,
    b.period ?? current.period,
    b.active === undefined ? current.active : Number(Boolean(b.active)),
    req.params.id
  );

  res.json(db.prepare(`
    SELECT s.*,t.full_name
    FROM schedules s JOIN teachers t ON t.id=s.teacher_id
    WHERE s.id=?
  `).get(req.params.id));
});

router.delete('/:id', roles('ADMIN', 'RH'), (req, res) => {
  db.prepare('UPDATE schedules SET active=0 WHERE id=?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
