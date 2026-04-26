/**
 * SSE — Server-Sent Events
 * Envia eventos em tempo real para o browser do utilizador.
 * Uso: GET /api/sse  (autenticado via ?token=... ou header Authorization)
 */
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

/* Mapa userId → response SSE */
const clients = new Map();

/* GET /api/sse */
router.get('/', (req, res) => {
  /* Auth via query param (EventSource não suporta headers) */
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).end();

  let userId;
  try {
    userId = jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch {
    return res.status(401).end();
  }

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  /* Enviar heartbeat inicial */
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  /* Heartbeat a cada 25s para manter a ligação */
  const ping = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  clients.set(userId, res);

  req.on('close', () => {
    clearInterval(ping);
    clients.delete(userId);
  });
});

/* Enviar evento para um utilizador específico */
function sendToUser(userId, event) {
  const res = clients.get(Number(userId));
  if (res) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

/* Enviar para todos (broadcast) */
function broadcast(event) {
  clients.forEach(res => res.write(`data: ${JSON.stringify(event)}\n\n`));
}

module.exports = { router, sendToUser, broadcast };
