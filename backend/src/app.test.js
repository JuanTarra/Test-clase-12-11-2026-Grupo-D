import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';

const rows = new Map();
let nextId = 1;
let server;
let client;

const pool = {
  async query(sql, values = []) {
    if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
    if (sql.startsWith('SELECT id, title') && sql.includes('ORDER BY')) {
      return { rows: [...rows.values()].sort((a, b) => b.id - a.id) };
    }
    if (sql.startsWith('SELECT id, title') && sql.includes('WHERE id')) {
      return { rows: rows.has(values[0]) ? [rows.get(values[0])] : [] };
    }
    if (sql.startsWith('INSERT INTO tasks')) {
      const now = new Date().toISOString();
      const task = { id: nextId++, title: values[0], description: values[1], created_at: now, updated_at: now };
      rows.set(task.id, task);
      return { rows: [task] };
    }
    if (sql.startsWith('UPDATE tasks')) {
      const id = values.at(-1);
      if (!rows.has(id)) return { rows: [] };
      const task = { ...rows.get(id), updated_at: new Date().toISOString() };
      const assignments = sql.slice('UPDATE tasks SET '.length, sql.indexOf(' WHERE')).split(', ');
      assignments.forEach((assignment, index) => {
        const field = assignment.split(' = ')[0];
        task[field] = values[index];
      });
      rows.set(id, task);
      return { rows: [task] };
    }
    if (sql.startsWith('DELETE FROM tasks')) {
      return { rowCount: rows.delete(values[0]) ? 1 : 0 };
    }
    throw new Error(`Consulta inesperada: ${sql}`);
  },
};

before(async () => {
  server = createApp(pool).listen(0);
  const address = server.address();
  client = request(`http://127.0.0.1:${address.port}`);
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('realiza el flujo de crear, listar, leer, actualizar y eliminar', async () => {
  const created = await client.post('/api/tasks').send({ title: 'Probar deploy', description: 'API y base de datos' });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'Probar deploy');
  const id = created.body.id;

  const list = await client.get('/api/tasks');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const detail = await client.get(`/api/tasks/${id}`);
  assert.equal(detail.body.description, 'API y base de datos');

  const updated = await client.patch(`/api/tasks/${id}`).send({ title: 'Deploy probado' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Deploy probado');

  const deleted = await client.delete(`/api/tasks/${id}`);
  assert.equal(deleted.status, 204);
  assert.equal((await client.get(`/api/tasks/${id}`)).status, 404);
});

test('valida datos requeridos, ids y el origen CORS', async () => {
  assert.equal((await client.post('/api/tasks').send({ title: ' ' })).status, 400);
  assert.equal((await client.get('/api/tasks/abc')).status, 400);
  assert.equal((await client.get('/api/tasks/99999')).status, 404);
  assert.equal(
    (await client.get('/api/tasks').set('Origin', 'https://otro-sitio.example')).status,
    403,
  );
});
