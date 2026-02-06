import { Injectable } from '@nestjs/common';
import { SourceType } from '@context-ai/shared';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Constants for buffer validation and parsing
const PDF_SIGNATURE_LENGTH = 4;
const PDF_SIGNATURE = '%PDF';

/**
 * PDF metadata information
 * Contains standard PDF document properties
 */
interface PdfInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  [key: string]: string | undefined;
}

/**
 * Type guard to check if an item is a TextItem
 */
function isTextItem(item: unknown): item is TextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as TextItem).str === 'string'
  );
}

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
      // Load the PDF document using pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        verbosity: 0, // Suppress console logs
      });

      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      const textParts: string[] = [];

      // Extract metadata from PDF info
      const metadata = await pdfDocument.getMetadata();
      const pdfInfo: PdfInfo = {};

      if (metadata.info) {
        // Map common metadata fields
        const infoKeys = [
          'Title',
          'Author',
          'Subject',
          'Keywords',
          'Creator',
          'Producer',
          'CreationDate',
          'ModDate',
        ] as const;

        for (const key of infoKeys) {
          const value = metadata.info[key as keyof typeof metadata.info];
          if (typeof value === 'string') {
            // eslint-disable-next-line security/detect-object-injection -- Safe: key is from const array of known PDF metadata keys, type-checked before assignment
            pdfInfo[key] = value;
          }
        }
      }

      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Concatenate text items from the page
        const pageText = textContent.items
          .filter(isTextItem)
          .map((item) => item.str)
          .join(' ');

        textParts.push(pageText);
      }

      const content = this.normalizeContent(textParts.join('\n\n'));

      const pdfType: SourceType = 'PDF' as SourceType;
      const parsedMetadata: ParsedDocument['metadata'] = {
        sourceType: pdfType,
        parsedAt: new Date().toISOString(),
        originalSize: buffer.length,
        pages: numPages,
        info: pdfInfo,
      };

      return {
        content,
        metadata: parsedMetadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

      const markdownType: SourceType = 'MARKDOWN' as SourceType;
      const parsedMetadata: ParsedDocument['metadata'] = {
        sourceType: markdownType,
        parsedAt: new Date().toISOString(),
        originalSize: buffer.length,
      };

      return Promise.resolve({
        content,
        metadata: parsedMetadata,
      });
    } catch (error) {
      return Promise.reject(
        new Error(
          `Failed to parse Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
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
    return (
      markdown
        // Remove headers (# Header)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold (**text** or __text__)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        // Remove italic (*text* or _text_) - Using character class instead of alternation
        .replace(/[*_]([^*_]+)[*_]/g, '$1')
        // Remove strikethrough (~~text~~)
        .replace(/~~([^~]+)~~/g, '$1')
        // Remove links [text](url) - Using non-greedy with atomic grouping
        .replace(/\[([^\]]{1,500})\]\(([^)]{1,500})\)/g, '$1 ($2)')
        // Remove images ![alt](url) - Using limited length to prevent backtracking
        .replace(/!\[([^\]]{0,200})\]\(([^)]{1,500})\)/g, '$1')
        // Remove code blocks ```language\ncode\n``` - Limit language identifier and use atomic match
        .replace(/```[a-z]{0,20}\n?([^`]{1,10000})```/g, '$1')
        // Remove inline code `code`
        .replace(/`([^`]+)`/g, '$1')
        // Remove horizontal rules (---, ***, ___)
        .replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '')
        // Remove blockquotes (> text)
        .replace(/^>\s+/gm, '')
        // Remove list markers (-, *, +, 1.) - Limited whitespace to prevent ReDoS
        .replace(/^\s{0,10}[-*+]\s+/gm, '')
        .replace(/^\s{0,10}\d+\.\s+/gm, '')
    );
  }

  /**
   * Strips HTML tags from a string
   * @param html - The HTML string
   * @returns Plain text without HTML tags
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]{1,200}>/g, ' ') // Remove HTML tags - Limited length to prevent ReDoS
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&lt;/g, '<') // Decode HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&'); // Decode &amp; last to prevent double-unescaping
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
    info?: PdfInfo;
  };
}
