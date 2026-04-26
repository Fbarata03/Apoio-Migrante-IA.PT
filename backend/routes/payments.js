const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const authMw  = require('../middleware/auth');

// GET /api/payments
router.get('/', authMw, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/payments/:id/pay
router.post('/:id/pay', authMw, async (req, res) => {
  try {
    const [pays] = await db.execute(
      'SELECT * FROM payments WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!pays.length) return res.status(404).json({ error: 'Pagamento não encontrado' });
    if (pays[0].status === 'paid') return res.status(400).json({ error: 'Pagamento já efetuado' });

    const method = req.body.method || 'Cartão';
    await db.execute(
      'UPDATE payments SET status=?, method=?, paid_at=NOW() WHERE id=?',
      ['paid', method, req.params.id]
    );

    // Avançar passos do processo
    const [procs] = await db.execute(
      'SELECT id FROM processes WHERE user_id = ? LIMIT 1', [req.userId]
    );
    if (procs.length) {
      const pid = procs[0].id;
      await db.execute(
        `UPDATE process_steps SET status='completed', completed_date=NOW()
         WHERE process_id=? AND step_number=2`, [pid]
      );
      await db.execute(
        `UPDATE process_steps SET status='in_progress'
         WHERE process_id=? AND step_number=3`, [pid]
      );
      await db.execute(
        'UPDATE processes SET current_step=3 WHERE id=?', [pid]
      );
    }

    // Notificação de confirmação
    await db.execute(`
      INSERT INTO notifications (user_id, type, title, message, priority) VALUES
        (?, 'payment', 'Pagamento confirmado',
         ?, 'medium')
    `, [req.userId, `Taxa de €${pays[0].amount} paga com sucesso. O seu processo avança para a fase de documentação.`]);

    res.json({ message: 'Pagamento efetuado com sucesso', status: 'paid' });
  } catch (err) {
    console.error('Payment:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
