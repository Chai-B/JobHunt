# JobHunt - Online Deployment Guide (Production)

This guide explains how to deploy JobHunt to a live server (VPS) using Docker Compose and Caddy for automatic SSL (HTTPS).

## 1. Choose a Provider

For the best experience with this stack, use a VPS (Virtual Private Server) with at least **2GB RAM**.
- **Low Cost/Free Tier Options**: DigitalOcean (Droplets), AWS (Lightsail/EC2), Hetzner, or Linode.
- **PaaS Options**: If you prefer not to manage a server, you can use **Railway.app** or **Render.com** (though you would need to set up each service individually there).

---

## 2. Server Preparation (VPS)

Once you have your server (Ubuntu 22.04+ recommended):

1. **Install Docker and Docker Compose**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Clone the Project**:
   ```bash
   git clone https://github.com/Chai-B/JobHunt.git
   cd JobHunt
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   *Update `SECRET_KEY`, `POSTGRES_PASSWORD`, and `NEXT_PUBLIC_API_URL` (should be your domain or IP).*

---

## 3. SSL & Reverse Proxy (Caddy)

To make the app accessible over HTTPS (`https://yourdomain.com`), we recommend using **Caddy**. It handles SSL certificates automatically.

1. **Create a `Caddyfile`** in the root directory:
   ```text
   yourdomain.com {
       # Frontend
       reverse_proxy localhost:3000

       # Backend API (optional: expose directly or through a subpath)
       handle /api/* {
           reverse_proxy localhost:8000
       }
   }
   ```

2. **Add Caddy to Docker Compose** (or run it standalone). 

---

## 4. Launching for Production

1. **Build and Start**:
   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```

2. **Run Migrations**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

---

## 5. Deployment Checklist

- [ ] **Firewall**: Ensure ports `80` and `443` are open on your VPS.
- [ ] **DNS**: Point your domain A record to your VPS IP address.
- [ ] **Security**: Ensure `DEBUG` modes are off in your environment.
- [ ] **AI Keys**: Log in to the app and set your Gemini API key in the **Settings** page.

---

## 6. Maintenance & Updates

When you push new code to GitHub:
```bash
git pull origin main
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

---

## Alternative: Simple One-Click Deployments (PaaS)

If setting up a VPS is too complex, we suggest **Railway.app**:
1. Connect your GitHub repository.
2. Railway will detect the `docker-compose.yml` or the Dockerfiles.
3. Add your environment variables in the Railway dashboard.
4. It will provide a public URL automatically.
