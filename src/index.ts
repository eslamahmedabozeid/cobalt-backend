import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import { publicCmsRouter, adminCmsRouter } from './routes/cms';
import aiRoutes from './routes/ai';

const app = express();
const port = Number(process.env.PORT || 4000);

const origins = (
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://localhost:3001,http://localhost:3002'
)
  .split(',')
  .map((s) => s.trim());

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api', publicRoutes);
app.use('/api', publicCmsRouter);
app.use('/api', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminCmsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found', code: 'NOT_FOUND' });
});

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production-cobalt-admin-secret' || process.env.JWT_SECRET === 'secret')) {
  console.error('FATAL: Set a strong JWT_SECRET in production');
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Cobalt backend listening on http://localhost:${port}`);
  const ai =
    process.env.GROQ_API_KEY?.trim()
      ? 'Groq (free)'
      : process.env.GEMINI_API_KEY?.trim()
        ? 'Gemini (free)'
        : 'offline knowledge fallback';
  console.log(`Customer AI: ${ai}`);
});
