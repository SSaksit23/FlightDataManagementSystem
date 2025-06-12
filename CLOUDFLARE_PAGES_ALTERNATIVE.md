# 🌐 Alternative: Cloudflare Pages + Railway Backend

## Split Architecture Deployment

If you want to use Cloudflare Pages specifically, you'll need to split your application:

### Architecture:
- **Frontend**: Cloudflare Pages (Static React build)
- **Backend**: Railway (Node.js + Database + Redis)
- **Domain**: Your Cloudflare domain

## 🔧 Step 1: Prepare Frontend for Static Deployment

### Update Frontend Configuration

1. **Build the React app for production**:
```bash
cd frontend
npm run build
```

2. **Create `wrangler.toml` in frontend directory**:
```toml
name = "tour-operator-frontend"
compatibility_date = "2025-06-11"
pages_build_output_dir = "build"

[env.production]
route = "yourdomain.com/*"
```

3. **Create `_headers` file in `frontend/public/`**:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

4. **Create `_redirects` file in `frontend/public/`**:
```
/*    /index.html   200
```

## 🚀 Step 2: Deploy Backend to Railway

1. **Deploy only the backend** to Railway:
   - Follow the Railway deployment guide
   - Deploy backend + PostgreSQL + Redis
   - Get the backend URL (e.g., `https://backend-xxx.railway.app`)

2. **Update CORS in backend** to allow Cloudflare Pages:
```javascript
// backend/server.js
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://tour-operator-frontend.pages.dev'  // Cloudflare Pages URL
  ],
  credentials: true
}));
```

## 🌐 Step 3: Deploy Frontend to Cloudflare Pages

### Method 1: Using Wrangler CLI

1. **Install Wrangler**:
```bash
npm install -g wrangler
```

2. **Login to Cloudflare**:
```bash
wrangler login
```

3. **Deploy from frontend directory**:
```bash
cd frontend
npm run build
wrangler pages deploy build --project-name=tour-operator-frontend
```

### Method 2: Using Cloudflare Dashboard

1. **Go to Cloudflare Dashboard** → Pages
2. **Connect to Git** → Select your repository
3. **Build Settings**:
   - Build command: `cd frontend && npm run build`
   - Build output directory: `frontend/build`
   - Root directory: `/` (or `/frontend` if deploying only frontend)

## ⚙️ Step 4: Configure Environment Variables

### In Cloudflare Pages:
```env
REACT_APP_API_URL=https://your-railway-backend.railway.app/api
REACT_APP_Maps_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

## 🔗 Step 5: Connect Your Domain

1. **In Cloudflare Pages** → Custom domains
2. **Add your domain**: `yourdomain.com`
3. **DNS will auto-configure** since it's already in Cloudflare

## ❌ Limitations of This Approach:

- **More complex setup** (two separate deployments)
- **No server-side rendering** (static React only)
- **CORS configuration needed** (cross-origin requests)
- **Two separate deployment processes** to maintain
- **Higher latency** (frontend and backend in different locations)

## 💰 Cost Comparison:

### Option 1: Railway + Cloudflare Domain
- Railway: ~$15-35/month (full stack)
- Cloudflare: Domain cost only

### Option 2: Cloudflare Pages + Railway Backend  
- Cloudflare Pages: Free (up to 500 builds/month)
- Railway: ~$15-30/month (backend only)
- More complex to maintain

## 🎯 Recommendation:

**Use Option 1 (Railway + Cloudflare Domain)** because:
- ✅ Simpler deployment
- ✅ Everything in one place  
- ✅ Better performance
- ✅ Easier to maintain
- ✅ Full Docker support
- ✅ Your current setup works as-is 