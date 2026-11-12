import express from 'express';
import cors from 'cors';

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function validateText(value, field, maxLength, { required = false } = {}) {
  if (value === undefined && !required) return { valid: true };
  if (typeof value !== 'string') {
    return { valid: false, error: `${field} debe ser texto.` };
  }
  const normalized = value.trim();
  if (required && !normalized) return { valid: false, error: `${field} es obligatorio.` };
  if (normalized.length > maxLength) {
    return { valid: false, error: `${field} no puede superar ${maxLength} caracteres.` };
  }
  return { valid: true, value: normalized };
}

export function createApp(pool, allowedOrigins = ['http://localhost:5173']) {
  const app = express();
  const origins = new Set(allowedOrigins);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.has('*') || origins.has(origin)) return callback(null, true);
      return callback(new Error('Origen no permitido por CORS.'));
    },
  }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));

  app.get('/api/tasks', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT id, title, description, created_at, updated_at FROM tasks ORDER BY created_at DESC, id DESC',
    );
    res.json(rows);
  }));

  app.get('/api/tasks/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo.' });

    const { rows } = await pool.query(
      'SELECT id, title, description, created_at, updated_at FROM tasks WHERE id = $1',
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró la tarea.' });
    return res.json(rows[0]);
  }));

  app.post('/api/tasks', asyncHandler(async (req, res) => {
    const title = validateText(req.body?.title, 'El título', MAX_TITLE_LENGTH, { required: true });
    const description = validateText(req.body?.description ?? '', 'La descripción', MAX_DESCRIPTION_LENGTH);
    if (!title.valid) return res.status(400).json({ error: title.error });
    if (!description.valid) return res.status(400).json({ error: description.error });

    const { rows } = await pool.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING id, title, description, created_at, updated_at',
      [title.value, description.value],
    );
    return res.status(201).json(rows[0]);
  }));

  app.patch('/api/tasks/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo.' });

    const hasTitle = Object.hasOwn(req.body ?? {}, 'title');
    const hasDescription = Object.hasOwn(req.body ?? {}, 'description');
    if (!hasTitle && !hasDescription) {
      return res.status(400).json({ error: 'Indica al menos un campo para actualizar.' });
    }

    const title = hasTitle
      ? validateText(req.body.title, 'El título', MAX_TITLE_LENGTH, { required: true })
      : { valid: true };
    const description = hasDescription
      ? validateText(req.body.description, 'La descripción', MAX_DESCRIPTION_LENGTH)
      : { valid: true };
    if (!title.valid) return res.status(400).json({ error: title.error });
    if (!description.valid) return res.status(400).json({ error: description.error });

    const fields = [];
    const values = [];
    if (hasTitle) {
      values.push(title.value);
      fields.push(`title = $${values.length}`);
    }
    if (hasDescription) {
      values.push(description.value);
      fields.push(`description = $${values.length}`);
    }
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, title, description, created_at, updated_at`,
      values,
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró la tarea.' });
    return res.json(rows[0]);
  }));

  app.delete('/api/tasks/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo.' });

    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No se encontró la tarea.' });
    return res.status(204).end();
  }));

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
    }
    if (error.message === 'Origen no permitido por CORS.') {
      return res.status(403).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'Ocurrió un error interno.' });
  });

  return app;
}
