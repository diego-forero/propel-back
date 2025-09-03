import 'dotenv/config';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { categories, questions, participants, needs } from '../src/db/schema.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';

const BASE_CATS = [
  { name: 'Salud', slug: 'salud' },
  { name: 'Educación', slug: 'educacion' },
  { name: 'Empleo', slug: 'empleo' },
];

const BASE_QUESTIONS = [
  { prompt: '¿Cuál crees que es la mayor necesidad en tu comunidad?' }, // id=1
  { prompt: '¿Qué acción concreta propondrías para mejorar esa situación?' }, // id=2
];

beforeAll(async () => {
  // Ejecuta migraciones sobre la DB de TEST
  await migrate(db, { migrationsFolder: 'drizzle' });

  // Seed mínimo (idempotente)
  for (const c of BASE_CATS) {
    await db.insert(categories).values(c).onConflictDoNothing();
  }
  for (const q of BASE_QUESTIONS) {
    await db.insert(questions).values(q).onConflictDoNothing();
  }
});

afterEach(async () => {
  // Limpia datos variables entre tests
  await db.delete(needs);
  await db.delete(participants);
});

afterAll(async () => {
  // Cierra pool PG
  await pool.end();
});

describe('API health & catalogs', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.now).toBeTruthy();
  });

  it('GET /categories returns list', async () => {
    const res = await request(app).get('/categories').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /questions returns list', async () => {
    const res = await request(app).get('/questions').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Participants & Needs flow', () => {
  const email = 'test@example.com';

  it('register participant and create needs P1 + P2', async () => {
    // register
    const pRes = await request(app)
      .post('/participants/register')
      .send({ name: 'Test', email })
      .expect(201);

    expect(pRes.body.email).toBe(email);

    // need P1 (category required)
    const n1 = await request(app)
      .post('/needs')
      .send({
        email,
        questionId: 1,
        categorySlug: 'salud',
        description: 'No hay hospital',
      })
      .expect(201);

    expect(n1.body.description).toContain('hospital');

    // need P2 (no category)
    const n2 = await request(app)
      .post('/needs')
      .send({
        email,
        questionId: 2,
        description: 'Brigadas médicas',
      })
      .expect(201);

    expect(n2.body.description).toContain('Brigadas');

    // responses enriched
    const resp = await request(app).get('/responses').expect(200);
    expect(resp.body.length).toBe(2);
    expect(resp.body[0]).toHaveProperty('participant_name');
    expect(resp.body[0]).toHaveProperty('question');

    // stats
    const stats = await request(app).get('/stats/categories').expect(200);
    const salud = stats.body.find((s: any) => s.slug === 'salud');
    expect(salud?.count).toBe(1);
  });

  it('rejects P1 without category', async () => {
    await request(app)
      .post('/participants/register')
      .send({ name: 'Test', email })
      .expect(201);

    const bad = await request(app)
      .post('/needs')
      .send({
        email,
        questionId: 1,
        description: 'Falta hospital',
      })
      .expect(400);

    expect(bad.body.error).toBeTruthy();
  });

  it('404 if participant not registered', async () => {
    const res = await request(app)
      .post('/needs')
      .send({
        email: 'noreg@example.com',
        questionId: 2,
        description: 'Algo',
      })
      .expect(404);

    expect(res.body.error).toMatch(/Participant not found/i);
  });
});
