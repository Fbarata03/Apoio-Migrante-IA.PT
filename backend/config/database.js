const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'apoio_migrante',
  port:             parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  timezone:         '+00:00',
});

pool.getConnection()
  .then(conn => { conn.release(); console.log('✅ MySQL ligado'); })
  .catch(err  => console.error('❌ Erro MySQL:', err.message));

module.exports = pool;
