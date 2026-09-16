import { Router } from 'express';
import { ok, fail } from '../utils/response';
import { buildStoreKnowledge, offlineAnswer } from '../lib/aiKnowledge';
import { askFreeModel } from '../lib/aiProvider';

const router = Router();

const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_PER_HOUR || 30);
const RATE_WINDOW_MS = 60 * 60 * 1000;

let knowledgeCache: { text: string; at: number } | null = null;
const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;

function clientKey(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const row = rateMap.get(key);
  if (!row || now > row.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.count >= RATE_LIMIT) return false;
  row.count += 1;
  return true;
}

async function getKnowledge(): Promise<string> {
  if (knowledgeCache && Date.now() - knowledgeCache.at < KNOWLEDGE_TTL_MS) {
    return knowledgeCache.text;
  }
  const text = await buildStoreKnowledge();
  knowledgeCache = { text, at: Date.now() };
  return text;
}

router.get('/ai/status', async (_req, res) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  return ok(res, {
    enabled: true,
    free: true,
    provider: hasGroq ? 'groq' : hasGemini ? 'gemini' : 'offline',
    ready: true,
  });
});

router.post('/ai/ask', async (req, res) => {
  try {
    const key = clientKey(req as any);
    if (!allowRequest(key)) {
      return fail(res, 'تم تجاوز الحد المجاني للأسئلة. حاول لاحقاً أو تواصل عبر واتساب.', 429, undefined, 'RATE_LIMIT');
    }

    const question = String(req.body?.question || '').trim();
    if (!question || question.length < 2) {
      return fail(res, 'اكتب سؤالك من فضلك', 400);
    }
    if (question.length > 800) {
      return fail(res, 'السؤال طويل جداً', 400);
    }

    const historyRaw = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = historyRaw
      .slice(-6)
      .map((h: { role?: string; content?: string }) => ({
        role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(h.content || '').slice(0, 1000),
      }))
      .filter((h: { content: string }) => h.content);

    const knowledge = await getKnowledge();
    const systemPrompt = `أنت مساعد مبيعات ودعم لمتجر كوبالت للخدمات الرقمية.
مهمتك مساعدة العملاء بالإجابة من قاعدة المعرفة فقط.

${knowledge}`;

    const result = await askFreeModel(systemPrompt, question, history);
    const answer =
      result.provider === 'offline' || !result.answer
        ? offlineAnswer(question, knowledge)
        : result.answer;

    return ok(res, {
      answer,
      provider: result.answer && result.provider !== 'offline' ? result.provider : 'offline',
      free: true,
      ...(result.error ? { fallbackReason: result.error.slice(0, 300) } : {}),
    });
  } catch (e) {
    return fail(res, e instanceof Error ? e.message : 'AI failed', 500);
  }
});

export default router;
