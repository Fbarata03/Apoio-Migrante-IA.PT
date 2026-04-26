module.exports = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const msg    = status < 500 ? err.message : 'Erro interno do servidor';
  if (status >= 500) console.error('[Error]', err);
  res.status(status).json({ error: msg });
};
