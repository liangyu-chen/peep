import { pgTable, serial, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

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
