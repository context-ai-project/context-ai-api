import { DocumentParserService } from '../../../../../../src/modules/knowledge/infrastructure/services/document-parser.service';
import { SourceType } from '@context-ai/shared';
import * as fs from 'fs';
import * as path from 'path';

// Mock pdfjs-dist
jest.mock('pdfjs-dist', () => {
  return {
    getDocument: jest
      .fn()
      .mockImplementation((options: { data: Uint8Array }) => {
        // Check if buffer looks like a PDF
        const buffer = Buffer.from(options.data);
        const bufferString = buffer.toString(
          'utf-8',
          0,
          Math.min(buffer.length, 50),
        );

        // If it doesn't start with %PDF, reject
        if (!bufferString.startsWith('%PDF')) {
          return {
            promise: Promise.reject(new Error('Invalid PDF structure')),
          };
        }

        // Simulate successful PDF loading
        return {
          promise: Promise.resolve({
            numPages: 1,
            getMetadata: jest.fn().mockResolvedValue({
              info: {
                Title: 'Test PDF',
                Creator: 'Test Creator',
                Author: 'Test Author',
              },
            }),
            getPage: jest.fn().mockResolvedValue({
              getTextContent: jest.fn().mockResolvedValue({
                items: [
                  { str: 'Mocked', hasEOL: false },
                  { str: 'PDF', hasEOL: false },
                  { str: 'content', hasEOL: false },
                  { str: 'from', hasEOL: false },
                  { str: 'buffer', hasEOL: false },
                ],
              }),
            }),
          }),
        };
      }),
  };
});

describe('DocumentParserService', () => {
  let service: DocumentParserService;

  beforeEach(() => {
    service = new DocumentParserService();
    jest.clearAllMocks();
  });

  describe('PDF Parsing', () => {
    it('should parse a simple PDF file', async () => {
      // Arrange
      const pdfBuffer = await createMockPdfBuffer(
        'Este es un PDF de prueba con contenido.',
      );

      // Act
      const result = await service.parse(pdfBuffer, SourceType.PDF);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.sourceType).toBe(SourceType.PDF);
    });

    it('should extract text content from PDF', async () => {
      // Arrange
      const expectedText = 'Contenido de prueba en PDF';
      const pdfBuffer = await createMockPdfBuffer(expectedText);

      // Act
      const result = await service.parse(pdfBuffer, SourceType.PDF);

      // Assert
      expect(result.content).toContain('PDF');
    });

    it('should include metadata for PDF (pages, info)', async () => {
      // Arrange
      const pdfBuffer = await createMockPdfBuffer('Test content');

      // Act
      const result = await service.parse(pdfBuffer, SourceType.PDF);

      // Assert
      expect(result.metadata).toHaveProperty('sourceType', SourceType.PDF);
      expect(result.metadata).toHaveProperty('parsedAt');
      expect(result.metadata.parsedAt).toBeDefined();
      expect(
        result.metadata.parsedAt instanceof Date ||
          typeof result.metadata.parsedAt === 'string',
      ).toBe(true);
    });

    it('should throw error for invalid PDF buffer', async () => {
      // Arrange
      const invalidBuffer = Buffer.from('Not a PDF file');

      // Act & Assert
      await expect(
        service.parse(invalidBuffer, SourceType.PDF),
      ).rejects.toThrow();
    });

    it('should throw error for empty PDF buffer', async () => {
      // Arrange
      const emptyBuffer = Buffer.alloc(0);

      // Act & Assert
      await expect(service.parse(emptyBuffer, SourceType.PDF)).rejects.toThrow(
        'Buffer cannot be empty',
      );
    });

    it('should normalize whitespace in PDF content', async () => {
      // Arrange
      const pdfBuffer = await createMockPdfBuffer(
        'Text   with    multiple     spaces',
      );

      // Act
      const result = await service.parse(pdfBuffer, SourceType.PDF);

      // Assert
      // Multiple spaces should be normalized to single space
      expect(result.content).not.toMatch(/\s{2,}/);
    });
  });

  describe('Markdown Parsing', () => {
    it('should parse markdown content', async () => {
      // Arrange
      const markdown = `
# Título Principal

Este es un **documento** en *markdown* con:

- Lista item 1
- Lista item 2

## Subtítulo

Más contenido aquí.
      `;
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Título Principal');
      expect(result.content).toContain('documento');
      expect(result.content).toContain('Lista item 1');
      expect(result.metadata.sourceType).toBe(SourceType.MARKDOWN);
    });

    it('should strip markdown syntax and return plain text', async () => {
      // Arrange
      const markdown = '# Header\n\n**Bold** and *italic* text.';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      // Should not contain markdown syntax characters
      expect(result.content).not.toContain('**');
      expect(result.content).not.toContain('*');
      expect(result.content).not.toContain('#');
      expect(result.content).toContain('Header');
      expect(result.content).toContain('Bold');
      expect(result.content).toContain('italic');
    });

    it('should handle code blocks in markdown', async () => {
      // Arrange
      const markdown = `
# Code Example

\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\`
      `;
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.content).toContain('Code Example');
      expect(result.content).toContain('function hello');
    });

    it('should handle links in markdown', async () => {
      // Arrange
      const markdown = 'Check [this link](https://example.com) for more info.';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.content).toContain('this link');
      expect(result.content).toContain('example.com');
    });

    it('should throw error for empty markdown buffer', async () => {
      // Arrange
      const emptyBuffer = Buffer.alloc(0);

      // Act & Assert
      await expect(
        service.parse(emptyBuffer, SourceType.MARKDOWN),
      ).rejects.toThrow('Buffer cannot be empty');
    });

    it('should include metadata for Markdown', async () => {
      // Arrange
      const markdown = '# Test';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.metadata).toHaveProperty('sourceType', SourceType.MARKDOWN);
      expect(result.metadata).toHaveProperty('parsedAt');
      expect(result.metadata.parsedAt).toBeDefined();
      expect(
        result.metadata.parsedAt instanceof Date ||
          typeof result.metadata.parsedAt === 'string',
      ).toBe(true);
      expect(result.metadata).toHaveProperty('originalSize');
      expect(result.metadata.originalSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported source type', async () => {
      // Arrange
      const buffer = Buffer.from('content');
      const unsupportedType = 'DOCX' as SourceType;

      // Act & Assert
      await expect(service.parse(buffer, unsupportedType)).rejects.toThrow(
        'Unsupported source type: DOCX',
      );
    });

    it('should throw error for null buffer', async () => {
      // Arrange
      const nullBuffer = null as any;

      // Act & Assert
      await expect(service.parse(nullBuffer, SourceType.PDF)).rejects.toThrow(
        'Buffer cannot be null or undefined',
      );
    });

    it('should throw error for undefined buffer', async () => {
      // Arrange
      const undefinedBuffer = undefined as any;

      // Act & Assert
      await expect(
        service.parse(undefinedBuffer, SourceType.PDF),
      ).rejects.toThrow('Buffer cannot be null or undefined');
    });

    it('should provide meaningful error message on parse failure', async () => {
      // Arrange
      const corruptedBuffer = Buffer.from(
        'corrupted data that looks like PDF but is not',
      );

      // Act & Assert
      await expect(
        service.parse(corruptedBuffer, SourceType.PDF),
      ).rejects.toThrow();
    });
  });

  describe('Content Normalization', () => {
    it('should trim leading and trailing whitespace', async () => {
      // Arrange
      const markdown = '\n\n   # Title   \n\nContent  \n\n';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.content).not.toMatch(/^\s+/);
      expect(result.content).not.toMatch(/\s+$/);
    });

    it('should normalize line breaks (convert multiple to single)', async () => {
      // Arrange
      const markdown = 'Line 1\n\n\n\nLine 2';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      // Should not have 3+ consecutive line breaks
      expect(result.content).not.toMatch(/\n{3,}/);
    });

    it('should remove excessive whitespace', async () => {
      // Arrange
      const markdown = 'Word1     Word2       Word3';
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.content).not.toMatch(/\s{2,}/);
    });
  });

  describe('Utility Methods', () => {
    it('should detect if buffer is likely a PDF', () => {
      // Arrange
      const pdfBuffer = Buffer.from('%PDF-1.4');
      const textBuffer = Buffer.from('Just text');

      // Act & Assert
      expect(service.isPdfBuffer(pdfBuffer)).toBe(true);
      expect(service.isPdfBuffer(textBuffer)).toBe(false);
    });

    it('should estimate content size in bytes', async () => {
      // Arrange
      const markdown = 'a'.repeat(1000);
      const buffer = Buffer.from(markdown, 'utf-8');

      // Act
      const result = await service.parse(buffer, SourceType.MARKDOWN);

      // Assert
      expect(result.metadata.originalSize).toBeGreaterThan(900);
    });
  });
});

// ==================== Test Helpers ====================

/**
 * Creates a mock PDF buffer for testing
 * Note: This is a simplified mock. In real tests, use actual PDF files or a library like pdfkit.
 */
async function createMockPdfBuffer(content: string): Promise<Buffer> {
  // For testing purposes, we'll create a minimal PDF structure
  // In a real implementation, you would use a PDF generation library
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length ${content.length}
>>
stream
${content}
endstream
endobj
xref
0 5
trailer
<<
/Size 5
/Root 1 0 R
>>
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}
