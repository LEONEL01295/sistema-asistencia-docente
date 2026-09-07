const db = require('./src/db');
const bcrypt = require('bcryptjs');

try {
  const hashedPassword = bcrypt.hashSync('123456', 10);
  
  db.exec('BEGIN');
  db.prepare(`
    INSERT INTO users (username, password, name, role, active)
    VALUES (?, ?, ?, ?, 1)
  `).run('admin', hashedPassword, 'Administrador del sistema', 'ADMIN');
  db.exec('COMMIT');
  
  console.log('✅ Usuario admin creado exitosamente');
  console.log('Usuario: admin');
  console.log('Contraseña: 123456');
} catch (err) {
  console.error('❌ Error:', err.message);
}
