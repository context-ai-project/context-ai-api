import { Injectable, Logger, Inject } from '@nestjs/common';
import { getGenkitInstance, GENKIT_CONFIG } from '@shared/genkit/genkit.config';
import { extractErrorMessage } from '@shared/utils';
import type { IVectorStore } from '../../../knowledge/domain/services/vector-store.interface';
import { EmbeddingService } from '../../../knowledge/infrastructure/services/embedding.service';
import { EmbeddingTaskType } from '../../../knowledge/infrastructure/services/embedding.service';

// Script generation constants (OWASP: Magic Numbers)
const SCRIPT_TEMPERATURE = 0.5;
const SCRIPT_MAX_OUTPUT_TOKENS = 2048;
const RAG_TOP_K = 20;
const RAG_MIN_SCORE = 0.5;
const MAX_CONTEXT_CHARS = 12000;

/** Input for script generation */
export interface GenerateScriptInput {
  /** Sources to retrieve RAG context from */
  sourceIds: string[];
  /** Sector namespace for Pinecone */
  sectorId: string;
  /** Optional introductory text from the admin */
  introText?: string | null;
  /** Target language for the script (default: auto-detect) */
  language?: string;
}

/** Result of script generation */
export interface GenerateScriptResult {
  script: string;
  tokensUsed?: number;
}

/**
 * ScriptGeneratorService
 *
 * Generates narrative scripts for audio capsules using Gemini 2.5 Flash
 * via Genkit. Retrieves relevant context from Pinecone (RAG) scoped to
 * the documents selected for the capsule.
 *
 * Output: ~1500-word narrative script structured as:
 *   Introduction → Core content → Closing
 */
@Injectable()
export class ScriptGeneratorService {
  private readonly logger = new Logger(ScriptGeneratorService.name);

  constructor(
    @Inject('IVectorStore')
    private readonly vectorStore: IVectorStore,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async generate(input: GenerateScriptInput): Promise<GenerateScriptResult> {
    this.logger.log(
      `Generating script for sector ${input.sectorId} with ${input.sourceIds.length} source(s)`,
    );

    const context = await this.buildRagContext(input);
    const prompt = this.buildPrompt(context, input.introText, input.language);

    try {
      const ai = getGenkitInstance();
      const response = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        config: {
          temperature: SCRIPT_TEMPERATURE,
          maxOutputTokens: SCRIPT_MAX_OUTPUT_TOKENS,
        },
      });

      const script = response.text?.trim() ?? '';

      if (!script) {
        throw new Error('LLM returned an empty script');
      }

      this.logger.log(`Script generated: ${script.length} characters`);

      return { script };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Script generation failed: ${message}`);
      throw new Error(`Failed to generate script: ${message}`);
    }
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Retrieves RAG context from Pinecone for the selected source documents.
   * Uses a generic query embedding to retrieve broadly relevant fragments.
   */
  private async buildRagContext(input: GenerateScriptInput): Promise<string> {
    try {
      // Use a generic knowledge-retrieval query
      const queryText = input.introText?.trim()
        ? input.introText
        : 'principales conceptos y puntos clave del documento';

      const embedding = await this.embeddingService.generateEmbedding(
        queryText,
        EmbeddingTaskType.RETRIEVAL_QUERY,
      );

      const results = await this.vectorStore.vectorSearch(
        embedding,
        input.sectorId,
        RAG_TOP_K,
        RAG_MIN_SCORE,
      );

      // Filter to only the selected source documents
      const sourceSet = new Set(input.sourceIds);
      const filtered = results.filter((r) =>
        sourceSet.has(r.metadata.sourceId),
      );

      // Concatenate content up to MAX_CONTEXT_CHARS
      let context = '';
      for (const result of filtered) {
        const addition = result.metadata.content + '\n\n';
        if (context.length + addition.length > MAX_CONTEXT_CHARS) break;
        context += addition;
      }

      this.logger.debug(
        `RAG context: ${filtered.length} fragments, ${context.length} chars`,
      );

      return context.trim();
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.warn(
        `RAG context retrieval failed, proceeding without context: ${message}`,
      );
      return '';
    }
  }

  /**
   * Builds the LLM prompt for narrative script generation.
   */
  private buildPrompt(
    context: string,
    introText: string | null | undefined,
    language?: string,
  ): string {
    const langInstruction = language
      ? `Write the script in ${language}.`
      : 'Write the script in the same language as the source documents.';

    const contextSection = context
      ? `## Relevant document fragments\n\n${context}\n\n`
      : '';

    const introSection = introText?.trim()
      ? `## Introductory note from the content author\n\n${introText.trim()}\n\n`
      : '';

    return `You are a professional content narrator. Your task is to create an engaging, informative audio script from the provided documents.

${langInstruction}

${contextSection}${introSection}## Instructions

- Write a narrative script of approximately 1500 words.
- Structure: Introduction (hook + topic overview) → Core content (main concepts explained clearly) → Closing (key takeaways + call to action).
- Use a warm, professional tone suitable for corporate onboarding or training.
- Do NOT include section headers or stage directions in the output — the script should flow naturally as spoken audio.
- Do NOT include metadata, source references, or document titles.
- If no document context is available, generate a placeholder script that the author can edit.

## Script`;
  }
}
