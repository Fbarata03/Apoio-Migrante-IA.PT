const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');
const authMw   = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, nationality } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nome, email e palavra-passe são obrigatórios' });
    if (password.length < 8)
      return res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 8 caracteres' });

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(409).json({ error: 'Este email já está registado' });

    const hash = await bcrypt.hash(password, 10);
    const [ur] = await db.execute(
      'INSERT INTO users (name, email, password_hash, phone, nationality) VALUES (?,?,?,?,?)',
      [name, email, hash, phone || null, nationality || null]
    );
    const userId = ur.insertId;

    // Número de processo único
    const year   = new Date().getFullYear();
    const seq    = String(userId).padStart(5, '0');
    const pNum   = `PT-${year}-${seq}`;

    const start  = new Date().toISOString().split('T')[0];
    const estEnd = new Date(Date.now() + 36 * 86400000).toISOString().split('T')[0];

    const [pr] = await db.execute(
      'INSERT INTO processes (user_id, process_number, start_date, estimated_end_date) VALUES (?,?,?,?)',
      [userId, pNum, start, estEnd]
    );
    const procId = pr.insertId;

    // Passos iniciais
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    await db.execute(`
      INSERT INTO process_steps
        (process_id, step_number, name, status, completed_date, estimated_days, detail)
      VALUES
        (?,1,'Registo','completed',?,1,'Hoje'),
        (?,2,'Pagamento','in_progress',NULL,3,'Pendente'),
        (?,3,'Documentos','pending',NULL,10,'~10 dias'),
        (?,4,'Análise IA','pending',NULL,5,'~5 dias'),
        (?,5,'Decisão','pending',NULL,7,'~22 dias')
    `, [procId, now, procId, procId, procId, procId]);

    // Registo concluído → passo atual é o 2 (Pagamento)
    await db.execute('UPDATE processes SET current_step = 2 WHERE id = ?', [procId]);

    // Pagamento inicial
    const due = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    await db.execute(
      'INSERT INTO payments (process_id, user_id, amount, due_date) VALUES (?,?,5.00,?)',
      [procId, userId, due]
    );

    // Notificações de boas-vindas
    await db.execute(`
      INSERT INTO notifications (user_id, type, title, message, priority) VALUES
        (?, 'official', 'Candidatura recebida',
         ?, 'high'),
        (?, 'payment', 'Pagamento da taxa',
         'Para avançar para a fase de análise por IA, é necessário regularizar a taxa administrativa única.', 'high')
    `, [userId, `Candidatura recebida com sucesso. Número de processo: ${pNum}`, userId]);

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ token, user: { id: userId, name, email }, processNumber: pNum });

  } catch (err) {
    console.error('Register:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios' });

    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const user = rows[0];
    if (!(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });

  } catch (err) {
    console.error('Login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMw, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, nationality, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
