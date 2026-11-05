import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const broadcastRecipient = sqliteTable('broadcast_recipient', {
	recipientId: integer('recipient_id').primaryKey({ autoIncrement: true }),
	broadcastId: integer('broadcast_id').notNull(),
	userId: integer('user_id').notNull(),
	email: text('email').notNull(),
	status: integer('status').default(0).notNull(),
	error: text('error').default('').notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	sendTime: text('send_time')
});

export default broadcastRecipient;
