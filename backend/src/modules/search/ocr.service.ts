import { createWorker } from 'tesseract.js';
import { logger } from '../../config/logger';

const IMAGE_MIME_PREFIXES = ['image/'];
const PLAIN_TEXT_MIME_TYPES = ['text/plain', 'text/csv', 'application/json', 'application/xml', 'text/xml', 'text/html'];

/**
 * Extracts searchable text from a document buffer.
 * - Images: OCR via tesseract.js
 * - PDFs: text layer extraction via pdf-parse (falls back gracefully if the PDF is scanned/image-only)
 * - Plain-text formats (txt/csv/json/xml/html): decoded directly, no OCR needed
 * Runs out-of-band from the upload request so it never blocks the response.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    if (IMAGE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
      return await ocrImage(buffer);
    }
    if (mimeType === 'application/pdf') {
      return await extractPdfText(buffer);
    }
    if (PLAIN_TEXT_MIME_TYPES.includes(mimeType)) {
      return buffer.toString('utf-8').trim();
    }
    return null;
  } catch (err) {
    logger.warn('Text extraction failed', { error: (err as Error).message, mimeType });
    return null;
  }
}

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Lazy require avoids pdf-parse's debug-mode file read on module load in some environments.
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return (result.text ?? '').trim();
}
