const express   = require('express');
const router    = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authMw    = require('../middleware/auth');
const db        = require('../config/database');
const ai        = require('../services/ai');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Muitas mensagens. Aguarde um momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* POST /api/chat */
router.post('/',
  authMw,
  chatLimiter,
  body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Mensagem inválida'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    try {
      const { message, history = [] } = req.body;

      /* Carregar contexto do processo do utilizador */
      const [procs] = await db.execute(
        `SELECT process_number, type, status, current_step FROM processes WHERE user_id = ? LIMIT 1`,
        [req.userId]
      );

      const response = await ai.chat(message, procs[0] || null, history);
      res.json({ response });

    } catch (err) {
      console.error('[Chat]', err.message);
      if (err.status === 529 || err.status === 503) {
        return res.status(503).json({ error: 'Assistente temporariamente sobrecarregado. Tente daqui a pouco.' });
      }
      res.status(500).json({ error: 'Erro ao processar a sua mensagem.' });
    }
  }
);

module.exports = router;
