import multer from 'multer';
import { env } from '../../config/env';

// Broad allow-list covering the file formats required by the spec (office docs, media,
// archives, CAD, markup, email, ebooks). Buffered in memory so we can checksum + encrypt
// before handing off to the storage driver.
const ALLOWED_MIME_PATTERNS = [
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument/,
  /^application\/vnd\.ms-excel$/,
  /^application\/vnd\.ms-powerpoint$/,
  /^image\//,
  /^video\//,
  /^audio\//,
  /^text\//,
  /^application\/csv$/,
  /^application\/zip$/,
  /^application\/x-rar-compressed$/,
  /^application\/x-rar$/,
  /^application\/vnd\.dwg$/,
  /^image\/vnd\.dwg$/,
  /^application\/dxf$/,
  /^text\/html$/,
  /^application\/xml$/,
  /^text\/xml$/,
  /^application\/json$/,
  /^message\/rfc822$/,
  /^application\/epub\+zip$/,
  /^application\/x-mobipocket-ebook$/,
  /^application\/octet-stream$/, // fallback for CAD/proprietary formats browsers can't classify
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(file.mimetype));
    if (!allowed) {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
