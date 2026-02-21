# JobHunt - Zero-Cost Deployment Guide

This guide explains how to deploy the entire JobHunt stack for **$0/month** using "Free Forever" tiers from various cloud providers.

## 1. The Zero-Cost Stack

| Service | Provider | Free Tier Benefits |
|---------|----------|-------------------|
| **Database** | [Supabase](https://supabase.com) | Free Postgres + pgvector + 500MB storage |
| **Redis** | [Upstash](https://upstash.com) | Free Serverless Redis (10k requests/day) |
| **Frontend** | [Vercel](https://vercel.com) | Free Next.js hosting + SSL + Global CDN |
| **API & Worker** | [Render](https://render.com) | Free Web Services (spins down after inactivity) |

---

## 2. Step-by-Step Setup

### Step 1: Database (Supabase)
1. Create a project on [Supabase](https://supabase.com).
2. Go to **Project Settings > Database**.
3. Copy the **Connection String** (transaction mode, port 6543) and change the protocol to `postgresql+asyncpg://`.
4. *Tip:* Supabase includes `pgvector` by default.

### Step 2: Redis (Upstash)
1. Create a database on [Upstash](https://upstash.com).
2. Copy the **REDIS_URL**. It will look like `redis://default:password@hostname:6379`.

### Step 3: Backend & Worker (Render)
1. Sign up for [Render](https://render.com).
2. **New > Web Service**:
   - Link your GitHub repo.
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: Add everything from `.env.example`.
3. **New > Background Worker** (Optional):
   - Link same repo.
   - Root Directory: `backend`
   - Start Command: `celery -A app.worker.celery_app worker --loglevel=info --concurrency=1`
   - *Note:* Render's free tier for workers is limited; you may need to run the worker on a separate platform like **Railway.app**'s trial or just use the API if you don't need background scraping immediately.

### Step 4: Frontend (Vercel)
1. Sign up for [Vercel](https://vercel.com).
2. **New Project**: Select the `frontend` folder of your repo.
3. **Framework Preset**: Next.js.
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Your Render backend URL.
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: (Optional) From Clerk.
5. Deploy!

---

## 3. Important Notes for Free Tiers

1. **Cold Starts**: Render's free tier "sleeps" if not visited. The first request to the API might take 30 seconds to wake up.
2. **Database Migrations**: You still need to run migrations. You can do this locally by pointing your local `DATABASE_URL` to your Supabase string and running:
   ```bash
   alembic upgrade head
   ```
3. **Secrets**: Never commit your `.env` file to GitHub. Always use the provider's Dashboard to set environment variables.

## 4. Summary Checklist
- [ ] Connect Supabase DB (`pgvector` is ready).
- [ ] Connect Upstash Redis.
- [ ] Deploy Backend to Render.
- [ ] Deploy Frontend to Vercel (point to Render URL).
- [ ] Add Gemini API key inside the app Settings.
