import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const eventState = sqliteTable('event_state', {id:integer('id').primaryKey(),version:integer('version').notNull(),data:text('data').notNull(),publicData:text('public_data')});
export const credentials = sqliteTable('credentials',{id:integer('id').primaryKey(),hash:text('hash').notNull(),salt:text('salt').notNull()});
export const sessions = sqliteTable('sessions',{token:text('token').primaryKey(),expires:integer('expires').notNull()});
export const attempts = sqliteTable('attempts',{id:text('id').primaryKey(),count:integer('count').notNull(),until:integer('until').notNull()});
