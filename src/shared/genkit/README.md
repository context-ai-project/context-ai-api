# Google Genkit Configuration

This directory contains the Google Genkit configuration for Context.AI API.

## Overview

Google Genkit is our AI framework for:
- **LLM Operations**: Gemini 2.5 Flash for chat and RAG responses
- **Embeddings**: gemini-embedding-001 for vector generation (3072 dimensions)

All AI calls route through **Vertex AI** (Google Cloud), authenticated via
Application Default Credentials (ADC) — no API keys required.

## Files

- `genkit.config.ts` - Main configuration and initialization
- `capsules-genkit.config.ts` - Re-exports for capsule module
- `flows/` - Genkit flows (RAG query flow, etc.)
- `evaluators/` - RAG evaluation (faithfulness, relevancy)

## Configuration

### Environment Variables

Required:
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCP_LOCATION` - Vertex AI region (default: `europe-west1`)

Optional:
- `GENKIT_ENV` - Environment (dev/prod, default: dev)

### Authentication

**Local development**:
```bash
gcloud auth application-default login
```

**Production (Cloud Run)**: Automatic via the service account.
The service account needs the **Vertex AI User** (`roles/aiplatform.user`) role.

### Models

**LLM Model**: `vertexai/gemini-2.5-flash`
- Used for: Chat responses, RAG generation, script generation
- Configuration: See `GENKIT_CONFIG.LLM_MODEL`

**Embedding Model**: `vertexai/gemini-embedding-001`
- Dimensions: 3072
- Used for: Document chunking, semantic search
- Configuration: See `GENKIT_CONFIG.EMBEDDING_MODEL`

## Usage

### Basic Usage

```typescript
import { genkit, GENKIT_CONFIG } from '@shared/genkit/genkit.config';

// Create Genkit instance
const ai = genkit();

// Generate text
const result = await ai.generate({
  model: GENKIT_CONFIG.LLM_MODEL,
  prompt: 'Your prompt here',
  config: GENKIT_CONFIG.GENERATION_DEFAULTS,
});

// Generate embedding
const embedding = await ai.embed({
  embedder: GENKIT_CONFIG.EMBEDDING_MODEL,
  content: 'Text to embed',
});
```

### Singleton Instance

For convenience, use the singleton instance:

```typescript
import { getGenkitInstance, GENKIT_CONFIG } from '@shared/genkit/genkit.config';

const ai = getGenkitInstance();
```

**Note**: Prefer creating new instances in tests using `genkit()` for better isolation.

### Generation Configs

**Default Config** (Creative):
```typescript
{
  temperature: 0.7,
  maxOutputTokens: 2048,
  topK: 40,
  topP: 0.95,
}
```

**RAG Config** (Conservative/Factual):
```typescript
{
  temperature: 0.3,
  maxOutputTokens: 1024,
  topK: 20,
  topP: 0.9,
}
```

## Testing

Integration tests are located in `test/integration/genkit/`.

### Running Genkit Tests

```bash
# Requires ADC authentication
gcloud auth application-default login

# Run integration tests
pnpm test:integration -- genkit
```

### Mocking in Unit Tests

For unit tests, mock the Genkit instance:

```typescript
jest.mock('@shared/genkit/genkit.config', () => ({
  genkit: jest.fn(() => ({
    generate: jest.fn().mockResolvedValue({ text: 'Mocked response' }),
    embed: jest.fn().mockResolvedValue(new Array(3072).fill(0.1)),
  })),
  GENKIT_CONFIG: {
    LLM_MODEL: 'vertexai/gemini-2.5-flash',
    EMBEDDING_MODEL: 'vertexai/gemini-embedding-001',
    EMBEDDING_DIMENSIONS: 3072,
  },
}));
```

## Debugging

### Genkit Developer UI

Run Genkit Developer UI for debugging flows:

```bash
npx genkit start
```

Opens at: http://localhost:4000

### Logging

Set `GENKIT_ENV=dev` to enable verbose logging.

## Performance Considerations

### Embedding Generation
- **Batch processing**: Generate embeddings in batches when possible
- **Caching**: Cache embeddings for unchanged content
- **Rate limiting**: Vertex AI has generous quotas with pay-as-you-go billing

### LLM Generation
- **Context size**: Gemini 2.5 Flash supports large context (up to 1M tokens)
- **Token efficiency**: Use RAG config for factual responses (lower temperature)

## Security

- Vertex AI uses ADC — no API keys to manage or rotate
- Service account permissions follow the principle of least privilege
- Different service accounts for dev/staging/production

## Resources

- [Genkit Documentation](https://genkit.dev/docs)
- [Vertex AI Genkit Plugin](https://genkit.dev/docs/plugins/vertex-ai)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [gemini-embedding-001](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)

## Troubleshooting

### Error: "Could not load the default credentials"
**Solution**: Run `gcloud auth application-default login` for local development.

### Error: "Permission denied on Vertex AI"
**Solution**: Ensure the service account has `roles/aiplatform.user`.

### Error: "Model not found"
**Solution**: Verify model names in `GENKIT_CONFIG` match Vertex AI models.

### Slow embedding generation
**Solution**:
1. Batch embed multiple texts together
2. Cache embeddings in database
3. Use connection pooling

## Future Enhancements

- [x] Migrated to Gemini 2.5 Flash (faster, cost-effective)
- [x] Migrated from Google AI to Vertex AI (no API key limits)
- [ ] Implement embedding caching layer
- [ ] Add telemetry and observability
- [ ] Support for custom Genkit plugins
