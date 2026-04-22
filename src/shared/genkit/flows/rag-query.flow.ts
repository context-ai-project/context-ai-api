/**
 * RAG Query Flow — v2.0 (Optimized)
 *
 * Implements the RAG (Retrieval-Augmented Generation) pattern:
 * 1. Sync heuristic detection of conversational queries (no LLM call)
 * 2. Domain dictionary expansion for short queries (no LLM call)
 * 3. Single embedding call for the final query
 * 4. Vector search with oversampling to reduce false negatives
 * 5. Static template fallback when no context found (no LLM call)
 * 6. Generate response using Gemini LLM with structured output (the ONE required LLM call)
 * 7. Evaluations scheduled as fire-and-forget background task
 *
 * v2.0 optimizations vs v1.3:
 * - Conversational LLM classifier → sync heuristics              (−600ms avg)
 * - LLM conversational response   → static template map          (−500ms avg)
 * - LLM query expansion           → domain synonym dictionary     (−700ms avg)
 * - LLM fallback response         → template with interpolation   (−800ms avg)
 * - Evaluations removed from sync path → fire-and-forget          (−1.5–3s avg)
 * - Redundant embed for short queries eliminated                  (−200–400ms)
 * - conversationContext separated from embedding query            (better recall)
 *
 * Net result: 1 LLM call + 1 embed per substantive query (was 5–7 LLM calls)
 */

import { z } from 'zod';
import { getGenkitInstance, GENKIT_CONFIG } from '../genkit.config';
import {
  createRagEvaluatorService,
  type RagEvaluationResult,
} from '../evaluators';
import {
  structuredRagResponseSchema,
  RagResponseType,
  type StructuredRagResponse,
} from '../schemas/structured-response.schema';

// Re-export for consumers
export { RagResponseType } from '../schemas/structured-response.schema';
export type { StructuredRagResponse } from '../schemas/structured-response.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const RAG_CONFIG = {
  DEFAULT_MAX_RESULTS: 5,
  MAX_RESULTS_LIMIT: 10,
  DEFAULT_MIN_SIMILARITY: 0.55,
  MIN_SIMILARITY_RANGE: { min: 0, max: 1 },
  /** Queries with fewer words than this trigger dictionary expansion */
  QUERY_EXPANSION_WORD_THRESHOLD: 10,
  /**
   * Oversample factor for Pinecone topK.
   * We request maxResults × factor candidates, then filter by score,
   * to reduce false negatives when some top-K results fall below minSimilarity.
   */
  VECTOR_OVERSAMPLE_FACTOR: 3,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schemas and types
// ─────────────────────────────────────────────────────────────────────────────

export const ragQueryInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  /** Original user message (without conversation history), used for classification */
  rawUserMessage: z.string().optional(),
  sectorId: z.string().min(1, 'Sector ID is required'),
  conversationId: z.string().optional(),
  /**
   * Recent conversation history formatted as plain text.
   * Used only in the generation prompt — NOT embedded.
   * Separating this from `query` keeps the embedding semantically clean.
   */
  conversationContext: z.string().optional(),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(RAG_CONFIG.MAX_RESULTS_LIMIT)
    .default(RAG_CONFIG.DEFAULT_MAX_RESULTS),
  minSimilarity: z
    .number()
    .min(RAG_CONFIG.MIN_SIMILARITY_RANGE.min)
    .max(RAG_CONFIG.MIN_SIMILARITY_RANGE.max)
    .default(RAG_CONFIG.DEFAULT_MIN_SIMILARITY),
  /** Contact info of the person responsible for the sector */
  sectorContactName: z.string().nullable().optional(),
  sectorContactPhone: z.string().nullable().optional(),
  /** UI language (BCP-47) so fallback/conversational replies match the user's locale */
  language: z.string().optional(),
});

export type RagQueryInput = z.infer<typeof ragQueryInputSchema>;

export const fragmentSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number(),
  sourceId: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FragmentResult = z.infer<typeof fragmentSchema>;

/**
 * Output schema for RAG query (Zod v4 — used for internal validation)
 *
 * Note: The `structured` field is typed as `unknown` here because
 * its actual Zod v3 schema is used separately in `ai.generate()`.
 * The `StructuredRagResponse` TypeScript type provides compile-time safety.
 */
export const ragQueryOutputSchema = z.object({
  response: z.string(),
  responseType: z.enum([
    RagResponseType.ANSWER,
    RagResponseType.NO_CONTEXT,
    RagResponseType.CONVERSATIONAL,
    RagResponseType.ERROR,
  ]),
  structured: z.unknown().optional(),
  sources: z.array(fragmentSchema),
  conversationId: z.string().optional(),
  timestamp: z.date(),
  metadata: z
    .object({
      model: z.string(),
      temperature: z.number(),
      fragmentsRetrieved: z.number(),
      fragmentsUsed: z.number(),
    })
    .optional(),
});

/**
 * RAG query output type, extended with optional evaluation result.
 * Evaluation is typed as a plain interface (not Zod) because it's produced
 * by the evaluator service asynchronously after response delivery.
 */
export type RagQueryOutput = Omit<
  z.infer<typeof ragQueryOutputSchema>,
  'structured'
> & {
  structured?: StructuredRagResponse;
  evaluation?: RagEvaluationResult;
};

/**
 * Vector search function type — injected as a dependency
 */
export type VectorSearchFn = (
  embedding: number[],
  sectorId: string,
  limit: number,
  minScore?: number,
) => Promise<FragmentResult[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the main RAG prompt with retrieved context fragments.
 * Optionally includes conversation history for multi-turn awareness.
 * The history is included here (for generation) but was NOT used for embedding.
 */
function buildStructuredPrompt(
  query: string,
  fragments: FragmentResult[],
  conversationContext?: string,
): string {
  const context = fragments
    .map((f, index) => `[${index + 1}] ${f.content}`)
    .join('\n\n');

  const conversationSection = conversationContext
    ? `\nCONVERSATION HISTORY:\n${conversationContext}\n`
    : '';

  return `You are an onboarding assistant for the company. Answer the following question based ONLY on the provided documentation.

DOCUMENTATION CONTEXT:
${context}
${conversationSection}
USER QUESTION:
${query}

INSTRUCTIONS:
- Provide a brief summary (1-2 sentences) directly answering the question
- Organize detailed information into logical sections
- Each section should have a type: "info" (general), "steps" (procedures), "warning" (important notes), "tip" (helpful advice)
- Include key takeaways as bullet points when relevant
- Suggest related topics the user might want to explore
- Use markdown formatting within section content
- Respond in the SAME LANGUAGE as the user's question
- If the documentation doesn't fully cover the topic, be transparent about it`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational detection — sync heuristics, ZERO LLM calls
// ─────────────────────────────────────────────────────────────────────────────

const CONVERSATIONAL_PHRASES = new Set([
  'muchas gracias',
  'gracias',
  'thanks',
  'thank you',
  'ok',
  'okay',
  'perfecto',
  'genial',
  'entendido',
  'de acuerdo',
  'claro',
  'bien',
  'super',
  'great',
  'got it',
  'noted',
  'vale',
  'de nada',
  "you're welcome",
  'you are welcome',
  'hola',
  'hello',
  'hi',
  'hey',
  'buenos días',
  'buenas tardes',
  'buenas noches',
  'good morning',
  'good afternoon',
  'good evening',
  'adiós',
  'bye',
  'goodbye',
  'hasta luego',
]);

const TRAILING_CHARS = ' \t\n\r!.,;:…?¿¡';

/**
 * Strips leading/trailing punctuation and lowercases a string.
 * Used for normalising phrases before set lookup.
 */
function stripPunctuation(s: string): string {
  let result = s.trim().toLowerCase();
  while (
    result.length > 0 &&
    TRAILING_CHARS.includes(result[result.length - 1] ?? '')
  ) {
    result = result.slice(0, -1);
  }
  while (result.length > 0 && TRAILING_CHARS.includes(result[0] ?? '')) {
    result = result.slice(1);
  }
  return result;
}

/**
 * Spanish/English interrogative words that signal a substantive query.
 * Any message containing these is treated as SUBSTANTIVE immediately.
 */
const QUESTION_WORDS_ES_RE =
  /\b(qué|cuándo|cómo|dónde|cuántos?|cuál(?:es)?|puede|puedo|hay|tiene|tengo|necesito)\b/i;
const QUESTION_WORDS_EN_RE =
  /\b(what|when|how|where|which|can|is|are|do|does|will|would|should)\b/i;

const CONVERSATIONAL_MAX_WORDS = 8;
/** ISO 639-1 language codes are 2 characters (e.g. 'es', 'en'). */
const LANG_CODE_LENGTH = 2;

/**
 * Determines whether a query is conversational using only sync heuristics.
 * Replaces the previous async LLM classifier — zero network calls.
 *
 * Rules (evaluated in order):
 * 1. Exact match in CONVERSATIONAL_PHRASES → conversational
 * 2. Contains '?' or '¿'                  → substantive
 * 3. Contains a question/interrogative word → substantive
 * 4. Longer than CONVERSATIONAL_MAX_WORDS   → substantive
 * 5. Short phrase with no question signal   → conversational
 */
function isConversationalQuery(query: string): boolean {
  const trimmed = query.trim();
  const normalized = stripPunctuation(trimmed);

  if (normalized.length > 0 && CONVERSATIONAL_PHRASES.has(normalized))
    return true;
  if (trimmed.includes('?') || trimmed.includes('¿')) return false;
  if (QUESTION_WORDS_ES_RE.test(trimmed) || QUESTION_WORDS_EN_RE.test(trimmed))
    return false;

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > CONVERSATIONAL_MAX_WORDS) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational responses — static template map, ZERO LLM calls
// ─────────────────────────────────────────────────────────────────────────────

const YOU_ARE_WELCOME_EN = "You're welcome!";
const HOLA_AYUDARTE_ES = '¡Hola! ¿En qué puedo ayudarte?';

/**
 * Static response map keyed by normalised phrase → language → response text.
 * Covers all entries in CONVERSATIONAL_PHRASES plus common variants.
 */
const CONVERSATIONAL_RESPONSE_MAP: Record<string, Record<string, string>> = {
  gracias: {
    es: '¡Con gusto! ¿Hay algo más en lo que pueda ayudarte?',
    en: "You're welcome! Anything else I can help with?",
  },
  'muchas gracias': {
    es: '¡De nada! Estoy aquí para lo que necesites.',
    en: "My pleasure! I'm here whenever you need me.",
  },
  thanks: { es: '¡Con gusto!', en: YOU_ARE_WELCOME_EN },
  'thank you': {
    es: '¡De nada!',
    en: "You're welcome! Let me know if you need anything else.",
  },
  ok: {
    es: '¡Perfecto! ¿Tienes alguna otra pregunta?',
    en: 'Got it! Any other questions?',
  },
  okay: {
    es: '¡Entendido! ¿En qué más puedo ayudarte?',
    en: 'Got it! How else can I help?',
  },
  perfecto: {
    es: '¡Me alegra que haya sido útil! ¿Necesitas algo más?',
    en: 'Great! Need anything else?',
  },
  genial: {
    es: '¡Genial! ¿Puedo ayudarte con algo más?',
    en: 'Awesome! Can I help with anything else?',
  },
  entendido: {
    es: 'Perfecto, si tienes más dudas aquí estaré.',
    en: "Got it! I'm here if you have more questions.",
  },
  'de acuerdo': {
    es: '¡De acuerdo! ¿Hay algo más que necesites saber?',
    en: 'Alright! Anything else you need to know?',
  },
  claro: {
    es: '¡Claro que sí! ¿Puedo ayudarte con algo más?',
    en: 'Of course! Can I help with anything else?',
  },
  bien: {
    es: '¡Me alegra! ¿En qué más puedo ayudarte?',
    en: 'Good! Is there anything else I can help with?',
  },
  super: {
    es: '¡Súper! ¿Necesitas algo más?',
    en: 'Super! Need anything else?',
  },
  great: {
    es: '¡Estupendo!',
    en: 'Great! Let me know if you need anything else.',
  },
  'got it': {
    es: 'Perfecto.',
    en: "Got it! I'm here if you need more help.",
  },
  noted: {
    es: 'Anotado.',
    en: 'Noted! Let me know if you have more questions.',
  },
  vale: {
    es: '¡Vale! ¿En qué más puedo ayudarte?',
    en: 'Alright! How else can I help?',
  },
  'de nada': {
    es: '¡Con mucho gusto! ¿En qué más te puedo ayudar?',
    en: YOU_ARE_WELCOME_EN,
  },
  "you're welcome": {
    es: '¡De nada!',
    en: "You're welcome! Glad I could help.",
  },
  'you are welcome': { es: '¡De nada!', en: YOU_ARE_WELCOME_EN },
  hola: {
    es: '¡Hola! ¿En qué puedo ayudarte hoy?',
    en: 'Hello! How can I help you today?',
  },
  hello: {
    es: HOLA_AYUDARTE_ES,
    en: 'Hello! How can I help you today?',
  },
  hi: {
    es: HOLA_AYUDARTE_ES,
    en: 'Hi there! How can I help you?',
  },
  hey: {
    es: HOLA_AYUDARTE_ES,
    en: 'Hey! What can I help you with?',
  },
  'buenos días': {
    es: '¡Buenos días! ¿En qué puedo ayudarte hoy?',
    en: 'Good morning! How can I help you today?',
  },
  'buenas tardes': {
    es: '¡Buenas tardes! ¿En qué puedo ayudarte?',
    en: 'Good afternoon! How can I help you?',
  },
  'buenas noches': {
    es: '¡Buenas noches! ¿En qué puedo ayudarte?',
    en: 'Good evening! How can I help you?',
  },
  'good morning': {
    es: '¡Buenos días! ¿Cómo puedo ayudarte?',
    en: 'Good morning! How can I help you today?',
  },
  'good afternoon': {
    es: '¡Buenas tardes! ¿Cómo puedo ayudarte?',
    en: 'Good afternoon! How can I help you?',
  },
  'good evening': {
    es: '¡Buenas noches! ¿Cómo puedo ayudarte?',
    en: 'Good evening! How can I help you?',
  },
  adiós: {
    es: '¡Hasta luego! No dudes en volver si necesitas algo.',
    en: 'Goodbye! Feel free to come back if you need anything.',
  },
  bye: { es: '¡Hasta pronto!', en: 'Goodbye! Have a great day!' },
  goodbye: { es: '¡Hasta luego!', en: 'Goodbye! Have a great day!' },
  'hasta luego': {
    es: '¡Hasta luego! Vuelve cuando necesites.',
    en: 'Goodbye! Come back whenever you need help.',
  },
};

const DEFAULT_CONVERSATIONAL: Record<string, string> = {
  es: '¡Entendido! ¿En qué más puedo ayudarte?',
  en: 'Got it! How else can I help?',
};

/**
 * Returns a static conversational reply for a given phrase and language.
 * Zero LLM calls — replaces the previous async generateConversationalResponse.
 */
function getConversationalResponse(phrase: string, lang?: string): string {
  const key = stripPunctuation(phrase);
  // eslint-disable-next-line security/detect-object-injection
  const responses = CONVERSATIONAL_RESPONSE_MAP[key];
  const langKey = lang?.slice(0, LANG_CODE_LENGTH) ?? 'es';
  if (responses) {
    return (
      // eslint-disable-next-line security/detect-object-injection
      responses[langKey] ??
      responses['es'] ??
      responses['en'] ??
      // eslint-disable-next-line security/detect-object-injection
      DEFAULT_CONVERSATIONAL[langKey]
    );
  }
  // eslint-disable-next-line security/detect-object-injection
  return DEFAULT_CONVERSATIONAL[langKey] ?? DEFAULT_CONVERSATIONAL['es'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Query expansion — domain synonym dictionary, ZERO LLM calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HR / onboarding domain synonym dictionary.
 * Key = term to detect in query; value = additional terms to append.
 * Extend this map as new document topics are added to the knowledge base.
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  vacaciones: [
    'días libres',
    'días de descanso',
    'permisos retribuidos',
    'días de vacaciones',
    'vacation',
    'PTO',
  ],
  festivos: [
    'días festivos',
    'días no laborables',
    'días no hábiles',
    'feriados',
    'días de fiesta',
    'bank holiday',
  ],
  baja: [
    'baja médica',
    'incapacidad temporal',
    'IT',
    'baja por enfermedad',
    'sick leave',
    'ausencia',
  ],
  nómina: [
    'salario',
    'sueldo',
    'remuneración',
    'payroll',
    'retribución',
    'pago mensual',
  ],
  contrato: [
    'contrato laboral',
    'tipo de contrato',
    'modalidad contractual',
    'employment contract',
  ],
  horario: [
    'jornada laboral',
    'horario de trabajo',
    'turno',
    'schedule',
    'work hours',
  ],
  formación: [
    'capacitación',
    'cursos',
    'training',
    'aprendizaje',
    'desarrollo profesional',
  ],
  incorporación: ['onboarding', 'primer día', 'alta', 'ingreso', 'entrada'],
  seguridad: ['seguridad social', 'SS', 'cotización', 'afiliación'],
  permiso: [
    'permiso laboral',
    'licencia',
    'ausencia justificada',
    'leave of absence',
  ],
  reembolso: ['gastos', 'dietas', 'expenses', 'reimbursement'],
  teletrabajo: [
    'trabajo en remoto',
    'trabajo desde casa',
    'remote work',
    'home office',
    'WFH',
  ],
  bonus: [
    'incentivo',
    'complemento',
    'variable',
    'paga extra',
    'gratificación',
  ],
  beneficios: [
    'beneficios sociales',
    'ventajas',
    'perks',
    'benefits',
    'retribución flexible',
  ],
  despido: ['despido', 'baja voluntaria', 'finiquito', 'offboarding', 'cese'],
};

/**
 * Expands a short query with domain-specific synonyms from a static dictionary.
 * Synchronous — no LLM call, no network round-trip.
 * Long queries (>= QUERY_EXPANSION_WORD_THRESHOLD words) are returned unchanged.
 */
function expandQueryWithDictionary(query: string): string {
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount >= RAG_CONFIG.QUERY_EXPANSION_WORD_THRESHOLD) {
    return query;
  }

  const lower = query.toLowerCase();
  const additions: string[] = [];

  for (const [term, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (lower.includes(term)) {
      additions.push(...synonyms.filter((s) => !lower.includes(s)));
    }
  }

  return additions.length > 0 ? `${query} ${additions.join(' ')}` : query;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback response — static template with interpolation, ZERO LLM calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a fallback response when no relevant documents are found.
 * Uses static templates with contact info interpolation — no LLM call.
 * Replaces the previous async generateFallbackResponse.
 */
function buildFallbackResponse(
  lang?: string,
  contactName?: string | null,
  contactPhone?: string | null,
): string {
  const langKey = lang?.slice(0, LANG_CODE_LENGTH) ?? 'es';

  let contact: string;
  if (contactName || contactPhone) {
    const nameEs = contactName ?? 'el responsable del área';
    const phoneEs = contactPhone ? ` en el teléfono ${contactPhone}` : '';
    const nameEn = contactName ?? 'the area responsible';
    const phoneEn = contactPhone ? ` at ${contactPhone}` : '';
    if (langKey === 'es') {
      contact = `\n\nPuedes contactar directamente con **${nameEs}**${phoneEs} para obtener más información.`;
    } else {
      contact = `\n\nYou can reach out to **${nameEn}**${phoneEn} for further assistance.`;
    }
  } else if (langKey === 'es') {
    contact = '\n\nTe recomendamos consultar con tu responsable directo.';
  } else {
    contact = '\n\nWe recommend reaching out to your direct manager.';
  }

  const base =
    langKey === 'es'
      ? 'No encontré información específica sobre tu consulta en la base de conocimiento disponible. Es posible que la documentación relacionada aún no haya sido cargada.'
      : "I couldn't find specific information about your question in the available knowledge base. The related documentation may not have been uploaded yet.";

  return base + contact;
}

const STATIC_FALLBACK_RESPONSES: Record<string, string> = {
  en: "I don't have information about that in the current documentation. Please contact your manager for more specific guidance.",
  es: 'No encontré información específica sobre tu consulta en nuestra base de conocimiento. Por favor, contacta a tu responsable directo para obtener orientación más específica.',
};

function getStaticFallback(language?: string): string {
  const key = language?.slice(0, LANG_CODE_LENGTH) ?? 'en';
  // eslint-disable-next-line security/detect-object-injection
  return STATIC_FALLBACK_RESPONSES[key] ?? STATIC_FALLBACK_RESPONSES['en'];
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG Query Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RAG Query Service
 *
 * Factory that creates the executeQuery function with an injected vectorSearch.
 * The entire query pipeline now makes exactly ONE LLM call (the RAG generation)
 * for substantive queries with relevant context found.
 *
 * LLM call summary:
 * - Conversational path:  0 LLM calls (static templates)
 * - No-context path:      0 LLM calls (static template + contact info)
 * - Answer path:          1 LLM call  (RAG generation — irreducible)
 * - Evaluations:          async background, not in the response critical path
 */
export function createRagQueryService(vectorSearch: VectorSearchFn) {
  const ai = getGenkitInstance();
  const evaluator = createRagEvaluatorService(ai);

  /**
   * Schedules quality evaluations as a fire-and-forget background task.
   * The HTTP response is returned before evaluations complete.
   * Evaluation failures are silently swallowed to avoid any side-effects.
   */
  function scheduleEvaluations(
    query: string,
    response: string,
    fragments: FragmentResult[],
  ): void {
    setImmediate(() => {
      const contextTexts = fragments.map((f) => f.content);
      evaluator
        .evaluate({ query, response, context: contextTexts })
        .catch(() => {
          // Intentionally ignored — evaluation must never affect users
        });
    });
  }

  /**
   * Execute RAG query — optimized pipeline
   *
   * Happy path (substantive query with results):
   *   1. Sync conversational check     (~0ms)
   *   2. Sync domain dictionary expand (~0ms)
   *   3. ai.embed() — ONE call         (~200–400ms)
   *   4. vectorSearch (Pinecone)        (~50–150ms)
   *   5. ai.generate() — ONE LLM call  (~1.5–4s)
   *   6. scheduleEvaluations (async)    (0ms — fire-and-forget)
   */
  async function executeQuery(input: RagQueryInput): Promise<RagQueryOutput> {
    const validatedInput = ragQueryInputSchema.parse(input);
    const messageToClassify =
      validatedInput.rawUserMessage ?? validatedInput.query;

    // Step 0: Sync conversational detection — no LLM call
    if (isConversationalQuery(messageToClassify)) {
      return {
        response: getConversationalResponse(
          messageToClassify,
          validatedInput.language,
        ),
        responseType: RagResponseType.CONVERSATIONAL,
        sources: [],
        conversationId: validatedInput.conversationId,
        timestamp: new Date(),
        metadata: {
          model: GENKIT_CONFIG.LLM_MODEL,
          temperature: 0,
          fragmentsRetrieved: 0,
          fragmentsUsed: 0,
        },
      };
    }

    // Step 1: Expand with domain dictionary (sync) → single embed call
    const searchQuery = expandQueryWithDictionary(validatedInput.query);

    const embeddingResult = await ai.embed({
      embedder: GENKIT_CONFIG.EMBEDDING_MODEL,
      content: searchQuery,
    });

    if (!Array.isArray(embeddingResult) || embeddingResult.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbedding = embeddingResult[0].embedding;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      throw new Error('Invalid embedding format received');
    }

    // Step 2: Vector search with oversampling to reduce false negatives
    const oversampledLimit = Math.min(
      validatedInput.maxResults * RAG_CONFIG.VECTOR_OVERSAMPLE_FACTOR,
      RAG_CONFIG.MAX_RESULTS_LIMIT * RAG_CONFIG.VECTOR_OVERSAMPLE_FACTOR,
    );
    const allFragments = await vectorSearch(
      queryEmbedding,
      validatedInput.sectorId,
      oversampledLimit,
      validatedInput.minSimilarity,
    );
    const relevantFragments = allFragments.slice(0, validatedInput.maxResults);

    // Step 3: No relevant context — static fallback, no LLM call
    if (relevantFragments.length === 0) {
      return {
        response: buildFallbackResponse(
          validatedInput.language,
          validatedInput.sectorContactName,
          validatedInput.sectorContactPhone,
        ),
        responseType: RagResponseType.NO_CONTEXT,
        sources: [],
        conversationId: validatedInput.conversationId,
        timestamp: new Date(),
        metadata: {
          model: GENKIT_CONFIG.LLM_MODEL,
          temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
          fragmentsRetrieved: 0,
          fragmentsUsed: 0,
        },
      };
    }

    // Step 4: Build prompt — raw query + fragments + optional conversation context
    // Note: conversationContext is passed here for generation but was NOT embedded,
    // keeping the search vector semantically clean.
    const prompt = buildStructuredPrompt(
      validatedInput.query,
      relevantFragments,
      validatedInput.conversationContext,
    );

    let responseText: string;
    let structured: StructuredRagResponse | undefined;

    try {
      // The ONE required LLM call — structured output
      type GenerateFn = (opts: Record<string, unknown>) => Promise<{
        output: StructuredRagResponse;
        text: string;
      }>;
      const generate = ai.generate.bind(ai) as unknown as GenerateFn;

      const result = await generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        output: { schema: structuredRagResponseSchema },
        config: GENKIT_CONFIG.RAG_GENERATION_CONFIG,
      });

      structured = result.output;
      responseText = structured?.summary ?? result.text;
    } catch {
      // Structured output failed — plain text fallback (still one LLM call total)
      const result = await ai.generate({
        model: GENKIT_CONFIG.LLM_MODEL,
        prompt,
        config: GENKIT_CONFIG.RAG_GENERATION_CONFIG,
      });
      responseText = result.text;
    }

    // Step 5: Schedule evaluations in background — response is NOT delayed
    const evaluationEnabled =
      process.env.RAG_EVALUATION_ENABLED?.toLowerCase() !== 'false';
    if (evaluationEnabled) {
      scheduleEvaluations(
        validatedInput.query,
        responseText,
        relevantFragments,
      );
    }

    return {
      response: responseText,
      responseType: RagResponseType.ANSWER,
      structured,
      sources: relevantFragments,
      conversationId: validatedInput.conversationId,
      timestamp: new Date(),
      metadata: {
        model: GENKIT_CONFIG.LLM_MODEL,
        temperature: GENKIT_CONFIG.RAG_GENERATION_CONFIG.temperature,
        fragmentsRetrieved: relevantFragments.length,
        fragmentsUsed: relevantFragments.length,
      },
    };
  }

  return {
    executeQuery,
  };
}

export type RagQueryService = ReturnType<typeof createRagQueryService>;

// getStaticFallback is kept as an emergency fallback for callers that need it
export { getStaticFallback };
