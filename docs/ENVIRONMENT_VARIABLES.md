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
| `GOOGLE_GENAI_API_KEY` | Google Generative AI API key | - | **Yes** |

## JWT Configuration (Future Phases)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT secret key | - | **Yes** (in production) |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` | No |

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
PORT=3000

# Database (local development with Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=context_ai_user
DB_PASSWORD=context_ai_pass
DB_DATABASE=context_ai_db
DB_SYNCHRONIZE=false
DB_LOGGING=true

# Google AI
GOOGLE_GENAI_API_KEY=your_api_key_here

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Setup Instructions

1. Copy this template to a new `.env` file in the project root:
   ```bash
   cp docs/ENVIRONMENT_VARIABLES.md .env
   ```

2. Update the values, especially:
   - `GOOGLE_GENAI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

3. For local development with Docker:
   ```bash
   docker-compose up -d
   ```

4. For production, ensure all required variables are set securely.

## Security Notes

- **NEVER** commit the `.env` file to version control
- Use strong passwords in production
- Rotate API keys regularly
- Enable SSL in production (`DB_SSL_REJECT_UNAUTHORIZED=true`)
- Use secrets management tools (AWS Secrets Manager, Azure Key Vault, etc.) in production

