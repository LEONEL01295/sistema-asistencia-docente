const crypto = require('crypto');
const db = require('../db');
const { zonedParts, dayOfWeek, timeToMinutes, nowLocal } = require('../time');

function findApplicableSchedule(teacherId, date, registeredTime) {
  const weekday = dayOfWeek(date);
  const schedules = db.prepare(`
    SELECT * FROM schedules
    WHERE teacher_id=? AND weekday=? AND active=1
    ORDER BY start_time
  `).all(teacherId, weekday);

  if (!schedules.length) return null;
  const actual = timeToMinutes(registeredTime);
  const available = schedules.filter((schedule) => {
    const existing = db.prepare(`
      SELECT id FROM attendance
      WHERE schedule_id=? AND attendance_date=? AND event_type='ENTRY'
    `).get(schedule.id, date);
    return !existing;
  });

  if (!available.length) return null;
  available.sort((a, b) => (
    Math.abs(timeToMinutes(a.start_time) - actual)
    - Math.abs(timeToMinutes(b.start_time) - actual)
  ));
  return available[0];
}

function justificationFor(teacherId, date) {
  return db.prepare(`
    SELECT * FROM justifications
    WHERE teacher_id=? AND status='APPROVED' AND ? BETWEEN start_date AND end_date
    ORDER BY id DESC LIMIT 1
  `).get(teacherId, date);
}


function attendanceDetail(id) {
  return db.prepare(`
    SELECT a.*,t.full_name,t.employee_number,t.biometric_id,
           d.name device_name,d.location device_location,s.subject,s.classroom
    FROM attendance a
    JOIN teachers t ON t.id=a.teacher_id
    LEFT JOIN devices d ON d.id=a.device_id
    LEFT JOIN schedules s ON s.id=a.schedule_id
    WHERE a.id=?
  `).get(id);
}

function recordBiometricEvent(payload) {
  const biometricId = String(payload.biometricId || payload.employeeId || '').trim();
  if (!biometricId) throw new Error('El evento no contiene biometricId');

  const teacher = db.prepare('SELECT * FROM teachers WHERE biometric_id=? AND active=1').get(biometricId);
  if (!teacher) throw new Error(`No existe un docente activo con ID biométrico ${biometricId}`);

  const eventType = String(payload.eventType || 'ENTRY').toUpperCase();
  if (!['ENTRY', 'EXIT'].includes(eventType)) throw new Error('eventType debe ser ENTRY o EXIT');

  const parts = zonedParts(payload.dateTime || new Date());
  const device = db.prepare('SELECT * FROM devices WHERE code=? AND active=1').get(
    payload.deviceId || 'LECTOR-ENTRADA-01'
  );
  const sourceEventId = payload.eventId || crypto.randomUUID();

  const duplicate = db.prepare('SELECT * FROM attendance WHERE source_event_id=?').get(sourceEventId);
  if (duplicate) return { duplicate: true, attendance: attendanceDetail(duplicate.id), teacher };

  const recent = db.prepare(`
    SELECT * FROM attendance
    WHERE teacher_id=? AND event_type=?
      AND julianday(registered_at) >= julianday(?) - (60.0 / 86400.0)
    ORDER BY id DESC LIMIT 1
  `).get(teacher.id, eventType, parts.iso);
  if (recent) return { duplicate: true, attendance: attendanceDetail(recent.id), teacher };

  let schedule = null;
  let status = 'OUT_OF_SCHEDULE';
  let delay = 0;
  let scheduledTime = null;

  if (eventType === 'EXIT') {
    status = 'EXIT';
  } else {
    schedule = findApplicableSchedule(teacher.id, parts.date, parts.time);
    if (schedule) {
      scheduledTime = schedule.start_time;
      const actual = timeToMinutes(parts.time);
      const expected = timeToMinutes(schedule.start_time);
      delay = Math.max(0, actual - expected);
      const justification = justificationFor(teacher.id, parts.date);
      if (justification) status = 'JUSTIFIED';
      else status = delay <= schedule.tolerance_minutes ? 'ON_TIME' : 'LATE';
    }
  }

  const result = db.prepare(`
    INSERT INTO attendance(
      teacher_id,schedule_id,device_id,attendance_date,scheduled_time,registered_time,
      registered_at,event_type,status,delay_minutes,method,notes,source_event_id
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    teacher.id,
    schedule?.id || null,
    device?.id || null,
    parts.date,
    scheduledTime,
    parts.time,
    parts.iso,
    eventType,
    status,
    delay,
    payload.method || 'FINGERPRINT',
    payload.notes || null,
    sourceEventId
  );

  if (device) db.prepare('UPDATE devices SET last_connection=? WHERE id=?').run(parts.iso, device.id);

  const attendance = attendanceDetail(result.lastInsertRowid);

  return { duplicate: false, attendance, teacher };
}

function generateAbsences(date, force = false) {
  const localNow = nowLocal();
  const weekday = dayOfWeek(date);
  const schedules = db.prepare(`
    SELECT s.*,t.full_name
    FROM schedules s JOIN teachers t ON t.id=s.teacher_id
    WHERE s.weekday=? AND s.active=1 AND t.active=1
  `).all(weekday);

  let created = 0;
  const insert = db.prepare(`
    INSERT INTO attendance(
      teacher_id,schedule_id,attendance_date,scheduled_time,registered_at,
      event_type,status,method,notes,source_event_id
    ) VALUES(?,?,?,?,?,'ABSENCE',?,'SYSTEM',?,?)
  `);

  db.exec('BEGIN');
  try {
    for (const schedule of schedules) {
      const exists = db.prepare(`
        SELECT id FROM attendance
        WHERE schedule_id=? AND attendance_date=? AND event_type IN ('ENTRY','ABSENCE')
      `).get(schedule.id, date);
      if (exists) continue;

      const cutoff = timeToMinutes(schedule.start_time) + schedule.tolerance_minutes + 30;
      const canClose = force
        || date < localNow.date
        || (date === localNow.date && timeToMinutes(localNow.time) >= cutoff);
      if (!canClose) continue;

      const justification = justificationFor(schedule.teacher_id, date);
      const status = justification ? 'JUSTIFIED' : 'ABSENT';
      insert.run(
        schedule.teacher_id,
        schedule.id,
        date,
        schedule.start_time,
        new Date().toISOString(),
        status,
        justification ? `Justificación: ${justification.reason}` : 'Falta generada automáticamente',
        `ABS-${date}-${schedule.id}`
      );
      created++;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { created, reviewed: schedules.length };
}

function dashboard(date, teacherId = null) {
  const weekday = dayOfWeek(date);
  const teacherFilter = teacherId ? 'AND t.id=?' : '';
  const scheduleParams = teacherId ? [date, weekday, teacherId] : [date, weekday];

  const scheduled = db.prepare(`
    SELECT s.id schedule_id,s.start_time,s.end_time,s.tolerance_minutes,s.subject,s.classroom,
           t.id teacher_id,t.full_name,t.employee_number,t.department,t.biometric_id,
           a.id attendance_id,a.registered_time,a.status,a.delay_minutes,a.event_type
    FROM schedules s
    JOIN teachers t ON t.id=s.teacher_id
    LEFT JOIN attendance a ON a.id=(
      SELECT a2.id FROM attendance a2
      WHERE a2.schedule_id=s.id AND a2.attendance_date=?
        AND a2.event_type IN ('ENTRY','ABSENCE','MANUAL')
      ORDER BY a2.id DESC LIMIT 1
    )
    WHERE s.weekday=? AND s.active=1 AND t.active=1 ${teacherFilter}
    ORDER BY s.start_time,t.full_name
  `).all(...scheduleParams);

  const counts = {
    scheduled: scheduled.length,
    onTime: 0,
    late: 0,
    absent: 0,
    justified: 0,
    pending: 0
  };

  for (const row of scheduled) {
    if (row.status === 'ON_TIME') counts.onTime++;
    else if (row.status === 'LATE') counts.late++;
    else if (row.status === 'ABSENT') counts.absent++;
    else if (row.status === 'JUSTIFIED') counts.justified++;
    else counts.pending++;
  }

  const latestWhere = teacherId ? 'WHERE a.attendance_date=? AND a.teacher_id=?' : 'WHERE a.attendance_date=?';
  const latestParams = teacherId ? [date, teacherId] : [date];
  const latest = db.prepare(`
    SELECT a.*,t.full_name,t.employee_number,d.name device_name,s.subject
    FROM attendance a
    JOIN teachers t ON t.id=a.teacher_id
    LEFT JOIN devices d ON d.id=a.device_id
    LEFT JOIN schedules s ON s.id=a.schedule_id
    ${latestWhere}
    ORDER BY a.id DESC LIMIT 12
  `).all(...latestParams);

  const devices = teacherId ? [] : db.prepare('SELECT * FROM devices ORDER BY name').all();
  return { date, counts, scheduled, latest, devices };
}

module.exports = {
  recordBiometricEvent,
  generateAbsences,
  dashboard,
  findApplicableSchedule
};
