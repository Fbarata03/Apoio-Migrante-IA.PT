const express = require('express');
const router  = express.Router();
const authMw  = require('../middleware/auth');
const db      = require('../config/database');
const ai      = require('../services/ai');

/* GET /api/insights — insight IA personalizado */
router.get('/', authMw, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        p.current_step,
        p.status,
        GREATEST(0, DATEDIFF(p.estimated_end_date, CURDATE())) AS days_remaining,
        (SELECT COUNT(*) FROM documents d WHERE d.process_id = p.id AND d.status != 'rejected') AS docs_submitted,
        (SELECT COUNT(*) FROM documents d WHERE d.process_id = p.id AND d.status = 'rejected')  AS docs_rejected,
        (SELECT COUNT(*) FROM payments   pay WHERE pay.process_id = p.id AND pay.status = 'paid') > 0 AS payment_done
      FROM processes p
      WHERE p.user_id = ?
      LIMIT 1
    `, [req.userId]);

    if (!rows.length) return res.status(404).json({ error: 'Processo não encontrado' });

    const text = await ai.generateInsight(req.userId, rows[0]);
    res.json({ insight: text });

  } catch (err) {
    console.error('[Insights]', err.message);
    res.status(500).json({ error: 'Não foi possível gerar o insight.' });
  }
});

module.exports = router;
