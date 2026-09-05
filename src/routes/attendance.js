const express = require('express');
const db = require('../db');
const { authRequired, roles, deviceAuth } = require('../middleware/auth');
const { recordBiometricEvent, generateAbsences } = require('../services/attendance');

const router = express.Router();

module.exports = function attendanceRoutes(io) {
  router.get('/', authRequired, (req, res) => {
    const conditions = [];
    const params = [];

    if (req.user.role === 'DOCENTE') {
      conditions.push('a.teacher_id=?');
      params.push(req.user.teacherId);
    }

    if (req.query.date) {
      conditions.push('a.attendance_date=?');
      params.push(req.query.date);
    } else if (req.query.start && req.query.end) {
      conditions.push('a.attendance_date BETWEEN ? AND ?');
      params.push(req.query.start, req.query.end);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT a.*,t.full_name,t.employee_number,d.name device_name,
             d.location device_location,s.subject,s.classroom
      FROM attendance a
      JOIN teachers t ON t.id=a.teacher_id
      LEFT JOIN devices d ON d.id=a.device_id
      LEFT JOIN schedules s ON s.id=a.schedule_id
      ${where}
      ORDER BY a.attendance_date DESC,a.registered_at DESC
      LIMIT 2000
    `).all(...params);

    res.json(rows);
  });

  router.post('/biometric', deviceAuth, (req, res) => {
    try {
      const result = recordBiometricEvent(req.body);
      const teacherId = result.attendance.teacher_id;

      io.to('staff').emit('biometric:event', result);
      io.to(`teacher:${teacherId}`).emit('biometric:event', result);
      io.to('staff').emit('dashboard:refresh', { date: result.attendance.attendance_date });
      io.to(`teacher:${teacherId}`).emit('dashboard:refresh', { date: result.attendance.attendance_date });

      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/generate-absences', authRequired, roles('ADMIN', 'RH'), (req, res) => {
    try {
      const result = generateAbsences(req.body.date, Boolean(req.body.force));
      io.emit('dashboard:refresh', { date: req.body.date });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/manual', authRequired, roles('ADMIN', 'RH'), (req, res) => {
    const b = req.body || {};
    if (!b.teacher_id || !b.date || !b.time) {
      return res.status(400).json({ error: 'Docente, fecha y hora son obligatorios' });
    }

    const info = db.prepare(`
      INSERT INTO attendance(
        teacher_id,attendance_date,registered_time,registered_at,
        event_type,status,method,notes,source_event_id
      ) VALUES(?,?,?,?, 'MANUAL','MANUAL','MANUAL',?,?)
    `).run(
      b.teacher_id,
      b.date,
      b.time,
      new Date(`${b.date}T${b.time}:00`).toISOString(),
      b.notes || 'Registro manual',
      `MAN-${Date.now()}`
    );

    io.to('staff').emit('dashboard:refresh', { date: b.date });
    io.to(`teacher:${b.teacher_id}`).emit('dashboard:refresh', { date: b.date });
    res.status(201).json({ id: info.lastInsertRowid });
  });

  return router;
};
