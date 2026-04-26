const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const authMw  = require('../middleware/auth');

// GET /api/notifications
router.get('/', authMw, async (req, res) => {
  try {
    const onlyUnread = req.query.unread === 'true';
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.userId];
    if (onlyUnread) { sql += ' AND is_read = FALSE'; }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const [rows] = await db.execute(sql, params);
    const [[{ cnt }]] = await db.execute(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.userId]
    );
    res.json({ notifications: rows, unread_count: cnt });
  } catch (err) {
    console.error('Notif GET:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authMw, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read=TRUE WHERE user_id=?', [req.userId]);
    res.json({ message: 'Todas marcadas como lidas' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMw, async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?',
      [req.params.id, req.userId]
    );
    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
