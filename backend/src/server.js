import { Pool } from 'pg';
import { createApp } from './app.js';

const requiredVariables = ['DATABASE_URL'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) {
  throw new Error(`Faltan variables de entorno: ${missingVariables.join(', ')}`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      description VARCHAR(2000) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const app = createApp(pool, allowedOrigins);
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`API lista en el puerto ${port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  }
}

start().catch(async (error) => {
  console.error('No se pudo iniciar la API:', error);
  await pool.end();
  process.exitCode = 1;
});
