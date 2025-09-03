import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { eq, sql, desc } from 'drizzle-orm';

import { db } from './db/client.js';
import { categories, questions, participants, needs } from './db/schema.js';

const app = express();

// Ajusta orígenes si lo necesitas (front Vite default: 5173)
app.use(cors({ origin: ['http://localhost:5173'], credentials: false }));
app.use(express.json());

// --- Health ---
app.get('/health', async (_req, res) => {
  const r = await db.execute(sql`SELECT NOW() AS now`);
  res.json({ ok: true, now: r.rows?.[0]?.now ?? null });
});

// --- Catálogos ---
app.get('/categories', async (_req, res) => {
  const rows = await db.select().from(categories).orderBy(categories.name);
  res.json(rows);
});

app.get('/questions', async (_req, res) => {
  const rows = await db.select().from(questions).orderBy(questions.id);
  res.json(rows);
});

// --- Registrar/actualizar participante (email único) ---
const ParticipantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).max(120).optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  phone: z.string().optional(),
});

app.post('/participants/register', async (req, res) => {
  const parsed = ParticipantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;

  const upserted = await db.insert(participants).values(data)
    .onConflictDoUpdate({
      target: participants.email,
      set: {
        name: data.name,
        age: data.age ?? null,
        country: data.country ?? null,
        city: data.city ?? null,
        neighborhood: data.neighborhood ?? null,
        phone: data.phone ?? null,
      },
    })
    .returning();

  res.status(201).json(upserted[0]);
});

// --- Crear necesidad/respuesta ---
const NeedSchema = z.object({
  email: z.string().email(),
  questionId: z.number().int(),
  categorySlug: z.string().min(1).optional(),
  description: z.string().min(1).max(1000),
});

app.post('/needs', async (req, res) => {
  const parsed = NeedSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, questionId, categorySlug, description } = parsed.data;

  // participante por email
  const [p] = await db.select().from(participants).where(eq(participants.email, email)).limit(1);
  if (!p) return res.status(404).json({ error: 'Participant not found. Register first.' });

  // categoría (según reglas)
  let categoryId: number | null = null;

  if (questionId === 1) {
    if (!categorySlug) return res.status(400).json({ error: 'categorySlug is required for question 1' });
    const [c] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    if (!c) return res.status(400).json({ error: 'Invalid categorySlug' });
    categoryId = c.id;
  } else if (categorySlug) {
    const [c] = await db.select().from(categories).where(eq(categories.slug, categorySlug)).limit(1);
    if (c) categoryId = c.id;
  }

  const inserted = await db.insert(needs).values({
    participantId: p.id,
    questionId,
    categoryId,
    description,
  }).returning();

  res.status(201).json(inserted[0]);
});

// --- Listar necesidades (simples) ---
app.get('/needs', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = await db.select().from(needs).orderBy(desc(needs.createdAt)).limit(limit);
  res.json(rows);
});

// --- Respuestas enriquecidas (para mostrar en el front) ---
app.get('/responses', async (req, res) => {
  const qid = req.query.questionId ? Number(req.query.questionId) : undefined;

  const r = await db.execute(sql`
    SELECT
      n.id,
      n.description,
      n.created_at,
      q.prompt AS question,
      p.name   AS participant_name,
      p.email  AS participant_email,
      c.name   AS category_name,
      c.slug   AS category_slug
    FROM needs n
    JOIN participants p ON p.id = n.participant_id
    JOIN questions    q ON q.id = n.question_id
    LEFT JOIN categories c ON c.id = n.category_id
    ${qid ? sql`WHERE n.question_id = ${qid}` : sql``}
    ORDER BY n.created_at DESC
    LIMIT 200
  `);

  res.json(r.rows);
});

// --- Stats por categoría ---
app.get('/stats/categories', async (_req, res) => {
  const r = await db.execute(sql`
    SELECT c.name, c.slug, COALESCE(COUNT(n.id), 0)::int AS count
    FROM categories c
    LEFT JOIN needs n ON n.category_id = c.id
    GROUP BY c.id
    ORDER BY count DESC, c.name ASC
  `);
  res.json(r.rows);
});

const PORT = Number(process.env.PORT ?? '4000');
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
