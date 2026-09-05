const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildRows(req) {
  const { start, end } = req.query;
  if (!start || !end) throw new Error('Fecha inicial y final son obligatorias');

  const teacherCondition = req.user.role === 'DOCENTE' ? 'AND a.teacher_id=?' : '';
  const params = req.user.role === 'DOCENTE'
    ? [start, end, req.user.teacherId]
    : [start, end];

  return db.prepare(`
    SELECT t.employee_number,t.full_name,t.department,a.attendance_date,
           a.scheduled_time,a.registered_time,a.status,a.delay_minutes,
           a.event_type,a.method,d.name device_name,s.subject,s.classroom
    FROM attendance a
    JOIN teachers t ON t.id=a.teacher_id
    LEFT JOIN devices d ON d.id=a.device_id
    LEFT JOIN schedules s ON s.id=a.schedule_id
    WHERE a.attendance_date BETWEEN ? AND ? ${teacherCondition}
    ORDER BY a.attendance_date DESC,t.full_name,a.registered_time DESC
  `).all(...params);
}

router.get('/summary', (req, res) => {
  try {
    res.json(buildRows(req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/csv', (req, res) => {
  try {
    const rows = buildRows(req);
    const headers = [
      'Número de empleado','Docente','Departamento','Fecha','Hora programada',
      'Hora registrada','Estado','Minutos de retraso','Evento','Método',
      'Dispositivo','Materia','Aula'
    ];
    const keys = [
      'employee_number','full_name','department','attendance_date','scheduled_time',
      'registered_time','status','delay_minutes','event_type','method',
      'device_name','subject','classroom'
    ];
    const csv = '\ufeff' + [
      headers.join(','),
      ...rows.map((row) => keys.map((key) => csvEscape(row[key])).join(','))
    ].join('\n');

    const prefix = req.user.role === 'DOCENTE' ? 'mi_historial' : 'reporte_asistencia';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}_${req.query.start}_${req.query.end}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
