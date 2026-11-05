import app from '../hono/hono';
import result from '../model/result';
import broadcastService from '../service/broadcast-service';

app.get('/admin/broadcast/recipientCount', async (c) => {
	const total = await broadcastService.recipientCount(c);
	return c.json(result.ok({ total }));
});

app.get('/admin/broadcast/latest', async (c) => {
	const data = await broadcastService.latest(c);
	return c.json(result.ok(data));
});

app.post('/admin/broadcast', async (c) => {
	const data = await broadcastService.create(c, await c.req.json());
	return c.json(result.ok(data));
});
