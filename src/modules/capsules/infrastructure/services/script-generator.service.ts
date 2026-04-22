import { Injectable, Logger, Inject } from '@nestjs/common';
import { getCapsuleGenkitInstance } from '@shared/genkit/capsules-genkit.config';
import { GENKIT_CONFIG } from '@shared/genkit/genkit.config';
import { extractErrorMessage } from '@shared/utils';
import {
  parseVideoScenes,
  type VideoScene,
} from '../../domain/value-objects/video-scene.vo';
import type { IVectorStore } from '../../../knowledge/domain/services/vector-store.interface';
import { EmbeddingService } from '../../../knowledge/infrastructure/services/embedding.service';
import { EmbeddingTaskType } from '../../../knowledge/infrastructure/services/embedding.service';

const SCRIPT_TEMPERATURE = 0.4;
const SCRIPT_MAX_OUTPUT_TOKENS = 4096;
const RAG_TOP_K = 25;
const RAG_MIN_SCORE = 0.45;
const MAX_CONTEXT_CHARS = 16000;

const DESCRIPTION_TEMPERATURE = 0.3;
const DESCRIPTION_MAX_TOKENS = 256;
const MAX_DESCRIPTION_CHARS = 300;
const ELLIPSIS_LENGTH = 3;
const VIDEO_SCRIPT_TEMPERATURE = 0.5;
const VIDEO_SCRIPT_MAX_TOKENS = 8192;
const MAX_SCENES = 8;
const MAX_SCRIPT_WORDS = 250;

const FALLBACK_QUERIES: Record<string, string> = {
  es: 'principales conceptos y puntos clave del documento',
  en: 'main concepts and key points of the document',
};

/** Retry on 429 (Vertex AI temporary contention / TPM-RPM limit). */
const GEMINI_429_RETRY_WAIT_MS = 15_000;
const GEMINI_429_MAX_RETRIES = 3;
const MS_PER_SECOND = 1_000;
/** ISO 639-1 language codes are 2 characters (e.g. 'es', 'en'). */
const LANG_CODE_LENGTH = 2;

export interface GenerateScriptInput {
  sourceIds: string[];
  sectorId: string;
  introText?: string | null;
  language?: string;
}

export interface GenerateScriptResult {
  script: string;
  description: string;
  tokensUsed?: number;
}

export interface GenerateVideoScriptResult {
  scenes: VideoScene[];
  scriptJson: string;
  description: string;
}

@Injectable()
export class ScriptGeneratorService {
  private readonly logger = new Logger(ScriptGeneratorService.name);

  constructor(
    @Inject('IVectorStore')
    private readonly vectorStore: IVectorStore,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Calls Gemini generateContent with retry on 429 (Resource Exhausted).
   * Vertex AI 429 means temporary contention / TPM-RPM limit, not daily quota exhausted.
   */
  private async callGenerateWithRetry(
    prompt: string,
    config: { temperature: number; maxOutputTokens: number },
  ): Promise<string> {
    const ai = getCapsuleGenkitInstance();
    for (let attempt = 0; attempt <= GEMINI_429_MAX_RETRIES; attempt++) {
      try {
        const response = await ai.generate({
          model: GENKIT_CONFIG.LLM_MODEL,
          prompt,
          config,
        });
        return response.text?.trim() ?? '';
      } catch (error: unknown) {
        const message = extractErrorMessage(error);
        const is429 =
          message.includes('429') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('Resource exhausted');
        if (is429 && attempt < GEMINI_429_MAX_RETRIES) {
          const waitMs = GEMINI_429_RETRY_WAIT_MS * (attempt + 1);
          this.logger.warn(
            `Gemini 429 (attempt ${attempt + 1}/${GEMINI_429_MAX_RETRIES + 1}), waiting ${waitMs / MS_PER_SECOND}s before retry`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Gemini generateContent failed after retries');
  }

  async generate(input: GenerateScriptInput): Promise<GenerateScriptResult> {
    this.logger.log(
      `Generating script for sector ${input.sectorId} with ${input.sourceIds.length} source(s)`,
    );

    const context = await this.buildRagContext(input, input.language);
    const prompt = this.buildAudioPrompt(
      context,
      input.introText,
      input.language,
    );

    try {
      const script = await this.callGenerateWithRetry(prompt, {
        temperature: SCRIPT_TEMPERATURE,
        maxOutputTokens: SCRIPT_MAX_OUTPUT_TOKENS,
      });

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

  async generateVideoScript(
    input: GenerateScriptInput,
  ): Promise<GenerateVideoScriptResult> {
    this.logger.log(
      `Generating video script (scenes) for sector ${input.sectorId}`,
    );

    const context = await this.buildRagContext(input, input.language);
    const prompt = this.buildVideoScenesPrompt(
      context,
      input.introText,
      input.language,
    );

    try {
      const rawText = await this.callGenerateWithRetry(prompt, {
        temperature: VIDEO_SCRIPT_TEMPERATURE,
        maxOutputTokens: VIDEO_SCRIPT_MAX_TOKENS,
      });

      if (!rawText) {
        throw new Error('LLM returned an empty response for video script');
      }

      const jsonString = this.extractJsonFromResponse(rawText);
      const scenes = parseVideoScenes(jsonString);

      this.logger.log(`Video script generated: ${scenes.length} scenes`);

      const description = await this.generateDescription(
        scenes.map((s) => s.textToNarrate).join(' '),
      );

      return { scenes, scriptJson: jsonString, description };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Video script generation failed: ${message}`);
      throw new Error(`Failed to generate video script: ${message}`);
    }
  }

  private async generateDescription(script: string): Promise<string> {
    try {
      const description = await this.callGenerateWithRetry(
        `Summarize the following audio script in 1-2 sentences (max ${MAX_DESCRIPTION_CHARS} characters). The summary should describe what the capsule covers. Write it in the same language as the script. Output ONLY the summary, nothing else.\n\n${script}`,
        {
          temperature: DESCRIPTION_TEMPERATURE,
          maxOutputTokens: DESCRIPTION_MAX_TOKENS,
        },
      );
      if (!description) return '';

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

  private async buildRagContext(
    input: GenerateScriptInput,
    language?: string,
  ): Promise<string> {
    try {
      const langKey = language?.slice(0, LANG_CODE_LENGTH) ?? 'es';
      const queryText = input.introText?.trim()
        ? input.introText
        : // eslint-disable-next-line security/detect-object-injection
          (FALLBACK_QUERIES[langKey] ?? FALLBACK_QUERIES['es']);

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

      const sourceSet = new Set(input.sourceIds);
      const filtered = results.filter((r) =>
        sourceSet.has(r.metadata.sourceId),
      );

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
   * Converts an existing plain-text narrative script into structured
   * VideoScene[] JSON — used internally by the video generation pipeline
   * so the user never sees the raw JSON.
   */
  async convertScriptToScenes(
    narrativeScript: string,
    language?: string,
  ): Promise<GenerateVideoScriptResult> {
    this.logger.log('Converting narrative script to video scenes');

    const prompt = this.buildScriptToScenesPrompt(narrativeScript, language);

    try {
      const rawText = await this.callGenerateWithRetry(prompt, {
        temperature: VIDEO_SCRIPT_TEMPERATURE,
        maxOutputTokens: VIDEO_SCRIPT_MAX_TOKENS,
      });
      if (!rawText) {
        throw new Error('LLM returned an empty response for scene conversion');
      }

      const jsonString = this.extractJsonFromResponse(rawText);
      const scenes = parseVideoScenes(jsonString);

      this.logger.log(`Script converted to ${scenes.length} scenes`);

      const description = await this.generateDescription(narrativeScript);

      return { scenes, scriptJson: jsonString, description };
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      this.logger.error(`Script-to-scenes conversion failed: ${message}`);
      throw new Error(`Failed to convert script to video scenes: ${message}`);
    }
  }

  private buildLangInstruction(
    language?: string,
    variant: 'audio' | 'video' | 'scenes' = 'audio',
  ): string {
    if (language) {
      const scope =
        variant === 'audio'
          ? 'Every single word, sentence, and paragraph MUST be in'
          : 'This includes ALL "textToNarrate" narrations, ALL "titleOverlay" titles, and ALL "visualPrompt" descriptions. Do NOT use any other language';
      return `**LANGUAGE — MANDATORY RULE**: You MUST ${variant === 'audio' ? 'write the ENTIRE script' : 'generate the ENTIRE JSON response'} strictly in "${language}". ${scope} under any circumstance${variant === 'audio' ? ', regardless of the language of the source documents' : ''}.`;
    }
    return variant === 'scenes'
      ? 'Write in the same language as the script.'
      : 'Write in the same language as the source documents.';
  }

  private buildContextSections(
    context: string,
    introText: string | null | undefined,
  ): { contextSection: string; introSection: string } {
    const contextSection = context
      ? `<documents>\n${context}\n</documents>\n\n`
      : '';
    const introSection = introText?.trim()
      ? `<author_note>\n${introText.trim()}\n</author_note>\n\n`
      : '';
    return { contextSection, introSection };
  }

  private buildScriptToScenesPrompt(
    narrativeScript: string,
    language?: string,
  ): string {
    const langInstruction = this.buildLangInstruction(language, 'scenes');

    return `You are an expert instructional designer. Transform the following narrative script into a structured video script with ${MAX_SCENES} scenes maximum.

${langInstruction}

<script>
${narrativeScript}
</script>

## Output format

Return ONLY a JSON array. Each element must have exactly these fields:
- "textToNarrate": The narration text for this scene (2-4 sentences, taken or adapted from the script above)
- "visualPrompt": A detailed image generation prompt describing the visual for this scene (corporate/professional style, no text in image)
- "titleOverlay": A short title (3-6 words) to display on screen

## Rules
- Preserve the key information and tone from the original script
- Split the script into logical scenes that flow naturally
- Each scene should be self-contained
- Visual prompts should describe professional, corporate-style illustrations
- **CRITICAL**: The SUM of all "textToNarrate" fields across ALL scenes MUST NOT exceed ${MAX_SCRIPT_WORDS} words total. This ensures the video stays under 2 minutes. Be concise.
- Output ONLY the JSON array, no markdown, no explanation`;
  }

  private extractJsonFromResponse(text: string): string {
    const fenceStart = text.indexOf('```');
    if (fenceStart !== -1) {
      const contentStart = text.indexOf('\n', fenceStart);
      const fenceEnd = text.indexOf('```', contentStart);
      if (contentStart !== -1 && fenceEnd !== -1) {
        return text.substring(contentStart + 1, fenceEnd).trim();
      }
    }
    const bracketStart = text.indexOf('[');
    const bracketEnd = text.lastIndexOf(']');
    if (bracketStart !== -1 && bracketEnd > bracketStart) {
      return text.substring(bracketStart, bracketEnd + 1).trim();
    }
    return text;
  }

  private buildVideoScenesPrompt(
    context: string,
    introText: string | null | undefined,
    language?: string,
  ): string {
    const langInstruction = this.buildLangInstruction(language, 'video');
    const { contextSection, introSection } = this.buildContextSections(
      context,
      introText,
    );

    return `You are an expert instructional designer. Transform the provided documents into a structured video script with ${MAX_SCENES} scenes maximum.

${langInstruction}

${contextSection}${introSection}## Output format

Return ONLY a JSON array. Each element must have exactly these fields:
- "textToNarrate": The narration text for this scene (2-4 sentences, conversational tone)
- "visualPrompt": A detailed image generation prompt describing the visual for this scene (corporate/professional style, no text in image)
- "titleOverlay": A short title (3-6 words) to display on screen

## Rules
- Cover the most important concepts from the documents
- Each scene should be self-contained and flow logically to the next
- Visual prompts should describe professional, corporate-style illustrations
- **CRITICAL**: The SUM of all "textToNarrate" fields across ALL scenes MUST NOT exceed ${MAX_SCRIPT_WORDS} words total. This ensures the video stays under 2 minutes. Be concise and direct.
- Output ONLY the JSON array, no markdown, no explanation`;
  }

  private buildAudioPrompt(
    context: string,
    introText: string | null | undefined,
    language?: string,
  ): string {
    const langInstruction = this.buildLangInstruction(language, 'audio');
    const { contextSection, introSection } = this.buildContextSections(
      context,
      introText,
    );

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

Specific Guidelines for Audio/TTS Generation:
Since your response will be converted to audio:
1. Rhythm & Punctuation: Use commas and periods frequently to create natural "breathing pauses" for the voice model.
2. "Write for the Ear": Write how people speak, not how they write textbooks. Use natural connectors (e.g., "On the other hand...", "Here is the key thing...").
3. Clean Output: Avoid complex symbols, code blocks, or special characters (like URLs or LaTeX) that sound awkward when read aloud.

**Length — CRITICAL CONSTRAINT:**
- The script MUST NOT exceed ${MAX_SCRIPT_WORDS} words. This is a hard limit to keep the audio under 2 minutes (at ~150 words/minute).
- Be concise and direct. Prioritize the most essential information within this word budget.
- Do NOT pad the script with filler to reach a minimum — shorter is better than longer.

## Output

Write ONLY the script text. Nothing else — no titles, no comments, no explanations.`;
  }
}
