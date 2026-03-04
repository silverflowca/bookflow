# BookFlow - Railway Deployment Guide

## Prerequisites

1. **Supabase Cloud Project**
   - Go to [supabase.com](https://supabase.com) and create a project
   - Run the database migration in `migrations/` against your Supabase database
   - Note your Project URL, Service Role Key, and Anon Key

2. **Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub repository

## Deployment Steps

### 1. Create Railway Service

1. Go to Railway Dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the `bookflow` folder from your repo
4. Railway will detect the Dockerfile automatically

### 2. Set Environment Variables

In Railway service settings, add these variables:

**Required:**
```
NODE_ENV=production
PORT=8682

# Supabase (from your Supabase project settings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
SUPABASE_ANON_KEY=eyJhbGci...

# Security
JWT_SECRET=<generate with: openssl rand -base64 32>

# Client URL (your Railway domain or custom domain)
CLIENT_URL=https://your-app.up.railway.app
```

**Optional Integrations:**
```
FILEFLOW_URL=https://your-fileflow.up.railway.app
CHANGEFLOW_URL=https://your-changeflow.up.railway.app
DEEPGRAM_API_KEY=<for TTS functionality>
```

### 3. Set Build Arguments

For the client-side build, set these as Railway build variables:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_URL=/api
```

### 4. Database Setup

Run the migration SQL against your Supabase database:

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/001_bookflow_schema.sql`
3. Execute the SQL

### 5. Storage Setup

In Supabase Dashboard:
1. Go to Storage → Create new bucket named `files`
2. Set bucket to Public (for cover images)
3. Add storage policy for authenticated uploads

## Verify Deployment

1. Check health endpoint: `https://your-app.up.railway.app/api/health`
2. Access the app: `https://your-app.up.railway.app`

## Custom Domain (Optional)

1. In Railway → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `CLIENT_URL` environment variable

## Troubleshooting

**Build fails:**
- Check Railway build logs
- Ensure all required build args are set

**API errors:**
- Check that SUPABASE_URL and keys are correct
- Verify database migration ran successfully

**Cover images not loading:**
- Ensure VITE_SUPABASE_URL is set correctly
- Check Supabase storage bucket is public
