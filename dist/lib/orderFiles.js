"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderFileUpload = exports.MAX_ORDER_FILE_BYTES = exports.ORDER_FILES_DIR = void 0;
exports.ensureOrderFilesDir = ensureOrderFilesDir;
exports.isAllowedOrderFile = isAllowedOrderFile;
exports.absoluteOrderFilePath = absoluteOrderFilePath;
exports.collectFileRefsFromAnswers = collectFileRefsFromAnswers;
exports.linkOrderFiles = linkOrderFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const prisma_1 = require("./prisma");
exports.ORDER_FILES_DIR = path_1.default.join(process.cwd(), 'uploads', 'order-files');
exports.MAX_ORDER_FILE_BYTES = 10 * 1024 * 1024;
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
function ensureOrderFilesDir() {
    if (!fs_1.default.existsSync(exports.ORDER_FILES_DIR)) {
        fs_1.default.mkdirSync(exports.ORDER_FILES_DIR, { recursive: true });
    }
}
function isAllowedOrderFile(file) {
    const ext = path_1.default.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT.has(ext))
        return true;
    if (file.mimetype === 'image/svg+xml')
        return false;
    if (file.mimetype.startsWith('image/') && ALLOWED_MIME.has(file.mimetype))
        return true;
    return ALLOWED_MIME.has(file.mimetype);
}
exports.orderFileUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            ensureOrderFilesDir();
            cb(null, exports.ORDER_FILES_DIR);
        },
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '';
            const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            cb(null, `${base}${ext}`);
        },
    }),
    limits: { fileSize: exports.MAX_ORDER_FILE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!isAllowedOrderFile(file)) {
            return cb(new Error('يُسمح فقط بالصور و PDF و Word (.doc/.docx)'));
        }
        cb(null, true);
    },
});
function absoluteOrderFilePath(storedName) {
    return path_1.default.join(exports.ORDER_FILES_DIR, path_1.default.basename(storedName));
}
function collectFileRefsFromAnswers(answers) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers))
        return [];
    const out = [];
    for (const [fieldId, value] of Object.entries(answers)) {
        if (!Array.isArray(value))
            continue;
        for (const item of value) {
            if (!item || typeof item !== 'object')
                continue;
            const ref = item;
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
async function linkOrderFiles(params) {
    for (const entry of params.itemFileMap) {
        if (!entry.fileIds.length)
            continue;
        await prisma_1.prisma.orderFile.updateMany({
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
