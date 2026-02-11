# Context.ai API - Environment Variables

This document describes all environment variables used by the Context.ai API.

## Application Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment (development, production, test) | `development` | No |
| `PORT` | Server port | `3000` | No |
| `API_PREFIX` | API route prefix | `api` | No |

## Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | No |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_USERNAME` | Database username | `context_ai_user` | No |
| `DB_PASSWORD` | Database password | `context_ai_pass` | No |
| `DB_DATABASE` | Database name | `context_ai_db` | No |
| `DB_POOL_SIZE` | Connection pool size | `10` | No |
| `DB_SYNCHRONIZE` | Auto-sync schema (NEVER true in production!) | `false` | No |
| `DB_LOGGING` | Enable SQL logging | `false` | No |
| `DB_SSL_REJECT_UNAUTHORIZED` | SSL certificate validation | `true` | No |

## Google Genkit AI Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_API_KEY` | Google AI API key for Genkit (Gemini 1.5 Pro + text-embedding-005) | - | **Yes** |
| `GENKIT_ENV` | Genkit environment (dev, prod) | `dev` | No |

## Auth0 Configuration (Phase 6)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) | - | **Yes** |
| `AUTH0_AUDIENCE` | Auth0 API identifier (e.g., `https://api.contextai.com`) | - | **Yes** |
| `AUTH0_ISSUER` | Auth0 issuer URL with trailing slash (e.g., `https://your-tenant.auth0.com/`) | - | **Yes** |

**Setup Instructions**: See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md) for complete configuration guide.

## Server-to-Server Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `INTERNAL_API_KEY` | Shared secret for server-to-server calls (e.g., NextAuth → API user sync). Must be the same value in both frontend and backend. Generate with `openssl rand -hex 32`. | - | **Yes** |

## CORS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` | No |

## Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_TTL` | Rate limit time window (seconds) | `60` | No |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |

## Logging

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` | No |

## File Upload

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MAX_FILE_SIZE` | Maximum file upload size in bytes | `10485760` (10MB) | No |

## Example .env File

```env
# Application
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

# Database (local development with Docker)
DATABASE_URL=postgresql://contextai_user:dev_password@localhost:5432/contextai
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=contextai_user
DATABASE_PASSWORD=dev_password
DATABASE_NAME=contextai

# Auth0 Authentication
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.contextai.com
AUTH0_ISSUER=https://your-tenant.auth0.com/

# Server-to-Server (must match frontend INTERNAL_API_KEY)
INTERNAL_API_KEY=generate-with-openssl-rand-hex-32

# Google AI (Genkit)
GOOGLE_API_KEY=your_google_api_key_here
GENKIT_ENV=dev

# CORS & Security
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Observability
SENTRY_DSN=
LOG_LEVEL=debug
```

## Setup Instructions

1. Copy the `env-template.txt` to `.env` in the project root:
   ```bash
   cp env-template.txt .env
   ```

2. Update the required values:
   - **`GOOGLE_API_KEY`** - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **`AUTH0_DOMAIN`**, **`AUTH0_AUDIENCE`**, **`AUTH0_ISSUER`** - See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md)
   - **`INTERNAL_API_KEY`** - Generate with `openssl rand -hex 32` (must match frontend)
   - **`DATABASE_*`** - Update if not using default Docker values

3. For local development with Docker:
   ```bash
   docker-compose up -d
   ```

4. For production, ensure all required variables are set securely using secrets management.

## Security Notes

- **NEVER** commit the `.env` file to version control
- Use strong passwords in production
- Rotate API keys regularly
- Enable SSL in production (`DB_SSL_REJECT_UNAUTHORIZED=true`)
- Use secrets management tools (AWS Secrets Manager, Azure Key Vault, etc.) in production

