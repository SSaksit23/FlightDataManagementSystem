# 🚀 Tour Operator System - Deployment Guide

## Deploy Your Tour Operator System to Your Cloudflare Domain

This guide will help you deploy your Tour Operator System to production using Railway and configure it with your Cloudflare domain.

## Prerequisites

1. ✅ **Cloudflare Domain** - You already have this
2. ✅ **GitHub Account** - For code repository
3. ✅ **Railway Account** - Sign up at [railway.app](https://railway.app)

## 📁 Step 1: Upload Your Code to GitHub

1. Create a new **private** repository on GitHub (to protect your API keys)
2. Upload all your project files to the repository
3. Make sure to include:
   - All frontend files
   - All backend files  
   - Docker files
   - package.json files
   - This deployment guide

## 🚀 Step 2: Deploy to Railway

### A. Deploy the Backend

1. **Sign up/Login to Railway**: Go to [railway.app](https://railway.app)
2. **Create New Project**: Click "New Project"
3. **Deploy from GitHub**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose your uploaded repository
5. **Configure Service**:
   - Service name: `tour-operator-backend`
   - Root directory: `/backend`
6. **Add Environment Variables**:
   ```env
   NODE_ENV=production
   AMADEUS_CLIENT_ID=Bd76Zxmr3DtsAgSCNVhRlgCzzFDROM07
   AMADEUS_CLIENT_SECRET=Onw33473vAI1CTHS
   AMADEUS_HOSTNAME=test
   PORT=5000
   ```

### B. Add Database (PostgreSQL)

1. **In your Railway project**: Click "New Service"
2. **Select PostgreSQL**: Choose PostgreSQL database
3. **Note the connection details** - Railway will auto-generate these
4. **Update backend environment variables** with the database URL

### C. Add Redis Cache

1. **In your Railway project**: Click "New Service"  
2. **Select Redis**: Choose Redis service
3. **Note the connection details** - Railway will auto-generate these

### D. Deploy the Frontend

1. **Add another service**: Click "New Service" → "GitHub Repo"
2. **Same repository**: Select your repository again
3. **Configure Service**:
   - Service name: `tour-operator-frontend`
   - Root directory: `/frontend`
4. **Add Environment Variables**:
   ```env
   REACT_APP_API_URL=https://your-backend-url.railway.app/api
   REACT_APP_Maps_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
   ```

## 🌐 Step 3: Configure Your Cloudflare Domain

### A. Get Railway URLs

1. **Backend URL**: Go to your backend service → Settings → Networking → Generate Domain
2. **Frontend URL**: Go to your frontend service → Settings → Networking → Generate Domain

### B. Set Up Custom Domain in Railway

1. **Go to Frontend Service**: Settings → Networking
2. **Add Custom Domain**: Enter your domain (e.g., `yourdomain.com`)
3. **Note the CNAME target** provided by Railway

### C. Configure DNS in Cloudflare

1. **Login to Cloudflare Dashboard**
2. **Select your domain**
3. **Go to DNS settings**
4. **Add CNAME record**:
   - Type: `CNAME`
   - Name: `@` (for root domain) or `www` (for subdomain)
   - Target: The Railway CNAME target from step B
   - Proxy status: ✅ Proxied (orange cloud)

### D. Configure SSL/TLS

1. **In Cloudflare**: Go to SSL/TLS → Overview
2. **Set encryption mode**: Full (strict)
3. **Enable**: Always Use HTTPS

## ⚙️ Step 4: Environment Variable Configuration

### Backend Environment Variables (Railway):
```env
NODE_ENV=production
AMADEUS_CLIENT_ID=Bd76Zxmr3DtsAgSCNVhRlgCzzFDROM07
AMADEUS_CLIENT_SECRET=Onw33473vAI1CTHS
AMADEUS_HOSTNAME=test
DATABASE_URL=[Auto-generated by Railway PostgreSQL]
REDIS_HOST=[Auto-generated by Railway Redis]
REDIS_PORT=[Auto-generated by Railway Redis]
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=your-super-secret-jwt-key-here
PORT=5000
```

### Frontend Environment Variables (Railway):
```env
REACT_APP_API_URL=https://your-backend-railway-url.railway.app/api
REACT_APP_Maps_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

## 🔧 Step 5: Update Code for Production

### Update CORS Configuration

Make sure your backend allows your domain:

```javascript
// In backend/server.js
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 🧪 Step 6: Testing Your Deployment

1. **Wait for deployment**: Both services should show "Active" status
2. **Test backend**: Visit `https://your-backend-url.railway.app/api/health`
3. **Test frontend**: Visit `https://yourdomain.com`
4. **Test functionality**: Try searching for flights

## 📊 Step 7: Monitor Your Application

### Railway Dashboard
- **Logs**: View real-time logs for debugging
- **Metrics**: Monitor CPU, memory, and network usage
- **Deployments**: Track deployment history

### Cloudflare Analytics
- **Traffic analytics**: Monitor visitor traffic
- **Security**: View blocked threats
- **Performance**: Check page load times

## 🚨 Troubleshooting Common Issues

### Issue: CORS Errors
**Solution**: Update the `CORS_ORIGIN` environment variable to include your domain

### Issue: Database Connection Failed
**Solution**: Check that DATABASE_URL environment variable is correctly set

### Issue: Frontend Can't Connect to Backend
**Solution**: Verify REACT_APP_API_URL points to correct Railway backend URL

### Issue: Domain Not Loading
**Solution**: 
- Check DNS propagation (can take up to 24 hours)
- Verify CNAME record in Cloudflare
- Ensure SSL certificate is active

## 💰 Cost Estimate

### Railway Pricing (approximate):
- **Backend**: ~$5-10/month
- **Database**: ~$5-15/month  
- **Redis**: ~$5/month
- **Frontend**: ~$0-5/month
- **Total**: ~$15-35/month

### Cloudflare:
- **Domain**: Price varies by domain
- **DNS/CDN**: Free tier available

## 🎉 Success!

Once everything is configured, your Tour Operator System will be:

- ✅ **Live on your domain**: `https://yourdomain.com`
- ✅ **Secured with SSL**: Automatic HTTPS
- ✅ **Globally distributed**: Via Cloudflare CDN
- ✅ **Monitored**: Real-time logs and metrics
- ✅ **Scalable**: Automatic scaling with Railway

## 📞 Support

If you encounter any issues:

1. **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
2. **Railway Docs**: [docs.railway.app](https://docs.railway.app)
3. **Cloudflare Support**: [support.cloudflare.com](https://support.cloudflare.com)

---

**🚂 All Aboard! Your Tour Operator System is now ready for the world! 🌍** 