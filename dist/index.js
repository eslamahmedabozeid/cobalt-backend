"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const public_1 = __importDefault(require("./routes/public"));
const admin_1 = __importDefault(require("./routes/admin"));
const cms_1 = require("./routes/cms");
const ai_1 = __importDefault(require("./routes/ai"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4000);
const origins = (process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    'http://localhost:3000,http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim());
app.use((0, cors_1.default)({
    origin: origins,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api', public_1.default);
app.use('/api', cms_1.publicCmsRouter);
app.use('/api', ai_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/admin', cms_1.adminCmsRouter);
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Not found', code: 'NOT_FOUND' });
});
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production-cobalt-admin-secret' || process.env.JWT_SECRET === 'secret')) {
    console.error('FATAL: Set a strong JWT_SECRET in production');
    process.exit(1);
}
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => {
    console.log(`Cobalt backend listening on http://${host}:${port}`);
    const ai = process.env.GROQ_API_KEY?.trim()
        ? 'Groq (free)'
        : process.env.GEMINI_API_KEY?.trim()
            ? 'Gemini (free)'
            : 'offline knowledge fallback';
    console.log(`Customer AI: ${ai}`);
});
