const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'memegrave',
  user: process.env.PG_USER || 'memegrave_user',
  password: process.env.PG_PASSWORD || ''
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};