PRAGMA foreign_keys = ON;

CREATE TABLE teachers (
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

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','RH','JEFE','DOCENTE','RECEPCION','AUDITOR')),
  teacher_id INTEGER UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  tolerance_minutes INTEGER NOT NULL DEFAULT 10,
  subject TEXT,
  classroom TEXT,
  period TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  ip_address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_connection TEXT
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  schedule_id INTEGER,
  device_id INTEGER,
  attendance_date TEXT NOT NULL,
  scheduled_time TEXT,
  registered_time TEXT,
  registered_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'FINGERPRINT',
  notes TEXT,
  source_event_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE justifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);
