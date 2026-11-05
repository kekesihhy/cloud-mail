import { and, count, desc, eq, ne } from 'drizzle-orm';
import BizError from '../error/biz-error';
import broadcast from '../entity/broadcast';
import user from '../entity/user';
import orm from '../entity/orm';
import emailService from './email-service';
import userContext from '../security/user-context';
import emailUtils from '../utils/email-utils';
import { isDel, userConst } from '../const/entity-const';
import KvConst from '../const/kv-const';
import { t } from '../i18n/i18n';

const BROADCAST_PENDING = 0;
const BROADCAST_SENDING = 1;
const BROADCAST_DONE = 2;
const RECIPIENT_PENDING = 0;
const RECIPIENT_SENT = 1;
const RECIPIENT_FAILED = 2;
const BATCH_SIZE = 25;

const broadcastService = {
	assertAdmin(c) {
		if (userContext.getUser(c)?.email !== c.env.admin) {
			throw new BizError(t('unauthorized'), 403);
		}
	},

	async recipientCount(c) {
		this.assertAdmin(c);
		const row = await orm(c).select({ total: count() }).from(user).where(and(
			eq(user.isDel, isDel.NORMAL),
			eq(user.status, userConst.status.NORMAL),
			ne(user.notificationEmail, '')
		)).get();
		return row.total;
	},

	async create(c, params) {
		this.assertAdmin(c);
		const subject = String(params.subject || '').replace(/[\r\n]+/g, ' ').trim();
		const content = String(params.content || '').trim();
		if (!subject || subject.length > 150 || !content || content.length > 20000) {
			throw new BizError(t('broadcastContentInvalid'));
		}

		const currentUser = userContext.getUser(c);
		const recipients = await orm(c).select({ userId: user.userId, email: user.notificationEmail }).from(user).where(and(
			eq(user.isDel, isDel.NORMAL),
			eq(user.status, userConst.status.NORMAL),
			ne(user.notificationEmail, '')
		)).all();
		if (!recipients.length) {
			throw new BizError(t('broadcastNoRecipients'));
		}

		const created = await c.env.db.prepare(`
			INSERT INTO broadcast (subject, content, recipient_count, status, created_by)
			VALUES (?, ?, ?, ?, ?)
			RETURNING broadcast_id
		`).bind(subject, content, recipients.length, BROADCAST_PENDING, currentUser.userId).first();
		const broadcastId = created.broadcast_id;

		try {
			for (let start = 0; start < recipients.length; start += 30) {
				const part = recipients.slice(start, start + 30);
				const values = part.map(() => '(?, ?, ?)').join(', ');
				const bindings = part.flatMap(item => [broadcastId, item.userId, item.email]);
				await c.env.db.prepare(`INSERT INTO broadcast_recipient (broadcast_id, user_id, email) VALUES ${values}`)
					.bind(...bindings).run();
			}
		} catch (error) {
			await c.env.db.prepare(`DELETE FROM broadcast_recipient WHERE broadcast_id = ?`).bind(broadcastId).run();
			await c.env.db.prepare(`UPDATE broadcast SET status = ?, recipient_count = 0, complete_time = CURRENT_TIMESTAMP WHERE broadcast_id = ?`)
				.bind(BROADCAST_DONE, broadcastId).run();
			throw error;
		}
		await c.env.db.prepare(`UPDATE broadcast SET status = ? WHERE broadcast_id = ?`).bind(BROADCAST_SENDING, broadcastId).run();

		return { broadcastId, recipientCount: recipients.length, status: BROADCAST_SENDING };
	},

	async latest(c) {
		this.assertAdmin(c);
		return await orm(c).select().from(broadcast).orderBy(desc(broadcast.broadcastId)).limit(1).get() || null;
	},

	async processScheduled(env) {
		const job = await env.db.prepare(`
			SELECT * FROM broadcast WHERE status = ? ORDER BY broadcast_id ASC LIMIT 1
		`).bind(BROADCAST_SENDING).first();
		if (!job) return;

		const { results = [] } = await env.db.prepare(`
			SELECT * FROM broadcast_recipient
			WHERE broadcast_id = ? AND status = ?
			ORDER BY recipient_id ASC LIMIT ?
		`).bind(job.broadcast_id, RECIPIENT_PENDING, BATCH_SIZE).all();

		const setting = await env.kv.get(KvConst.SETTING, { type: 'json' });
		for (const recipient of results) {
			try {
				await this.sendOne(env, setting, job, recipient);
				await env.db.prepare(`UPDATE broadcast_recipient SET status = ?, error = '', send_time = CURRENT_TIMESTAMP WHERE recipient_id = ?`)
					.bind(RECIPIENT_SENT, recipient.recipient_id).run();
				await env.db.prepare(`UPDATE broadcast SET sent_count = sent_count + 1 WHERE broadcast_id = ?`).bind(job.broadcast_id).run();
			} catch (error) {
				const message = String(error?.message || 'Send failed').slice(0, 500);
				await env.db.prepare(`UPDATE broadcast_recipient SET status = ?, error = ?, send_time = CURRENT_TIMESTAMP WHERE recipient_id = ?`)
					.bind(RECIPIENT_FAILED, message, recipient.recipient_id).run();
				await env.db.prepare(`UPDATE broadcast SET failed_count = failed_count + 1 WHERE broadcast_id = ?`).bind(job.broadcast_id).run();
			}
		}

		const { pending } = await env.db.prepare(`SELECT COUNT(*) AS pending FROM broadcast_recipient WHERE broadcast_id = ? AND status = ?`)
			.bind(job.broadcast_id, RECIPIENT_PENDING).first();
		if (!pending) {
			await env.db.prepare(`UPDATE broadcast SET status = ?, complete_time = CURRENT_TIMESTAMP WHERE broadcast_id = ?`)
				.bind(BROADCAST_DONE, job.broadcast_id).run();
		}
	},

	async sendOne(env, setting, job, recipient) {
		if (!env.admin) throw new Error('Administrator sender address is not configured');
		const lines = job.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/\"/g, '&quot;').replace(/'/g, '&#39;').replace(/\r?\n/g, '<br>');
		const params = {
			name: setting?.title || 'UCCU Mail',
			accountEmail: env.admin,
			receiveEmail: [recipient.email],
			subject: job.subject,
			text: job.content,
			html: `<div style="font-family:Arial,sans-serif;white-space:normal;line-height:1.6">${lines}</div>`,
			attachments: []
		};

		if (env.email) {
			await emailService.sendByCloudflareEmail({ env }, params);
			return;
		}

		const resendToken = setting?.resendTokens?.[emailUtils.getDomain(env.admin)];
		if (!resendToken) throw new Error('No external email provider is configured');
		const response = await emailService.sendByResend(resendToken, params);
		if (response?.error) throw new Error(response.error.message || 'Send failed');
	}
};

export default broadcastService;
