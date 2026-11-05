import { eq, or, sql } from 'drizzle-orm';
import BizError from '../error/biz-error';
import user from '../entity/user';
import orm from '../entity/orm';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';

const notificationEmailService = {
	async setEmail(c, userId, rawEmail) {
		const email = String(rawEmail ?? '').trim().toLowerCase();
		if (email && !verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		const currentUser = await orm(c).select().from(user).where(eq(user.userId, userId)).get();
		if (!currentUser) {
			throw new BizError(t('authExpired'), 401);
		}
		if (email && email === currentUser.email.toLowerCase()) {
			throw new BizError(t('notificationEmailSame'));
		}

		if (email) {
			const existing = await orm(c).select({ userId: user.userId }).from(user).where(or(
				sql`${user.email} COLLATE NOCASE = ${email}`,
				sql`${user.notificationEmail} COLLATE NOCASE = ${email}`
			)).get();
			if (existing && existing.userId !== userId) {
				throw new BizError(t('notificationEmailInUse'));
			}
		}

		await orm(c).update(user).set({ notificationEmail: email }).where(eq(user.userId, userId)).run();
		return { notificationEmail: email };
	}
};

export default notificationEmailService;
