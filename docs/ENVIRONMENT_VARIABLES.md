# Context.ai API - Environment Variables

This document describes all environment variables used by the Context.ai API.

## Application Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment (development, production, test) | `development` | No |
| `PORT` | Server port | `3001` (host) / `3000` (Docker) | No |
| `API_PREFIX` | API route prefix | `api/v1` | No |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` | No |
| `ALLOWED_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` | No |

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
| `GOOGLE_API_KEY` | Google AI API key for Genkit (Gemini 2.5 Flash + gemini-embedding-001) | - | **Yes** |
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

## Pinecone Vector Store

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PINECONE_API_KEY` | Pinecone API key for vector store operations | - | **Yes** |
| `PINECONE_INDEX` | Pinecone index name | `context-ai` | No |

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

# Database (local development with Docker — port 5433 maps to internal 5432)
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=context_ai_user
DB_PASSWORD=context_ai_pass
DB_DATABASE=context_ai_db
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Auth0 Authentication
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.contextai.com
AUTH0_ISSUER=https://your-tenant.auth0.com/

# Server-to-Server (must match frontend INTERNAL_API_KEY)
INTERNAL_API_KEY=generate-with-openssl-rand-hex-32

# Google AI (Genkit)
GOOGLE_API_KEY=your_google_api_key_here
GENKIT_ENV=dev

# Pinecone Vector Store
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=context-ai

# CORS & Security
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

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
   - **`PINECONE_API_KEY`** - Get from [Pinecone Console](https://app.pinecone.io/)
   - **`DB_*`** - Update if not using default Docker values

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

