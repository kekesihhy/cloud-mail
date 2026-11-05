import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const broadcast = sqliteTable('broadcast', {
	broadcastId: integer('broadcast_id').primaryKey({ autoIncrement: true }),
	subject: text('subject').notNull(),
	content: text('content').notNull(),
	recipientCount: integer('recipient_count').default(0).notNull(),
	sentCount: integer('sent_count').default(0).notNull(),
	failedCount: integer('failed_count').default(0).notNull(),
	status: integer('status').default(0).notNull(),
	createdBy: integer('created_by').notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	completeTime: text('complete_time')
});

export default broadcast;
