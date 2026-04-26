const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db      = require('../config/database');
const authMw  = require('../middleware/auth');
const ai      = require('../services/ai');
const { sendToUser } = require('./sse');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Formato não suportado. Use PDF, JPG, PNG ou WebP.'));
  },
});

/* GET /api/documents */
router.get('/', authMw, async (req, res) => {
  try {
    const [procs] = await db.execute(
      'SELECT id FROM processes WHERE user_id = ? LIMIT 1', [req.userId]
    );
    if (!procs.length) return res.json([]);

    const [docs] = await db.execute(
      'SELECT * FROM documents WHERE process_id = ? ORDER BY uploaded_at DESC',
      [procs[0].id]
    );
    res.json(docs);
  } catch (err) {
    console.error('[Documents GET]', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/* POST /api/documents/upload */
router.post('/upload', authMw, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });

    const [procs] = await db.execute(
      'SELECT id FROM processes WHERE user_id = ? LIMIT 1', [req.userId]
    );
    if (!procs.length) return res.status(404).json({ error: 'Processo não encontrado' });

    const procId  = procs[0].id;
    const docType = req.body.type || 'Outros';

    const [result] = await db.execute(`
      INSERT INTO documents
        (process_id, user_id, document_type, original_name, stored_filename, file_path, mime_type, size_bytes, status)
      VALUES (?,?,?,?,?,?,?,?,'processing')
    `, [
      procId, req.userId, docType,
      req.file.originalname, req.file.filename,
      `uploads/${req.file.filename}`,
      req.file.mimetype, req.file.size,
    ]);

    const docId = result.insertId;

    /* Resposta imediata — validação IA em background */
    res.status(201).json({
      id:            docId,
      original_name: req.file.originalname,
      status:        'processing',
      message:       'Ficheiro recebido. A IA está a analisar...',
    });

    /* Validação IA assíncrona */
    validateWithAI(docId, req.userId, req.file.originalname, req.file.path, req.file.mimetype);

  } catch (err) {
    console.error('[Upload]', err);
    res.status(500).json({ error: err.message || 'Erro ao enviar ficheiro' });
  }
});

/* DELETE /api/documents/:id */
router.delete('/:id', authMw, async (req, res) => {
  try {
    const [docs] = await db.execute(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?', [req.params.id, req.userId]
    );
    if (!docs.length) return res.status(404).json({ error: 'Documento não encontrado' });

    await db.execute('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ message: 'Documento removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/* ── Validação IA (background) ───────────────────────────── */

async function validateWithAI(docId, userId, originalName, filePath, mimeType) {
  try {
    const result = await ai.analyzeDocument(filePath, originalName, mimeType);

    const status  = result.approved ? 'approved' : 'rejected';
    const errMsg  = result.approved ? null : result.feedback;

    await db.execute(
      'UPDATE documents SET status=?, error_message=?, validated_at=NOW() WHERE id=?',
      [status, errMsg, docId]
    );

    const notifTitle   = result.approved ? 'Documento aprovado pela IA' : 'Documento rejeitado pela IA';
    const notifMessage = result.feedback;
    const priority     = result.approved ? 'medium' : 'high';

    await db.execute(
      'INSERT INTO notifications (user_id, type, title, message, priority) VALUES (?,?,?,?,?)',
      [userId, 'document', notifTitle, notifMessage, priority]
    );

    /* SSE — actualização em tempo real */
    sendToUser(userId, {
      type:    'document_validated',
      docId,
      status,
      title:   notifTitle,
      message: notifMessage,
    });

  } catch (err) {
    console.error('[AI Validation]', err.message);
    /* Marcar como pendente em caso de erro crítico */
    await db.execute(
      'UPDATE documents SET status=\'pending\', error_message=? WHERE id=?',
      ['Validação IA falhou. A equipa foi notificada.', docId]
    );
  }
}

module.exports = router;
