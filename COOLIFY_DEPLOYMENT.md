# BookFlow - Coolify Deployment Guide

## Quick Deploy

### 1. Create New Service in Coolify

1. Go to Coolify Dashboard → Projects → Add New Resource
2. Select **Docker Compose** or **Dockerfile**
3. Connect your Git repository containing BookFlow

### 2. Configure Build Settings

**Build Type:** Dockerfile

**Build Arguments** (Add in Coolify UI → Build Settings):
```
VITE_API_URL=/api
VITE_SUPABASE_URL=http://supabasekong-i444wwg4k0scg0gw8scok480.24.222.23.222.sslip.io
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MjA1ODY2MCwiZXhwIjo0OTI3NzMyMjYwLCJyb2xlIjoiYW5vbiJ9.0pSgVu47rggKnWjUk4faDt-H9JscIXicfoMmwmQHi20
```

### 3. Configure Environment Variables

Go to **Environment Variables** and add:

```env
NODE_ENV=production
PORT=8682
SUPABASE_URL=http://supabasekong-i444wwg4k0scg0gw8scok480.24.222.23.222.sslip.io
SUPABASE_SERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MjA1ODY2MCwiZXhwIjo0OTI3NzMyMjYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.lESUFNtpWj2t0L76NIMmgafwobXU75lk6Ru846mV6xE
JWT_SECRET=oPUTGTVzKvvpyCY7k4errvyXXHLS7rY1
```

### 4. Configure Network Settings

- **Port:** 8682
- **Health Check Path:** `/api/health`
- **Domain:** Set your desired domain (e.g., `bookflow.yourdomain.com`)

### 5. Run Database Migrations

Before first deployment, run the migrations against your Supabase instance.

**Option A: Via Coolify Terminal**
```bash
# Connect to the Supabase database
psql "postgresql://postgres:bVEmhSSiYxnLv2R7prpcwVGi9PyhX8px@supabase-db:5432/postgres"

# Run the migration
\i /app/migrations/001_bookflow_schema.sql
```

**Option B: Via local connection**
```bash
# From your local machine with access to the server
psql "postgresql://postgres:bVEmhSSiYxnLv2R7prpcwVGi9PyhX8px@24.222.23.222:5432/postgres" \
  -f migrations/001_bookflow_schema.sql
```

### 6. Deploy

Click **Deploy** in Coolify. The build will:
1. Build React client with Vite (using build args)
2. Create production Node.js server
3. Start on port 8682

---

## Environment Variables Reference

### Runtime Variables (Server)

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `8682` | Server port |
| `SUPABASE_URL` | `http://supabasekong-...sslip.io` | Supabase Kong URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Service role key |
| `JWT_SECRET` | `oPUTGTVz...` | JWT signing secret |

### Build Arguments (Client)

| Argument | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `/api` | API base path |
| `VITE_SUPABASE_URL` | `http://supabasekong-...sslip.io` | Supabase URL for client |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |

---

## Coolify Service Configuration

### Using Docker Compose

If you prefer docker-compose, use `docker-compose.coolify.yml`:

1. In Coolify, select **Docker Compose** as deployment type
2. Point to `docker-compose.coolify.yml`
3. Add environment variables in Coolify UI

### Health Check

The app exposes `/api/health` endpoint. Configure in Coolify:
- **Path:** `/api/health`
- **Interval:** 30s
- **Timeout:** 10s

---

## Connecting to Coolify Supabase

Your Supabase instance is running on Coolify with these connection details:

| Service | URL |
|---------|-----|
| Kong API | `http://supabasekong-i444wwg4k0scg0gw8scok480.24.222.23.222.sslip.io` |
| Postgres | `supabase-db:5432` (internal) or `24.222.23.222:5432` (external) |
| Studio | Check your Coolify Supabase service for Studio URL |

### Database Schema

BookFlow uses the `bookflow` schema. Make sure to run:
```sql
CREATE SCHEMA IF NOT EXISTS bookflow;
```

Then run all migrations in `migrations/` folder.

---

## Troubleshooting

### Build fails
- Verify build arguments are set correctly in Coolify
- Check that VITE_* variables are in Build Settings, not just Environment Variables

### Can't connect to Supabase
- Ensure BookFlow service is on the same Docker network as Supabase
- Use internal hostname `supabase-kong` if on same network
- Use external URL if on different network

### Auth not working
- Verify JWT_SECRET matches your Supabase JWT secret
- Check SUPABASE_SERVICE_KEY is the service_role key (not anon)

### View logs
```bash
# In Coolify, go to your service → Logs
# Or via Docker:
docker logs bookflow-container-name
```

---

## Migration Script

To run all migrations at once:

```bash
#!/bin/bash
DB_URL="postgresql://postgres:bVEmhSSiYxnLv2R7prpcwVGi9PyhX8px@supabase-db:5432/postgres"

for migration in migrations/*.sql; do
    echo "Running $migration..."
    psql "$DB_URL" -f "$migration"
done
echo "All migrations complete!"
```
