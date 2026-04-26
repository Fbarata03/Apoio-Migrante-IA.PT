const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const authMw  = require('../middleware/auth');

// GET /api/process
router.get('/', authMw, async (req, res) => {
  try {
    const [procs] = await db.execute(`
      SELECT
        p.*,
        DATEDIFF(CURDATE(), p.start_date)                                           AS days_elapsed,
        GREATEST(0, DATEDIFF(p.estimated_end_date, CURDATE()))                      AS days_remaining,
        (SELECT COUNT(*) FROM documents d WHERE d.process_id = p.id
                                          AND d.status != 'rejected')              AS docs_submitted,
        (SELECT COUNT(*) FROM documents d WHERE d.process_id = p.id
                                             AND d.status = 'approved')             AS docs_approved,
        (SELECT COUNT(*) FROM documents d WHERE d.process_id = p.id
                                             AND d.status = 'rejected')             AS docs_rejected,
        (SELECT COUNT(*) FROM payments pay WHERE pay.process_id = p.id
                                              AND pay.status = 'paid') > 0          AS payment_done,
        (SELECT amount FROM payments pay WHERE pay.process_id = p.id LIMIT 1)       AS payment_amount,
        (SELECT id    FROM payments pay WHERE pay.process_id = p.id
                                          AND pay.status = 'pending' LIMIT 1)       AS pending_payment_id
      FROM processes p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 1
    `, [req.userId]);

    if (!procs.length) return res.status(404).json({ error: 'Nenhum processo encontrado' });

    const proc = procs[0];
    const [steps] = await db.execute(
      'SELECT * FROM process_steps WHERE process_id = ? ORDER BY step_number',
      [proc.id]
    );

    res.json({ ...proc, steps });
  } catch (err) {
    console.error('Process GET:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
