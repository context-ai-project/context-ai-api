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
const MAX_SCRIPT_CHARS = 5000;
const DESCRIPTION_TEMPERATURE = 0.3;
const DESCRIPTION_MAX_TOKENS = 256;
const MAX_DESCRIPTION_CHARS = 300;
const ELLIPSIS_LENGTH = 3;

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
  description: string;
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

      const description = await this.generateDescription(script);

      return { script, description };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Script generation failed: ${message}`);
      throw new Error(`Failed to generate script: ${message}`);
    }
  }

  /**
   * Generates a short description/summary from the script.
   * Used as the capsule description visible in list views and cards.
   */
  private async generateDescription(script: string): Promise<string> {
    try {
      const ai = getGenkitInstance();
      const response = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt: `Summarize the following audio script in 1-2 sentences (max ${MAX_DESCRIPTION_CHARS} characters). The summary should describe what the capsule covers. Write it in the same language as the script. Output ONLY the summary, nothing else.\n\n${script}`,
        config: {
          temperature: DESCRIPTION_TEMPERATURE,
          maxOutputTokens: DESCRIPTION_MAX_TOKENS,
        },
      });

      const description = response.text?.trim() ?? '';
      if (!description) return '';

      // Truncate if exceeds limit
      if (description.length > MAX_DESCRIPTION_CHARS) {
        return (
          description.substring(0, MAX_DESCRIPTION_CHARS - ELLIPSIS_LENGTH) +
          '...'
        );
      }

      this.logger.log(
        `Description generated: ${description.length} characters`,
      );
      return description;
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.warn(`Description generation failed (non-fatal): ${message}`);
      return '';
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

    return `You are a skilled audiobook narrator, an expert, empathetic and content synthesizer. Your goal is to act as a genuine "thought partner" for the user and transform the provided documents into a clear, engaging audio script.
             
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
1. Organization: Do not generate dense walls of text. Use clear structure (short paragraphs or distinct sections) to organize ideas.
2. Scannability: The content should be easy to digest at a glance.
3. Closing: Close with the key takeaways — the 3 to 5 things the listener should remember.

**Tone & style:**
1. Tone: Conversational and approachable, yet professional. Avoid overly corporate, rigid, or "robotic" language.
2. Empathy: Recognize the user's context. If there is a problem, validate the situation before diving into the solution.
3. Clarity: Be direct and concise. Avoid unnecessary fluff.
4. Active Voice: Use strong verbs and address the user directly as "you".
5.No references to sources, documents, pages, or metadata.

Personality & Tone Guidelines:
1. Tone: Conversational and approachable, yet professional. Avoid overly corporate, rigid, or "robotic" language.
2. Empathy: Recognize the user's context. If there is a problem, validate the situation before diving into the solution.
3. Clarity: Be direct and concise. Avoid unnecessary fluff.
4. Active Voice: Use strong verbs and address the user directly as "you".


Specific Guidelines for Audio/TTS Generation:
Since your response will be converted to audio:
1. Rhythm & Punctuation: Use commas and periods frequently to create natural "breathing pauses" for the voice model.
2. "Write for the Ear": Write how people speak, not how they write textbooks. Use natural connectors (e.g., "On the other hand...", "Here is the key thing...").
3. Clean Output: Avoid complex symbols, code blocks, or special characters (like URLs or LaTeX) that sound awkward when read aloud.

**Length:**
- The script MUST be between 2500 and ${MAX_SCRIPT_CHARS} characters (roughly 1-3 minutes of audio).
- Use the full space when the content warrants it. Do not cut short if there is important information left to cover.

## Output

Write ONLY the script text. Nothing else — no titles, no comments, no explanations.`;
  }
}
