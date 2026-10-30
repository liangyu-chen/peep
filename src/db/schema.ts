import { pgTable, serial, text, integer, boolean, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import type { Look } from '../content/catalog';

export const menuItems = pgTable('menu_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  price: integer('price'),                                  // null shows as $??? on the paper menu
  iced: boolean('iced').notNull().default(true),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dialogueLines = pgTable('dialogue_lines', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),                     // one of LINE_KEYS, e.g. 'owner.greetRegular'
  text: text('text').notNull(),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('dialogue_lines_category_idx').on(t.category)]);

// the regulars: who they are, what they drink, which team they play, how they look
export const regulars = pgTable('regulars', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  job: text('job').notNull().default(''),
  drink: text('drink').notNull().default(''),
  team: text('team').notNull().default('湖人'),
  visits: integer('visits').notNull().default(1),
  quirk: text('quirk').notNull().default(''),
  look: jsonb('look').$type<Look>().notNull(),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// values first-time customers are randomly made from, one row per value
export const randomValues = pgTable('random_values', {
  id: serial('id').primaryKey(),
  pool: text('pool').notNull(),                             // one of POOL_KEYS: surname, titleF, titleM, job
  value: text('value').notNull(),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('random_values_pool_value_idx').on(t.pool, t.value)]);
