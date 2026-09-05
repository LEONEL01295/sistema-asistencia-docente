const express = require('express');
const { authRequired } = require('../middleware/auth');
const { dashboard } = require('../services/attendance');
const { nowLocal } = require('../time');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  try {
    const teacherId = req.user.role === 'DOCENTE' ? req.user.teacherId : null;
    res.json(dashboard(req.query.date || nowLocal().date, teacherId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
