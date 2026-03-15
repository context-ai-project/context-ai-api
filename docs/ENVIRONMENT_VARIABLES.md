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

## Google Genkit AI Configuration (Vertex AI)

Genkit uses **Vertex AI** via Application Default Credentials (ADC) — no API key required.

- **Local development**: Run `gcloud auth application-default login` once.
- **Production (Cloud Run)**: ADC is automatic via the service account. Ensure the service account has the `roles/aiplatform.user` IAM role.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GCP_PROJECT_ID` | Google Cloud project ID for Vertex AI | - | **Yes** |
| `GCP_LOCATION` | Vertex AI region | `europe-west1` | No |
| `GENKIT_ENV` | Genkit environment (dev, prod) | `dev` | No |

## Auth0 Configuration (Phase 6)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) | - | **Yes** |
| `AUTH0_AUDIENCE` | Auth0 API identifier (e.g., `https://api.contextai.com`) | - | **Yes** |
| `AUTH0_ISSUER` | Auth0 issuer URL with trailing slash (e.g., `https://your-tenant.auth0.com/`) | - | **Yes** |

**Setup Instructions**: See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md) for complete configuration guide.

## Auth0 Management API – M2M (Invitations)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH0_MGMT_DOMAIN` | Auth0 tenant domain for Management API (usually same as `AUTH0_DOMAIN`) | - | **Yes** |
| `AUTH0_MGMT_CLIENT_ID` | Client ID of the M2M Application (scopes: `create:users`, `create:user_tickets`, `read:users`) | - | **Yes** |
| `AUTH0_MGMT_CLIENT_SECRET` | Client Secret of the M2M Application | - | **Yes** |
| `AUTH0_DB_CONNECTION` | Auth0 database connection name | `Username-Password-Authentication` | No |

**Setup Instructions**: See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md) § "M2M Application for Invitations".

## Server-to-Server Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `INTERNAL_API_KEY` | Shared secret for server-to-server calls (e.g., NextAuth → API user sync). Must be the same value in both frontend and backend. Generate with `openssl rand -hex 32`. | - | **Yes** |

## Pinecone Vector Store

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PINECONE_API_KEY` | Pinecone API key for vector store operations | - | **Yes** |
| `PINECONE_INDEX` | Pinecone index name | `context-ai` | No |
| `PINECONE_HOST` | Data-plane host from Pinecone console (index details). Optional; if set, skips control-plane describeIndex call. | - | No |

## Capsules (Audio/Video) — Required for application startup

The Capsules module is loaded at bootstrap. The following variables **must be set** or the application will fail to start (services throw in constructor if missing).

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS (audio generation). Get from [ElevenLabs](https://elevenlabs.io/app/api-key). | - | **Yes** |
| `GCS_BUCKET_CAPSULES` | Google Cloud Storage bucket name for storing generated audio/video capsules | - | **Yes** |
| `GCS_PROJECT_ID` | GCP project ID for the bucket (same as or different from `GCP_PROJECT_ID`) | - | **Yes** |
| `GCS_KEY_FILE` | Path to service account JSON key (optional in GKE/Cloud Run — uses workload identity) | - | No |
| `SHOTSTACK_API_KEY` | Shotstack API key for video assembly. Get from [Shotstack Dashboard](https://dashboard.shotstack.io/). | - | **Yes** |
| `SHOTSTACK_ENVIRONMENT` | Shotstack environment: `stage` (sandbox/free) or `v1` (production) | `stage` | No |
| `VIDEO_MAX_CAPSULES_PER_MONTH` | Maximum video capsules allowed per month (quota) | `10` | No |

Optional for local dev (production only): `CLOUD_RUN_SERVICE_URL`, `CLOUD_TASKS_QUEUE`, `GCP_LOCATION` for the video pipeline.

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

# Auth0 Management API – M2M (Invitations)
AUTH0_MGMT_DOMAIN=your-tenant.auth0.com
AUTH0_MGMT_CLIENT_ID=your-m2m-client-id
AUTH0_MGMT_CLIENT_SECRET=your-m2m-client-secret
# AUTH0_DB_CONNECTION=Username-Password-Authentication

# Server-to-Server (must match frontend INTERNAL_API_KEY)
INTERNAL_API_KEY=generate-with-openssl-rand-hex-32

# Google Genkit (Vertex AI — uses ADC, no API key needed)
# Local: run `gcloud auth application-default login`
# Production: automatic via Cloud Run service account
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=europe-west1
GENKIT_ENV=dev

# Pinecone Vector Store
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=context-ai
# PINECONE_HOST=  # optional, from Pinecone console → index details

# Capsules (required for API to start)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
GCS_BUCKET_CAPSULES=context-ai-capsules-dev
GCS_PROJECT_ID=your-gcp-project-id
SHOTSTACK_API_KEY=your_shotstack_api_key_here
SHOTSTACK_ENVIRONMENT=stage

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

1. Copy the `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```

2. Update the required values:
   - **`GCP_PROJECT_ID`** - Your Google Cloud project ID. Authenticate locally with `gcloud auth application-default login`
   - **`AUTH0_DOMAIN`**, **`AUTH0_AUDIENCE`**, **`AUTH0_ISSUER`** - See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md)
   - **`AUTH0_MGMT_DOMAIN`**, **`AUTH0_MGMT_CLIENT_ID`**, **`AUTH0_MGMT_CLIENT_SECRET`** - See [docs/AUTH0_SETUP.md](./AUTH0_SETUP.md) § "M2M Application for Invitations"
   - **`INTERNAL_API_KEY`** - Generate with `openssl rand -hex 32` (must match frontend)
   - **`PINECONE_API_KEY`** - Get from [Pinecone Console](https://app.pinecone.io/)
   - **Capsules (required for startup):** **`ELEVENLABS_API_KEY`** ([ElevenLabs](https://elevenlabs.io/app/api-key)), **`GCS_BUCKET_CAPSULES`**, **`GCS_PROJECT_ID`**, **`SHOTSTACK_API_KEY`** ([Shotstack](https://dashboard.shotstack.io/))
   - **`DB_*`** - Update if not using default Docker values

3. For local development with Docker (use `docker compose` v2; if only the legacy binary is available, use `docker-compose`):
   ```bash
   docker compose up -d
   ```

4. For production, ensure all required variables are set securely using secrets management.

## Security Notes

- **NEVER** commit the `.env` file to version control
- Use strong passwords in production
- Rotate API keys regularly
- Enable SSL in production (`DB_SSL_REJECT_UNAUTHORIZED=true`)
- Use secrets management tools (AWS Secrets Manager, Azure Key Vault, etc.) in production

