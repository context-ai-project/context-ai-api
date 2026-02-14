import { Injectable } from '@nestjs/common';
import { SourceType } from '@shared/types';
import { extractErrorMessage } from '@shared/utils';
import pdf from 'pdf-parse';

// Type definition for pdf-parse result (based on @types/pdf-parse)
interface PdfParseResult {
  text: string;
  numpages: number;
  info: Record<string, unknown>;
}

// Constants for buffer validation and parsing
const PDF_SIGNATURE_LENGTH = 4;
const PDF_SIGNATURE = '%PDF';

/**
 * Named regex patterns for Markdown syntax stripping.
 * Each pattern handles a specific Markdown syntax element.
 * Extracted as constants for readability, testability, and maintainability.
 */
const MARKDOWN_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
}> = [
  { pattern: /^#{1,6}\s+/gm, replacement: '' }, // headers
  { pattern: /(\*\*|__)(.*?)\1/g, replacement: '$2' }, // bold
  { pattern: /[*_]([^*_]+)[*_]/g, replacement: '$1' }, // italic
  { pattern: /~~([^~]+)~~/g, replacement: '$1' }, // strikethrough
  { pattern: /!\[([^\]]{0,200})\]\(([^)]{1,500})\)/g, replacement: '$1' }, // images
  { pattern: /\[([^\]]{1,500})\]\(([^)]{1,500})\)/g, replacement: '$1 ($2)' }, // links
  { pattern: /```[a-z]{0,20}\n?([^`]{1,10000})```/g, replacement: '$1' }, // code blocks
  { pattern: /`([^`]+)`/g, replacement: '$1' }, // inline code
  { pattern: /^(\*{3,}|-{3,}|_{3,})$/gm, replacement: '' }, // horizontal rules
  { pattern: /^>\s+/gm, replacement: '' }, // blockquotes
  { pattern: /^\s{0,10}[-*+]\s+/gm, replacement: '' }, // unordered lists
  { pattern: /^\s{0,10}\d+\.\s+/gm, replacement: '' }, // ordered lists
];

/**
 * Document Parser Service
 *
 * Responsible for parsing different document formats (PDF, Markdown)
 * and extracting plain text content.
 *
 * Supported formats:
 * - PDF: Uses pdf-parse library
 * - Markdown: Uses marked library to strip syntax
 */
@Injectable()
export class DocumentParserService {
  /**
   * Parses a document buffer and extracts text content
   * @param buffer - The document buffer
   * @param sourceType - The type of document (PDF, MARKDOWN)
   * @returns Parsed content and metadata
   */
  async parse(buffer: Buffer, sourceType: SourceType): Promise<ParsedDocument> {
    this.validateBuffer(buffer);

    const sourceTypeStr = String(sourceType);
    const PDF = 'PDF';
    const MARKDOWN = 'MARKDOWN';

    if (sourceTypeStr === PDF) {
      return this.parsePdf(buffer);
    } else if (sourceTypeStr === MARKDOWN) {
      return this.parseMarkdown(buffer);
    } else {
      throw new Error(`Unsupported source type: ${sourceTypeStr}`);
    }
  }

  /**
   * Parses a PDF document
   * @param buffer - The PDF buffer
   * @returns Parsed PDF content
   */
  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Parse PDF using pdf-parse (official Genkit pattern)
      // Pattern: const data = await pdf(dataBuffer);
      const data = (await pdf(buffer)) as PdfParseResult;

      // Normalize the extracted text
      const content = this.normalizeContent(data.text);

      // Extract metadata using Map to avoid bracket-notation security warnings
      // Guard against missing data.info (some PDFs omit metadata)
      const info: Record<string, unknown> =
        data.info && typeof data.info === 'object' ? data.info : {};

      const metadataKeys = new Set([
        'Title',
        'Author',
        'Subject',
        'Keywords',
        'Creator',
        'Producer',
        'CreationDate',
        'ModDate',
      ]);

      const pdfInfoEntries: Array<[string, string]> = [];
      for (const [key, value] of Object.entries(info)) {
        if (metadataKeys.has(key) && typeof value === 'string') {
          pdfInfoEntries.push([key, value]);
        }
      }
      const pdfInfo: Record<string, string> =
        Object.fromEntries(pdfInfoEntries);

      const pages: number = data.numpages;

      const parsedMetadata: ParsedDocument['metadata'] = {
        sourceType: SourceType.PDF,
        parsedAt: new Date().toISOString(),
        originalSize: buffer.length,
        pages,
        info: pdfInfo,
      };

      return {
        content,
        metadata: parsedMetadata,
      };
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${extractErrorMessage(error)}`);
    }
  }

  /**
   * Parses a Markdown document
   * @param buffer - The Markdown buffer
   * @returns Parsed Markdown content
   */
  private parseMarkdown(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const markdownText = buffer.toString('utf-8');

      // Strip markdown syntax to get plain text
      const plainText = this.stripMarkdownSyntax(markdownText);

      const content = this.normalizeContent(plainText);

      const parsedMetadata: ParsedDocument['metadata'] = {
        sourceType: SourceType.MARKDOWN,
        parsedAt: new Date().toISOString(),
        originalSize: buffer.length,
      };

      return Promise.resolve({
        content,
        metadata: parsedMetadata,
      });
    } catch (error) {
      return Promise.reject(
        new Error(`Failed to parse Markdown: ${extractErrorMessage(error)}`),
      );
    }
  }

  /**
   * Validates the input buffer
   * @param buffer - The buffer to validate
   */
  private validateBuffer(buffer: Buffer): void {
    if (buffer == null) {
      throw new Error('Buffer cannot be null or undefined');
    }

    if (buffer.length === 0) {
      throw new Error('Buffer cannot be empty');
    }
  }

  /**
   * Normalizes content by removing excessive whitespace and line breaks
   * @param content - The content to normalize
   * @returns Normalized content
   */
  private normalizeContent(content: string): string {
    return (
      content
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        // Replace multiple line breaks with double line break
        .replace(/\n{3,}/g, '\n\n')
        // Trim leading and trailing whitespace
        .trim()
    );
  }

  /**
   * Strips Markdown syntax from a string to get plain text
   * @param markdown - The Markdown string
   * @returns Plain text without Markdown syntax
   */
  private stripMarkdownSyntax(markdown: string): string {
    let result = markdown;
    for (const { pattern, replacement } of MARKDOWN_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * Checks if a buffer is likely a PDF
   * @param buffer - The buffer to check
   * @returns True if the buffer starts with PDF signature
   */
  public isPdfBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < PDF_SIGNATURE_LENGTH) {
      return false;
    }

    // PDF files start with %PDF
    const signature = buffer.toString('utf-8', 0, PDF_SIGNATURE_LENGTH);
    return signature === PDF_SIGNATURE;
  }
}

/**
 * Parsed document result
 */
export interface ParsedDocument {
  content: string;
  metadata: {
    sourceType: SourceType;
    parsedAt: string;
    originalSize: number;
    pages?: number;
    info?: Record<string, string>;
  };
}
