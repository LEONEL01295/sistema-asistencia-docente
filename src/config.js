const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion',
  deviceSharedKey: process.env.DEVICE_SHARED_KEY || 'lector-institucional-2026',
  timezone: process.env.TIMEZONE || 'America/Mexico_City',
  dbFile: path.resolve(__dirname, '..', process.env.DB_FILE || './data/asistencia.db'),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!'
};
