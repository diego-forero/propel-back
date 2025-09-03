import 'dotenv/config';
import { db, pool } from './client.js';
import { categories, questions } from './schema.js';

async function seed() {
  const baseCategories = [
    { name: 'Salud', slug: 'salud' },
    { name: 'Educación', slug: 'educacion' },
    { name: 'Empleo', slug: 'empleo' },
    { name: 'Seguridad', slug: 'seguridad' },
    { name: 'Vivienda', slug: 'vivienda' },
    { name: 'Servicios Públicos', slug: 'servicios-publicos' },
    { name: 'Espacio Público / Medio Ambiente', slug: 'medio-ambiente' },
    { name: 'Movilidad / Transporte', slug: 'movilidad' },
    { name: 'Alimentación', slug: 'alimentacion' },
    { name: 'Cultura / Deporte', slug: 'cultura-deporte' },
  ];
  const baseQuestions = [
    { prompt: '¿Cuál crees que es la mayor necesidad en tu comunidad?' },
    { prompt: '¿Qué acción concreta propondrías para mejorar esa situación?' },
  ];

  for (const c of baseCategories) {
    await db.insert(categories).values(c).onConflictDoNothing();
  }
  for (const q of baseQuestions) {
    await db.insert(questions).values(q).onConflictDoNothing();
  }
}

seed().then(() => console.log('Seed done')).catch(console.error).finally(() => pool.end());
