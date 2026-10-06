import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { prisma } from './prisma';

export const ORDER_FILES_DIR = path.join(process.cwd(), 'uploads', 'order-files');
export const MAX_ORDER_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.doc',
  '.docx',
]);

export type UploadedFileRef = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

export function ensureOrderFilesDir() {
  if (!fs.existsSync(ORDER_FILES_DIR)) {
    fs.mkdirSync(ORDER_FILES_DIR, { recursive: true });
  }
}

export function isAllowedOrderFile(file: { originalname: string; mimetype: string }): boolean {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXT.has(ext)) return true;
  if (file.mimetype === 'image/svg+xml') return false;
  if (file.mimetype.startsWith('image/') && ALLOWED_MIME.has(file.mimetype)) return true;
  return ALLOWED_MIME.has(file.mimetype);
}

export const orderFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureOrderFilesDir();
      cb(null, ORDER_FILES_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '';
      const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `${base}${ext}`);
    },
  }),
  limits: { fileSize: MAX_ORDER_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedOrderFile(file)) {
      return cb(new Error('يُسمح فقط بالصور و PDF و Word (.doc/.docx)'));
    }
    cb(null, true);
  },
});

export function absoluteOrderFilePath(storedName: string): string {
  return path.join(ORDER_FILES_DIR, path.basename(storedName));
}

export function collectFileRefsFromAnswers(answers: unknown): Array<UploadedFileRef & { fieldId: string }> {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];
  const out: Array<UploadedFileRef & { fieldId: string }> = [];
  for (const [fieldId, value] of Object.entries(answers as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const ref = item as Partial<UploadedFileRef>;
      if (typeof ref.id === 'string' && ref.id) {
        out.push({
          id: ref.id,
          name: String(ref.name || ''),
          url: String(ref.url || ''),
          size: Number(ref.size || 0),
          mimeType: String(ref.mimeType || ''),
          fieldId,
        });
      }
    }
  }
  return out;
}

export async function linkOrderFiles(params: {
  orderId: string;
  itemFileMap: Array<{ orderItemId: string; fileIds: string[] }>;
}) {
  for (const entry of params.itemFileMap) {
    if (!entry.fileIds.length) continue;
    await prisma.orderFile.updateMany({
      where: {
        id: { in: entry.fileIds },
        orderId: null,
      },
      data: {
        orderId: params.orderId,
        orderItemId: entry.orderItemId,
      },
    });
  }
}
