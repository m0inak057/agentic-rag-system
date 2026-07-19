# RAG System - Google Cloud Platform Deployment Guide

## 🚀 Deploy on GCP in 30 Minutes

### Prerequisites
- Google Cloud Project created
- `gcloud` CLI installed and configured
- Docker installed locally
- GitHub repository linked

### GCP Services Required
1. **Cloud Run** - Containerized Django app
2. **Cloud SQL** - PostgreSQL 16 with pgvector
3. **Memorystore for Redis** - Cache & Celery broker
4. **Container Registry** - Store Docker images
5. **Cloud Storage** - Store static files & uploads
6. **Cloud Tasks** - Manage async tasks

---

## 📝 Step-by-Step Deployment

### Step 1: Set Up GCP Project

```bash
# Set project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export APP_NAME="rag-system"

# Set GCP project
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  cloudtasks.googleapis.com \
  storage-api.googleapis.com \
  logging.googleapis.com
```

### Step 2: Create Cloud SQL Database

```bash
# Create Cloud SQL instance
gcloud sql instances create $APP_NAME-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --availability-type=REGIONAL

# Create database
gcloud sql databases create rag_db --instance=$APP_NAME-db

# Create user
gcloud sql users create rag_user \
  --instance=$APP_NAME-db \
  --password

# Enable pgvector extension in the database
# Use Cloud SQL proxy or connect via CLI
```

### Step 3: Create Memorystore Redis

```bash
# Create Redis instance
gcloud redis instances create $APP_NAME-redis \
  --size=1 \
  --region=$REGION \
  --redis-version=7.0

# Get Redis host and port
gcloud redis instances describe $APP_NAME-redis \
  --region=$REGION --format='value(host, port)'
```

### Step 4: Create Cloud Storage Buckets

```bash
# Create bucket for static files
gsutil mb -l $REGION gs://$PROJECT_ID-static/

# Create bucket for media/uploads
gsutil mb -l $REGION gs://$PROJECT_ID-media/
```

### Step 5: Build and Push Docker Image

```bash
# Authenticate with Container Registry
gcloud auth configure-docker

# Build Docker image
docker build -t gcr.io/$PROJECT_ID/$APP_NAME:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/$APP_NAME:latest
```

### Step 6: Set Environment Variables

Create a `.env.gcp` file:

```
DATABASE_URL=postgresql://rag_user:PASSWORD@/rag_db?host=/cloudsql/PROJECT:REGION:INSTANCE
REDIS_URL=redis://REDIS_IP:6379
SECRET_KEY=your-secure-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com
GCS_BUCKET_STATIC=gs://PROJECT-static
GCS_BUCKET_MEDIA=gs://PROJECT-media
GEMINI_API_KEY=your-key
TAVILY_API_KEY=your-key
ENVIRONMENT=production
```

### Step 7: Deploy to Cloud Run

```bash
# Deploy Django app
gcloud run deploy $APP_NAME \
  --image=gcr.io/$PROJECT_ID/$APP_NAME:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJECT:REGION:INSTANCE \
  --memory=1Gi \
  --cpu=1 \
  --timeout=3600 \
  --max-instances=10

# Add environment variables after deployment
gcloud run services update $APP_NAME \
  --region=$REGION \
  --set-env-vars VARIABLE_NAME=value
```

### Step 8: Run Database Migrations

```bash
# Option 1: Use Cloud SQL Proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE &
python manage.py migrate

# Option 2: Use gcloud SQL CLI
gcloud sql connect $APP_NAME-db --user=rag_user
# Then run: python manage.py migrate
```

### Step 9: Deploy Frontend

```bash
# Build frontend
cd frontend
npm install
npm run build

# Upload to Cloud Storage
gsutil -m cp -r dist/* gs://$PROJECT_ID-static/
```

### Step 10: Configure Custom Domain

```bash
# Map custom domain to Cloud Run
gcloud run domain-mappings create \
  --service=$APP_NAME \
  --domain=yourdomain.com \
  --region=$REGION

# Add DNS CNAME record pointing to Cloud Run
# (Get CNAME from the output above)
```

---

## 🔒 Security Best Practices

1. **Use Cloud Secret Manager:**
```bash
echo -n "your-secret" | gcloud secrets create SECRET_NAME --data-file=-
```

2. **Enable VPC Connector** for private database access:
```bash
gcloud compute networks vpc-access connectors create connector \
  --region=$REGION --subnet=default
```

3. **Set up Cloud Armor** for DDoS protection
4. **Use Cloud KMS** for encryption
5. **Enable Cloud Audit Logs**

---

## 📊 Cost Estimate (Monthly)

| Service | Cost |
|---------|------|
| Cloud SQL (db-f1-micro) | $10-15 |
| Redis (1GB) | $10-15 |
| Cloud Run | $15-30 |
| Cloud Storage | $5-10 |
| Cloud CDN | $15-25 |
| **Total** | **~$50-95/month** |

---

## ✅ Deployment Checklist

- [ ] GCP project set up
- [ ] APIs enabled
- [ ] Cloud SQL instance created
- [ ] pgvector extension enabled
- [ ] Redis instance created
- [ ] Storage buckets created
- [ ] Service account configured
- [ ] Docker image built and pushed
- [ ] Environment variables set
- [ ] Migrations run
- [ ] Frontend deployed
- [ ] Cloud Run service deployed
- [ ] Custom domain configured
- [ ] Monitoring enabled

---

## 🔧 Useful Commands

```bash
# View logs
gcloud run services logs read $APP_NAME --region=$REGION --limit=50

# Update service
gcloud run deploy $APP_NAME \
  --image=gcr.io/$PROJECT_ID/$APP_NAME:latest \
  --region=$REGION

# Scale configuration
gcloud run services update $APP_NAME \
  --max-instances=20 --min-instances=2 \
  --region=$REGION
```

---

## 🚨 Troubleshooting

**Connection to Cloud SQL fails:**
- Enable Cloud SQL Admin API
- Check service account IAM roles
- Verify connection string

**Out of memory:**
- Increase memory: `--memory=2Gi`
- Optimize Django settings
- Check for memory leaks

**High costs:**
- Reduce max instances
- Monitor with Cloud Billing
- Use smaller database tier
