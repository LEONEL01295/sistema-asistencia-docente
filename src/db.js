const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { dbFile, adminUsername, adminPassword } = require('./config');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT NOT NULL UNIQUE,
      biometric_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      department TEXT,
      email TEXT,
      photo_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','RH','JEFE','DOCENTE','RECEPCION','AUDITOR')),
      teacher_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      tolerance_minutes INTEGER NOT NULL DEFAULT 10,
      subject TEXT,
      classroom TEXT,
      period TEXT NOT NULL DEFAULT '2026-1',
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      location TEXT,
      ip_address TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_connection TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      schedule_id INTEGER,
      device_id INTEGER,
      attendance_date TEXT NOT NULL,
      scheduled_time TEXT,
      registered_time TEXT,
      registered_at TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('ENTRY','EXIT','ABSENCE','MANUAL')),
      status TEXT NOT NULL CHECK(status IN ('ON_TIME','LATE','ABSENT','JUSTIFIED','OUT_OF_SCHEDULE','EXIT','MANUAL')),
      delay_minutes INTEGER NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'FINGERPRINT',
      notes TEXT,
      source_event_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id),
      FOREIGN KEY (device_id) REFERENCES devices(id)
    );

    CREATE TABLE IF NOT EXISTS justifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_path TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
      approved_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migración para bases creadas con versiones anteriores.
  if (!hasColumn('users', 'teacher_id')) {
    db.exec('ALTER TABLE users ADD COLUMN teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL;');
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_teacher
      ON users(teacher_id) WHERE teacher_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_teacher ON attendance(teacher_id, attendance_date);
    CREATE INDEX IF NOT EXISTS idx_schedules_weekday ON schedules(weekday, active);
  `);

  seed();
}

function seed() {
  // Solo se crea el administrador inicial. No hay docentes ni asistencias de demostración.
  const admin = db.prepare('SELECT id FROM users WHERE username=?').get(adminUsername);
  if (!admin) {
    db.prepare(`
      INSERT INTO users(username,password_hash,full_name,role,teacher_id)
      VALUES(?,?,?,?,NULL)
    `).run(
      adminUsername,
      bcrypt.hashSync(adminPassword, 10),
      'Administrador del sistema',
      'ADMIN'
    );
  }
}

initialize();
module.exports = db;
