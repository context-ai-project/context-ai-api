/**
 * Creates a minimal valid PDF buffer for testing
 *
 * This generates a simple PDF with text content that can be parsed by pdfjs-dist.
 * The PDF contains basic header, catalog, pages, and content stream.
 *
 * @param text - The text content to include in the PDF
 * @returns Buffer containing a valid PDF
 */
export function createTestPdfBuffer(text: string): Buffer {
  // Minimal valid PDF structure
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
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${text.length + 50}
>>
stream
BT
/F1 12 Tf
50 700 Td
(${text}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 

trailer
<<
/Size 5
/Root 1 0 R
>>

startxref
${400 + text.length}
%%EOF
`;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Creates a test PDF with predefined content
 *
 * @returns Buffer containing a test PDF document
 */
export function createDefaultTestPdf(): Buffer {
  const content = `Test PDF Document for Context.ai Integration Testing.

This document contains sample content to verify PDF parsing capabilities.

The system should be able to:
- Parse PDF content
- Extract text accurately
- Handle metadata
- Process multiple pages

This is a comprehensive test of the document ingestion pipeline.`;

  return createTestPdfBuffer(content);
}
