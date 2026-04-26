require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const { router: sseRouter } = require('./routes/sse');

const app = express();

/* ── Segurança ───────────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'unpkg.com'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com', 'fonts.googleapis.com'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", 'data:', 'fonts.gstatic.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/* ── Logging ─────────────────────────────────────────────── */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/* ── CORS ────────────────────────────────────────────────── */
app.use(cors({ origin: true, credentials: true }));

/* ── Rate limiting global ────────────────────────────────── */
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 200,
  message: { error: 'Demasiados pedidos. Tente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

/* Rate limit mais apertado para auth */
app.use('/api/auth/login',    rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiadas tentativas de login.' } }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5,  message: { error: 'Limite de registos atingido.' } }));

/* ── Body parsing ────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Ficheiros estáticos ─────────────────────────────────── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── SSE (antes dos outros middlewares de parsing) ────────── */
app.use('/api/sse', sseRouter);

/* ── Rotas API ───────────────────────────────────────────── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/process',       require('./routes/process'));
app.use('/api/documents',     require('./routes/documents'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/insights',      require('./routes/insights'));

/* ── Health check ────────────────────────────────────────── */
app.get('/api/health', (req, res) => res.json({
  status:  'ok',
  ts:      new Date().toISOString(),
  ai:      'ollama-local',
  models:  {
    vision: process.env.AI_MODEL_VISION || 'gemma4:latest',
    chat:   process.env.AI_MODEL_CHAT   || 'gemma4:latest',
    fast:   process.env.AI_MODEL_FAST   || 'llama3.2:latest',
  },
  version: '2.0.0',
}));

/* ── Frontend ────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

/* ── Tratamento de erros ─────────────────────────────────── */
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  let aiMode;
  try {
    const r = await fetch(`${ollamaHost}/api/tags`);
    const d = await r.json();
    const models = (d.models || []).map(m => m.name.split(':')[0]).join(', ');
    aiMode = `🤖 IA Local (Ollama) — modelos: ${models || 'desconhecido'}`;
  } catch {
    aiMode = '⚠️  Ollama não detectado — fallback activo';
  }
  console.log(`\n🚀  Apoio Migrante IA PT v2.0 — porta ${PORT}`);
  console.log(`${aiMode}`);
  console.log(`🌐  http://localhost:${PORT}\n`);
});
