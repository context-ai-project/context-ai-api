# Database Setup Guide

This guide explains how to set up and work with the PostgreSQL database for Context.ai.

> **Note:** Vector embeddings are managed by Pinecone (external service). PostgreSQL stores only relational data.

## Quick Start

### 1. Start the Database (Docker)

```bash
# Start PostgreSQL
npm run db:create

# Check if it's running
docker ps | grep context-ai-postgres
```

The database will be available at `localhost:5432` with:
- Database: `context_ai_db`
- User: `context_ai_user`
- Password: `context_ai_pass`

### 2. Run Migrations

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show
```

### 3. Verify Setup

```bash
# Connect to the database
docker exec -it context-ai-postgres psql -U context_ai_user -d context_ai_db

# Check tables
\dt

# Check vector index
\d fragments

# Exit
\q
```

## Working with Migrations

### Generate a New Migration

```bash
# Make changes to your entities first (*.model.ts files)
# Then generate a migration based on the changes
npm run migration:generate -- AddNewColumn

# This will create a file in src/migrations/
```

### Create an Empty Migration

```bash
# For complex changes, create an empty migration manually
npm run migration:create -- CustomMigration

# Then edit the file in src/migrations/
```

### Run Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert
```

## Database Management

### Stop Database

```bash
# Stop without removing data
npm run db:stop

# Restart
npm run db:create
```

### Reset Database (⚠️ Destructive)

```bash
# Drop database and volumes (all data will be lost!)
npm run db:drop

# Then recreate
npm run db:create
npm run migration:run
```

### Access PgAdmin (Optional)

PgAdmin is available at http://localhost:5050

- Email: `admin@context-ai.local`
- Password: `admin`

Add a new server:
- Host: `postgres` (Docker internal network)
- Port: `5432`
- Database: `context_ai_db`
- Username: `context_ai_user`
- Password: `context_ai_pass`

## Database Schema

### Tables

#### knowledge_sources
Stores document metadata and raw content.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(255) | Document title |
| sector_id | UUID | Reference to sector |
| source_type | VARCHAR(50) | PDF, MARKDOWN, URL |
| content | TEXT | Raw document content |
| status | VARCHAR(50) | PENDING, PROCESSING, COMPLETED, FAILED |
| metadata | JSONB | Additional metadata |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| deleted_at | TIMESTAMP | Soft delete timestamp |

**Indexes:**
- `idx_knowledge_sources_sector_id` on `sector_id`
- `idx_knowledge_sources_status` on `status`
- `idx_knowledge_sources_source_type` on `source_type`
- `idx_knowledge_sources_created_at` on `created_at`
- `idx_knowledge_sources_deleted_at` on `deleted_at`

#### fragments
Stores document chunks (text only). Vector embeddings are stored in Pinecone.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| source_id | UUID | Foreign key to knowledge_sources |
| content | TEXT | Fragment text content |
| position | INTEGER | Position within source document |
| token_count | INTEGER | Estimated token count |
| metadata | JSONB | Additional metadata |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_fragments_source_id` on `source_id`
- `idx_fragments_position` on `(source_id, position)`

**Foreign Keys:**
- `fk_fragments_source_id` references `knowledge_sources(id)` ON DELETE CASCADE

## Vector Search

Vector embeddings are managed by **Pinecone** (external managed service), not PostgreSQL.

### Architecture

- **PostgreSQL**: Stores relational data (sources, fragments text, users, conversations)
- **Pinecone**: Stores vector embeddings for similarity search (via `IVectorStore` interface)

### How It Works

1. During ingestion, embeddings are generated via Genkit (Gemini) and upserted to Pinecone
2. During queries, the query embedding is compared against Pinecone vectors
3. Pinecone returns the most similar fragment IDs and scores
4. Fragment content is retrieved from PostgreSQL

### Pinecone Configuration

- **Index**: Configured via `PINECONE_INDEX` env variable
- **Namespaces**: Each sector (`sectorId`) maps to a Pinecone namespace for multi-tenant isolation
- **Dimensions**: 3072 (gemini-embedding-001)

## Troubleshooting

### Can't connect to database

```bash
# Check if container is running
docker ps | grep postgres

# Check logs
docker logs context-ai-postgres

# Restart
docker-compose restart postgres
```

### Migration fails

```bash
# Check migration status
npm run migration:show

# Revert last migration
npm run migration:revert

# Fix the migration file
# Then run again
npm run migration:run
```

### Clear all data and start fresh

```bash
# ⚠️ This will delete ALL data!
npm run db:drop
npm run db:create
npm run migration:run
```

## Production Considerations

For production deployments:

1. **Use managed database services**:
   - AWS RDS for PostgreSQL
   - Google Cloud SQL
   - Azure Database for PostgreSQL

2. **Set proper environment variables**:
   ```env
   NODE_ENV=production
   DB_HOST=your-rds-endpoint.amazonaws.com
   DB_PORT=5432
   DB_USERNAME=prod_user
   DB_PASSWORD=strong_secure_password
   DB_DATABASE=context_ai_prod
   DB_SSL_REJECT_UNAUTHORIZED=true
   DB_SYNCHRONIZE=false  # ALWAYS false in production!
   DB_LOGGING=false
   ```

3. **Run migrations as part of deployment**:
   ```bash
   npm run migration:run
   ```

4. **Monitor database performance**:
   - Connection pool usage
   - Query performance
   - Index usage
   - Disk space

5. **Backup strategy**:
   - Automated daily backups
   - Point-in-time recovery enabled
   - Test restore procedures regularly

## See Also

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone Node.js SDK](https://github.com/pinecone-io/pinecone-ts-client)

