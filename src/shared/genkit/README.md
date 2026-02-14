# Google Genkit Configuration

This directory contains the Google Genkit configuration for Context.AI API.

## Overview

Google Genkit is our AI framework for:
- **LLM Operations**: Gemini 2.5 Flash for chat and RAG responses
- **Embeddings**: gemini-embedding-001 for vector generation (3072 dimensions)

## Files

- `genkit.config.ts` - Main configuration and initialization
- `flows/` - Genkit flows (RAG query flow, etc.)

## Configuration

### Environment Variables

Required:
- `GOOGLE_API_KEY` - API key for Google AI services ([Get key](https://aistudio.google.com/app/apikey))

Optional:
- `GENKIT_ENV` - Environment (dev/prod, default: dev)

### Models

**LLM Model**: `googleai/gemini-2.5-flash`
- Used for: Chat responses, RAG generation
- Configuration: See `GENKIT_CONFIG.LLM_MODEL`

**Embedding Model**: `googleai/gemini-embedding-001`
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
# Requires real GOOGLE_API_KEY
export GOOGLE_API_KEY=your-api-key-here

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
    LLM_MODEL: 'googleai/gemini-2.5-flash',
    EMBEDDING_MODEL: 'googleai/gemini-embedding-001',
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
- **Rate limiting**: Respect Google AI rate limits

### LLM Generation
- **Context size**: Gemini 2.5 Flash supports large context (up to 1M tokens)
- **Token efficiency**: Use RAG config for factual responses (lower temperature)

## Security

- ⚠️ **NEVER** commit `GOOGLE_API_KEY` to version control
- ⚠️ Store API keys in environment variables or secrets management
- ⚠️ Rotate API keys regularly
- ⚠️ Use different keys for dev/staging/production

## Resources

- [Genkit Documentation](https://genkit.dev/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Docs](https://ai.google.dev/docs)
- [gemini-embedding-001](https://ai.google.dev/gemini-api/docs/embeddings)

## Troubleshooting

### Error: "GOOGLE_API_KEY environment variable is required"
**Solution**: Add `GOOGLE_API_KEY` to your `.env` file

### Error: "Model not found"
**Solution**: Verify model names in `GENKIT_CONFIG` match Google AI models

### Error: "API key invalid"
**Solution**: Generate a new API key from Google AI Studio

### Slow embedding generation
**Solution**: 
1. Batch embed multiple texts together
2. Cache embeddings in database
3. Use connection pooling

## Future Enhancements

- [x] Migrated to Gemini 2.5 Flash (faster, cost-effective)
- [ ] Implement embedding caching layer
- [ ] Add telemetry and observability
- [ ] Support for custom Genkit plugins

