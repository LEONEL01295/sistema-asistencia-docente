const express = require('express');
const db = require('../db');
const { authRequired, roles } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', roles('ADMIN', 'RH', 'JEFE', 'RECEPCION', 'AUDITOR'), (req, res) => {
  res.json(db.prepare('SELECT * FROM devices ORDER BY name').all());
});

router.post('/', roles('ADMIN'), (req, res) => {
  const body = req.body || {};
  if (!body.code || !body.name) {
    return res.status(400).json({ error: 'Código y nombre obligatorios' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO devices(code,name,location,ip_address) VALUES(?,?,?,?)
    `).run(body.code, body.name, body.location || '', body.ip_address || '');
    res.status(201).json(db.prepare('SELECT * FROM devices WHERE id=?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Ya existe un dispositivo con ese código' });
  }
});

module.exports = router;
