# OpenDots Backend

This is the Cloudflare Worker backend for OpenDots. It handles level storage, user profiles, and stats using Cloudflare D1 (SQLite).

## Prerequisites
- Node.js
- Cloudflare Account (for deployment)

## Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Create D1 Database** (One time)
   ```bash
   npx wrangler d1 create opendots-db
   ```
   Copy the `database_id` from the output and paste it into `wrangler.toml` in the `database_id` field.

3. **Initialize Database Schema**
   ```bash
   npm run db:init
   ```
   This creates the tables in your **local** development database (`.wrangler/state/...`).
   To apply to production later, add `--remote` (after setting up the ID).

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:8787`.

## Deployment

1. **Apply Schema to Production**
   ```bash
   npx wrangler d1 execute opendots-db --remote --file=./src/schema.sql
   ```

2. **Deploy Worker**
   ```bash
   npm run deploy
   ```

## API Endpoints
- `GET /levels`: List published levels
- `POST /levels/:id/publish`: Publish a level
- `GET /users/me`: Get current user info (requires `x-user-id` header, handled by client)
