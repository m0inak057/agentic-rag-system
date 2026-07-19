# RAG System - Deployment Guide

## 🚀 Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Prerequisites
- Docker & Docker Compose installed
- Environment variables configured

#### Steps

1. **Build the Docker images:**
```bash
docker-compose build
```

2. **Start the services:**
```bash
docker-compose up -d
```

3. **Run migrations:**
```bash
docker-compose exec web python manage.py migrate
```

4. **Create superuser:**
```bash
docker-compose exec web python manage.py createsuperuser
```

### Option 2: Traditional Server Deployment

#### Prerequisites
- Python 3.11+
- PostgreSQL 16 with pgvector
- Redis 7+
- Node.js 18+

#### Backend Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
npm install --prefix frontend
```

2. **Build frontend:**
```bash
npm run build --prefix frontend
```

3. **Run migrations:**
```bash
python manage.py migrate
```

4. **Collect static files:**
```bash
python manage.py collectstatic --noinput
```

5. **Start services:**
```bash
# Start Celery worker (in separate terminal)
celery -A config worker -l info

# Start Django (using gunicorn for production)
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

### Option 3: Cloud Deployment

#### Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add buildpacks
heroku buildpacks:add --index 1 heroku/python
heroku buildpacks:add --index 2 heroku/nodejs

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:premium-0

# Deploy
git push heroku master
```

#### AWS / GCP / Azure
- Use Container Registry for Docker images
- Set up managed PostgreSQL (RDS/Cloud SQL)
- Set up managed Redis (ElastiCache/Memorystore)
- Deploy using ECS/App Engine/Container Instances

## 📋 Environment Variables Required

```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
CORS_ALLOW_ALL_ORIGINS=False
DATABASE_URL=postgresql://user:password@host:5432/rag_db
GEMINI_API_KEY=your-gemini-key
TAVILY_API_KEY=your-tavily-key
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=production
```

## ✅ Pre-Deployment Checklist

- [ ] All tests passing (`python manage.py test`)
- [ ] Frontend built successfully (`npm run build`)
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Static files collected
- [ ] Redis running
- [ ] Celery worker configured
- [ ] Logs configured for monitoring

## 🔐 Security Checklist

- [ ] DEBUG=False in production
- [ ] Strong SECRET_KEY set
- [ ] HTTPS/SSL configured
- [ ] CORS properly configured
- [ ] Database credentials secured
- [ ] API keys stored securely
- [ ] Rate limiting configured
- [ ] CSRF protection enabled

## 📊 Monitoring & Logging

- Set up application monitoring (Sentry, New Relic)
- Configure centralized logging
- Monitor database performance
- Track API usage and performance
- Set up alerting for critical errors

## 🔄 CI/CD Pipeline

The project includes GitHub Actions workflow (`django.yml`) that:
- Runs tests on push to master/main/develop
- Uploads coverage reports
- Can be extended for automated deployment

## 🎉 Post-Deployment

1. Run migrations on production database
2. Create superuser account
3. Test all critical flows
4. Monitor error logs
5. Set up backups for database
6. Configure auto-scaling if using cloud

## 📞 Support & Troubleshooting

For deployment issues:
1. Check application logs: `docker-compose logs -f`
2. Verify environment variables
3. Test database connection
4. Verify Redis connectivity
5. Check API key validity
