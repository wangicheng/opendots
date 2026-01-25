import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('/*', cors());

// Helper to get user ID from header
const getUserId = (c: any) => c.req.header('x-user-id');

// ==================== Levels ====================

// Get all published levels
app.get('/levels', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM levels WHERE is_published = 1 ORDER BY created_at DESC LIMIT 50`
  ).all();

  const levels = results.map((row: any) => {
    const data = JSON.parse(row.data);
    return {
      ...data,
      likes: row.likes,
      attempts: row.attempts,
      clears: row.clears,
      authorId: row.author_id, // Ensure consistent authorId
    };
  });

  return c.json(levels);
});

// Get specific level
app.get('/levels/:id', async (c) => {
  const id = c.req.param('id');
  const level = await c.env.DB.prepare('SELECT * FROM levels WHERE id = ?').bind(id).first();

  if (!level) return c.json({ error: 'Level not found' }, 404);

  const data = JSON.parse(level.data as string);
  return c.json({
    ...data,
    likes: level.likes,
    attempts: level.attempts,
    clears: level.clears,
  });
});

// Publish level
app.post('/levels/:id/publish', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const userId = getUserId(c) || body.authorId;

  if (!userId) {
    return c.json({ error: 'Unauthorized: Missing User ID' }, 401);
  }

  // Ensure basic fields
  const levelData = { ...body, id, authorId: userId, isPublished: true };
  const json = JSON.stringify(levelData);

  // Upsert level
  const query = `
    INSERT INTO levels (id, author_id, author_name, data, is_published, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      is_published = 1,
      updated_at = excluded.updated_at
  `;

  await c.env.DB.prepare(query)
    .bind(id, userId, body.author || 'Anonymous', json, Date.now())
    .run();

  return c.json({ success: true });
});

// Unpublish level
app.post('/levels/:id/unpublish', async (c) => {
  const id = c.req.param('id');
  // In a real app, verify author ownership here using x-user-id
  await c.env.DB.prepare('UPDATE levels SET is_published = 0, updated_at = ? WHERE id = ?')
    .bind(Date.now(), id)
    .run();

  return c.json({ success: true });
});

// Delete level
app.delete('/levels/:id', async (c) => {
  const id = c.req.param('id');
  // In a real app, check ownership
  await c.env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Like level
app.post('/levels/:id/like', async (c) => {
  const levelId = c.req.param('id');
  const userId = getUserId(c);

  if (!userId) return c.json({ error: 'User ID required' }, 401);

  // Check if already liked
  const existing = await c.env.DB.prepare('SELECT * FROM likes WHERE user_id = ? AND level_id = ?')
    .bind(userId, levelId)
    .first();

  let liked = false;
  if (existing) {
    // Unlike
    await c.env.DB.prepare('DELETE FROM likes WHERE user_id = ? AND level_id = ?')
      .bind(userId, levelId)
      .run();
    await c.env.DB.prepare('UPDATE levels SET likes = likes - 1 WHERE id = ?')
      .bind(levelId)
      .run();
  } else {
    // Like
    await c.env.DB.prepare('INSERT INTO likes (user_id, level_id) VALUES (?, ?)')
      .bind(userId, levelId)
      .run();
    await c.env.DB.prepare('UPDATE levels SET likes = likes + 1 WHERE id = ?')
      .bind(levelId)
      .run();
    liked = true;
  }

  return c.json({ liked });
});

// Get likes count
app.get('/levels/:id/likes', async (c) => {
  const id = c.req.param('id');
  const level = await c.env.DB.prepare('SELECT likes FROM levels WHERE id = ?').bind(id).first();
  return c.json({ count: level?.likes || 0 });
});

// Record stats (Attempt)
app.post('/levels/:id/attempt', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE levels SET attempts = attempts + 1 WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Record stats (Clear)
app.post('/levels/:id/clear', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE levels SET clears = clears + 1 WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==================== Users ====================

// Get Current User (Me)
app.get('/users/me', async (c) => {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: 'User ID required' }, 401);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json({
    id: user.id,
    name: user.name,
    avatarColor: user.avatar_color,
    avatarUrl: user.avatar_url,
    githubUsername: user.github_username,
  });
});

// Update Current User
app.put('/users/me', async (c) => {
  const body = await c.req.json();
  const userId = getUserId(c) || body.id; // Allow ID in body for initial sync

  if (!userId) return c.json({ error: 'User ID required' }, 401);

  await c.env.DB.prepare(`
    INSERT INTO users (id, name, avatar_color, avatar_url, github_username, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      avatar_color = excluded.avatar_color,
      avatar_url = excluded.avatar_url,
      github_username = excluded.github_username,
      last_seen = excluded.last_seen
  `).bind(
    userId,
    body.name,
    body.avatarColor,
    body.avatarUrl,
    body.githubUsername,
    Date.now()
  ).run();

  return c.json(body);
});

// Get User by ID
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

  if (!user) return c.json(null); // Return null as expected by client

  return c.json({
    id: user.id,
    name: user.name,
    avatarColor: user.avatar_color,
    avatarUrl: user.avatar_url,
    githubUsername: user.github_username,
  });
});

// Get User Levels
app.get('/users/:id/levels', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM levels WHERE author_id = ? AND is_published = 1 ORDER BY created_at DESC'
  ).bind(id).all();

  const levels = results.map((row: any) => {
    const data = JSON.parse(row.data);
    return {
      ...data,
      likes: row.likes,
      attempts: row.attempts,
      clears: row.clears,
    };
  });

  return c.json(levels);
});

export default app;
