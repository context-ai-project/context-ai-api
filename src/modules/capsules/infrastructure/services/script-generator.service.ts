import { Injectable, Logger, Inject } from '@nestjs/common';
import { getGenkitInstance, GENKIT_CONFIG } from '@shared/genkit/genkit.config';
import { extractErrorMessage } from '@shared/utils';
import type { IVectorStore } from '../../../knowledge/domain/services/vector-store.interface';
import { EmbeddingService } from '../../../knowledge/infrastructure/services/embedding.service';
import { EmbeddingTaskType } from '../../../knowledge/infrastructure/services/embedding.service';

// Script generation constants
const SCRIPT_TEMPERATURE = 0.4;
const SCRIPT_MAX_OUTPUT_TOKENS = 4096;
const RAG_TOP_K = 25;
const RAG_MIN_SCORE = 0.45;
const MAX_CONTEXT_CHARS = 16000;
const MAX_SCRIPT_CHARS = 10000;

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
 * Generates informative audio scripts for capsules using Gemini 2.5 Flash
 * via Genkit. Retrieves relevant context from Pinecone (RAG) scoped to
 * the documents selected for the capsule.
 *
 * Output: 5000-10000 character audio script (~3-6 min) structured as:
 *   Brief opening → Structured core content → Key takeaways
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
   * Builds the LLM prompt for audio script generation.
   *
   * Principles:
   * - Informative first: synthesize the most important concepts without losing
   *   essential details. Do NOT over-summarize.
   * - Structured: clear logical flow so the listener can follow along.
   * - Natural spoken tone: sounds like a well-produced audiobook, not a lecture
   *   or a corporate memo. No filler phrases or fluff.
   * - Hard limit: output MUST NOT exceed MAX_SCRIPT_CHARS characters.
   */
  private buildPrompt(
    context: string,
    introText: string | null | undefined,
    language?: string,
  ): string {
    const langInstruction = language
      ? `Write the entire script in ${language}.`
      : 'Write the script in the same language as the source documents.';

    const contextSection = context
      ? `<documents>\n${context}\n</documents>\n\n`
      : '';

    const introSection = introText?.trim()
      ? `<author_note>\n${introText.trim()}\n</author_note>\n\n`
      : '';

    return `You are a skilled audiobook narrator and content synthesizer. Your task is to transform the provided documents into a clear, engaging audio script.

${langInstruction}

${contextSection}${introSection}## Your process

1. **Analyze** the documents thoroughly. Identify the core concepts, key facts, important processes, and any critical details that the listener absolutely must know.
2. **Prioritize**: separate what is essential from what is secondary. Essential information must always be included. Secondary details can be mentioned briefly or omitted if space is tight.
3. **Synthesize** — do NOT simply summarize paragraph by paragraph. Reorganize the information into a coherent narrative that flows logically from one idea to the next.

## Script requirements

**Content:**
- Be informative and concrete. Every sentence should teach the listener something.
- Do NOT omit critical information — if a process has 5 steps, mention all 5. If there are specific numbers, dates, or requirements, include them.
- Do NOT add generic filler ("In today's fast-paced world…", "Let's dive in…", "Without further ado…"). Get straight to the substance.
- If the author provided a note, use it to understand the intended focus and tone, but do not read it verbatim.

**Structure:**
- Start with a brief, direct opening that tells the listener what they will learn and why it matters (2-3 sentences max).
- Organize the core content in logical blocks. Use natural verbal transitions between topics ("Now, regarding…", "An important aspect to consider is…", "On the other hand…").
- Close with the key takeaways — the 3 to 5 things the listener should remember.

**Tone & style:**
- Sound natural, like a knowledgeable colleague explaining something important — confident but approachable.
- Use varied sentence lengths. Mix short impactful statements with longer explanatory ones.
- Avoid bullet-point language. This is meant to be heard, not read.
- No section headers, no stage directions, no markdown formatting.
- No references to sources, documents, pages, or metadata.

**Length:**
- The script MUST be between 5000 and ${MAX_SCRIPT_CHARS} characters (roughly 3-6 minutes of audio).
- Use the full space when the content warrants it. Do not cut short if there is important information left to cover.

## Output

Write ONLY the script text. Nothing else — no titles, no comments, no explanations.`;
  }
}
