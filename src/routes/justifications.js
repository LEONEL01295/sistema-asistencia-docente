const express = require('express');
const db = require('../db');
const { authRequired, roles } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const teacherCondition = req.user.role === 'DOCENTE' ? 'WHERE j.teacher_id=?' : '';
  const params = req.user.role === 'DOCENTE' ? [req.user.teacherId] : [];
  const rows = db.prepare(`
    SELECT j.*,t.full_name,t.employee_number,u.full_name approved_by_name
    FROM justifications j
    JOIN teachers t ON t.id=j.teacher_id
    LEFT JOIN users u ON u.id=j.approved_by
    ${teacherCondition}
    ORDER BY j.id DESC
  `).all(...params);
  res.json(rows);
});

router.post('/', (req, res) => {
  if (!['ADMIN', 'RH', 'JEFE', 'DOCENTE'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No cuenta con permisos para registrar justificantes' });
  }

  const body = req.body || {};
  const teacherId = req.user.role === 'DOCENTE' ? req.user.teacherId : Number(body.teacher_id);
  if (!teacherId || !body.start_date || !body.end_date || !body.reason) {
    return res.status(400).json({ error: 'Docente, fechas y motivo son obligatorios' });
  }
  if (body.end_date < body.start_date) {
    return res.status(400).json({ error: 'La fecha final no puede ser anterior a la inicial' });
  }

  const teacher = db.prepare('SELECT id FROM teachers WHERE id=? AND active=1').get(teacherId);
  if (!teacher) return res.status(404).json({ error: 'Docente no encontrado' });

  const info = db.prepare(`
    INSERT INTO justifications(teacher_id,start_date,end_date,reason,evidence_path,status)
    VALUES(?,?,?,?,?,'PENDING')
  `).run(
    teacherId,
    body.start_date,
    body.end_date,
    String(body.reason).trim(),
    body.evidence_path || null
  );

  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id/status', roles('ADMIN', 'RH'), (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const info = db.prepare(`
    UPDATE justifications SET status=?,approved_by=? WHERE id=?
  `).run(status, req.user.id, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Justificante no encontrado' });

  res.json({ ok: true, status });
});

module.exports = router;
