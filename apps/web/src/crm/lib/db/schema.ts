import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const pipelineStages = sqliteTable('pipeline_stages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  position: integer('position').notNull().default(0),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(), // Telegram userId as string
  telegramId: integer('telegram_id').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name'),
  username: text('username'),
  phone: text('phone'),
  avatarColor: text('avatar_color').notNull().default('#6366f1'),
  pipelineStageId: text('pipeline_stage_id').references(() => pipelineStages.id),
  lastContactedAt: integer('last_contacted_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6366f1'),
});

export const contactTags = sqliteTable('contact_tags', {
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

export const telegramSession = sqliteTable('telegram_session', {
  id: integer('id').primaryKey(),
  sessionString: text('session_string').notNull().default(''),
  phone: text('phone'),
  updatedAt: integer('updated_at').notNull(),
});

export const integrationConfigs = sqliteTable('integration_configs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'notion' | 'gmail'
  config: text('config').notNull().default('{}'), // JSON blob
  enabled: integer('enabled').notNull().default(0),
});

// Relations
export const contactsRelations = relations(contacts, ({ many, one }) => ({
  contactTags: many(contactTags),
  notes: many(notes),
  pipelineStage: one(pipelineStages, {
    fields: [contacts.pipelineStageId],
    references: [pipelineStages.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  contact: one(contacts, {
    fields: [notes.contactId],
    references: [contacts.id],
  }),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contactTags: many(contactTags),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ many }) => ({
  contacts: many(contacts),
}));

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type ContactTag = typeof contactTags.$inferSelect;
