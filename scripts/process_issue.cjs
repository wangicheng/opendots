const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');
const { z } = require('zod');

const DATA_FILE = process.env.DATA_FILE_PATH || path.join(__dirname, '../public/db/data.json');

// --- Schemas ---

const PayloadSchemas = {
  publish_level: z.object({
    id: z.string().optional(),
    data: z.any(),
  }),
  delete_level: z.object({
    id: z.string(),
  }),
};

// --- Helpers ---

// Simple parser for Issue Form Markdown
function parseIssueBody(body) {
  const lines = body.split('\n');
  const data = {};
  let currentKey = null;
  let buffer = [];

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (currentKey) {
        data[currentKey] = buffer.join('\n').trim();
      }
      currentKey = headingMatch[1].trim();
      buffer = [];
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  if (currentKey) {
    data[currentKey] = buffer.join('\n').trim();
  }
  return data;
}

// --- Main ---

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      // Local dev fallback or warning
      // throw new Error('GITHUB_TOKEN is missing');
    }

    // In a real action, standard 'github.context.payload.issue' works.
    const context = github.context;
    const issue = context.payload.issue;

    if (!issue) {
      throw new Error('No issue payload found');
    }

    console.log(`Processing Issue #${issue.number} by @${issue.user.login}`);

    const bodyData = parseIssueBody(issue.body);
    console.log('Parsed Body Data:', bodyData);

    const username = issue.user.login;
    const action = bodyData['Action Type'];
    const rawPayload = bodyData['Payload'];

    if (!action || !rawPayload) {
      throw new Error('Missing required fields (Action Type, Payload).');
    }

    // Parse Payload JSON
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch (e) {
      throw new Error('Invalid JSON in Payload field');
    }

    // Validate Payload
    const schema = PayloadSchemas[action];
    if (!schema) {
      throw new Error(`Unknown action type: ${action}`);
    }

    const validatedPayload = schema.parse(payload);

    // Load DB
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    }
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

    // Ensure User Exists
    if (!db.users[username]) {
      db.users[username] = { avatar: null, levels: [] };
    }
    const user = db.users[username];

    // Apply Changes
    switch (action) {
      case 'publish_level':
        // Use Issue Number as the Level ID
        const levelId = issue.number.toString();

        const levelData = {
          id: levelId,
          ...validatedPayload.data,
          publishAt: Date.now(),
          updatedAt: new Date().toISOString()
        };

        const existingIndex = user.levels.findIndex(l => l.id === levelId);

        if (existingIndex >= 0) {
          user.levels[existingIndex] = levelData;
        } else {
          user.levels.push(levelData);
        }
        break;

      case 'delete_level':
        user.levels = user.levels.filter(l => l.id !== validatedPayload.id);
        break;
    }

    // Save DB
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    console.log('Database updated successfully');

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
