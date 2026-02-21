# JobHunt - Production Deployment Guide

This guide provides the **exact, step-by-step instructions** for deploying the JobHunt stack using your **$100 Azure credits** for the backend, **Supabase** for the database, **Clerk** for authentication, and **Vercel** for the frontend.

By the end of this guide, your frontend will be securely hosted on Vercel, establishing a secure (HTTPS) connection to your backend running on an Azure Virtual Machine.

---

## Step 1: Set up Auth (Clerk)

1. Go to [Clerk.com](https://clerk.com) and sign up/log in.
2. Click **Create Application**.
3. Select **Google** and **GitHub** as the sign-in options. Name your app "JobHunt".
4. Once the app is created, go to **API Keys** in the sidebar.
5. Save the **Publishable Key** (`pk_...`) and the **Secret Key** (`sk_...`). Keep these handy.

---

## Step 2: Set up Database (Supabase)

Supabase provides a free PostgreSQL database with `pgvector` enabled by default.

1. Go to [Supabase.com](https://supabase.com) and create a **New Project**.
2. Set a strong **Database Password** and select the region closest to where you will create your Azure VM. Click "Create new project".
3. Wait for the database to provision (takes a few minutes).
4. Go to **Project Settings** (gear icon) -> **Database**.
5. Scroll down to **Connection Parameters** / **Connection String**.
6. Switch to the **URI** tab. It will look something like this:
   `postgresql://postgres.xxx:YOUR-PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres`
7. Replace `[YOUR-PASSWORD]` with your actual password.
8. **CRITICAL:** Change the `postgresql://` part to `postgresql+asyncpg://`.
   *Your final `DATABASE_URL` should look like:*
   `postgresql+asyncpg://postgres.xxx:mypassword@aws-0-...pooler.supabase.com:6543/postgres`
9. Save this URL.

---

## Step 3: Set up Backend (Azure VPS)

Vercel forces your frontend to use HTTPS. Because of this, your API must also use HTTPS. We use Azure's free DNS label feature + Caddy to automatically get an SSL certificate without needing to buy a domain.

### 3.1 Create the Virtual Machine
1. Go to the [Azure Portal](https://portal.azure.com/).
2. Search for **Virtual Machines** and click **Create -> Azure Virtual Machine**.
3. **Basics Tab**:
   - **Resource Group**: Click "Create new" -> `jobhunt-rg`.
   - **Virtual machine name**: `jobhunt-api`.
   - **Region**: Pick the one closest to you (same as Supabase).
   - **Image**: Select **Ubuntu Server 22.04 LTS**.
   - **Size**: Since you have credits, select `Standard_B2s` (2 vCPUs, 4GB RAM). This is highly recommended for smooth AI processing and will run perfectly on your credits.
   - **Authentication type**: SSH public key (or password if you prefer).
   - **Inbound port rules**: Allow SSH (22), HTTP (80), and HTTPS (443).
4. Click **Review + Create**. Wait for the deployment to finish.

### 3.2 Configure Azure DNS
1. Once deployed, click **Go to resource**.
2. On the VM's Overview page, look for the **DNS name** property (it will say "Not configured").
3. Click **Not configured**.
4. Set a **DNS name label** (e.g., `myjobhunt-api`).
5. Save it. You will now have a full domain structure like:
   `myjobhunt-api.eastus.cloudapp.azure.com`
6. **Copy this full exact domain.**

### 3.3 Install Dependencies
1. SSH into your VM using the terminal on your personal computer:
   ```bash
   ssh azureuser@myjobhunt-api.eastus.cloudapp.azure.com
   ```
2. Once inside the Azure terminal, install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
3. Allow running Docker without `sudo`:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

### 3.4 Deploy the Backend
1. Clone your GitHub repository (replace with your actual GitHub repo URL):
   ```bash
   git clone https://github.com/Chai-B/JobHunt.git
   cd JobHunt
   ```
2. Create the environment file:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Paste/edit the following values precisely:
   ```env
   # Database (From Step 2)
   DATABASE_URL=postgresql+asyncpg://postgres.xxx...

   # Redis (Keep these as they are, Redis runs locally in Docker)
   CELERY_BROKER_URL=redis://redis:6379/0
   CELERY_RESULT_BACKEND=redis://redis:6379/0

   # Security
   SECRET_KEY=put_a_long_random_string_here_like_dj8923je82db

   # Clerk (From Step 1)
   CLERK_SECRET_KEY=sk_test_...

   # API Domain (From Step 3.2) - NO http:// prefix!
   API_DOMAIN=myjobhunt-api.eastus.cloudapp.azure.com
   ```
   *Press `Ctrl+X`, then `Y`, then `Enter` to save and exit.*

4. Build and start the production environment:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. Apply the database tables to Supabase:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
   ```

*(Wait about 1-2 minutes for Caddy to automatically fetch the SSL certificate from Let's Encrypt).*
You can verify it works by visiting your API Domain in a browser: `https://myjobhunt-api.eastus.cloudapp.azure.com/api/v1/health`

---

## Step 4: Set up Frontend (Vercel)

1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your `JobHunt` repository.
4. In the **Configure Project** section:
   - Framework Preset should automatically be **Next.js**.
   - **Root Directory**: Click "Edit", navigate into `frontend`, and select it.
5. Expand the **Environment Variables** section and add:
   - Name: `NEXT_PUBLIC_API_URL`
     Value: `https://myjobhunt-api.eastus.cloudapp.azure.com` *(Must include `https://`)*
   - Name: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     Value: `pk_test_...` *(From Step 1)*
6. Click **Deploy**.

---

## Step 5: Final Verification

1. Once Vercel finishes deploying, click **Continue to Dashboard** and visit your new public site URL.
2. Click **Sign Up**. You should see the Clerk Google/GitHub buttons inside the custom UI.
3. Sign into the dashboard.
4. Click **Settings** in the bottom-left corner of the sidebar.
5. Input your **Google Gemini API Key**. You can get this for free from [Google AI Studio](https://aistudio.google.com/app/apikey).
6. Upload a resume on the **Resumes** tab and ensure it processes successfully.

**Congratulations!** The full app is now live, secure, and processing jobs.

### Routine Maintenance
To update the backend with new code:
```bash
ssh azureuser@myjobhunt-api.eastus.cloudapp.azure.com
cd JobHunt
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```
