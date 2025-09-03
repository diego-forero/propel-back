import {
  pgTable, serial, text, integer, timestamp,
  uniqueIndex, index
} from 'drizzle-orm/pg-core';

export const participants = pgTable('participants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  country: text('country'),
  city: text('city'),
  neighborhood: text('neighborhood'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  emailUnique: uniqueIndex('participants_email_unique').on(t.email),
}));

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
}, (t) => ({
  slugUnique: uniqueIndex('categories_slug_unique').on(t.slug),
}));

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// categoryId ahora es opcional (nullable)
export const needs = pgTable('needs', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').notNull()
    .references(() => participants.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id') // <-- sin .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  byParticipant: index('needs_participant_idx').on(t.participantId),
  byCategory: index('needs_category_idx').on(t.categoryId),
}));