"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const aiKnowledge_1 = require("../lib/aiKnowledge");
const aiProvider_1 = require("../lib/aiProvider");
const router = (0, express_1.Router)();
const rateMap = new Map();
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_PER_HOUR || 30);
const RATE_WINDOW_MS = 60 * 60 * 1000;
let knowledgeCache = null;
const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;
function clientKey(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length)
        return forwarded.split(',')[0].trim();
    return req.ip || 'unknown';
}
function allowRequest(key) {
    const now = Date.now();
    const row = rateMap.get(key);
    if (!row || now > row.resetAt) {
        rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (row.count >= RATE_LIMIT)
        return false;
    row.count += 1;
    return true;
}
async function getKnowledge() {
    if (knowledgeCache && Date.now() - knowledgeCache.at < KNOWLEDGE_TTL_MS) {
        return knowledgeCache.text;
    }
    const text = await (0, aiKnowledge_1.buildStoreKnowledge)();
    knowledgeCache = { text, at: Date.now() };
    return text;
}
router.get('/ai/status', async (_req, res) => {
    const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    return (0, response_1.ok)(res, {
        enabled: true,
        free: true,
        provider: hasGroq ? 'groq' : hasGemini ? 'gemini' : 'offline',
        ready: true,
    });
});
router.post('/ai/ask', async (req, res) => {
    try {
        const key = clientKey(req);
        if (!allowRequest(key)) {
            return (0, response_1.fail)(res, 'تم تجاوز الحد المجاني للأسئلة. حاول لاحقاً أو تواصل عبر واتساب.', 429, undefined, 'RATE_LIMIT');
        }
        const question = String(req.body?.question || '').trim();
        if (!question || question.length < 2) {
            return (0, response_1.fail)(res, 'اكتب سؤالك من فضلك', 400);
        }
        if (question.length > 800) {
            return (0, response_1.fail)(res, 'السؤال طويل جداً', 400);
        }
        const historyRaw = Array.isArray(req.body?.history) ? req.body.history : [];
        const history = historyRaw
            .slice(-6)
            .map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: String(h.content || '').slice(0, 1000),
        }))
            .filter((h) => h.content);
        const knowledge = await getKnowledge();
        const siteUrl = process.env.PUBLIC_SITE_URL || 'http://cobalt-db.com/';
        const systemPrompt = `أنت مساعد مبيعات ودعم لمتجر كوبالت للخدمات الرقمية.
مهمتك مساعدة العملاء بالإجابة من قاعدة المعرفة فقط.

قواعد صارمة:
1) لا تستخدم HTML أو وسوم مثل <br> أو <table>. اكتب نصاً عادياً فقط مع أسطر ونقاط.
2) لا تختلق روابط مواقع. الرابط الرسمي الوحيد إن لزم: ${siteUrl}
3) لا تذكر رابط الموقع إلا إذا سأل العميل صراحة عن رابط المتجر أو أين يجده.
4) لا تذكر cobalt.com.sa أو أي نطاق آخر غير الرابط الرسمي.

${knowledge}`;
        const result = await (0, aiProvider_1.askFreeModel)(systemPrompt, question, history);
        const rawAnswer = result.provider === 'offline' || !result.answer
            ? (0, aiKnowledge_1.offlineAnswer)(question, knowledge)
            : result.answer;
        const answer = (0, aiKnowledge_1.sanitizeAiAnswer)(rawAnswer, {
            allowSiteUrl: (0, aiKnowledge_1.questionAsksForSiteUrl)(question),
        });
        return (0, response_1.ok)(res, {
            answer,
            provider: result.answer && result.provider !== 'offline' ? result.provider : 'offline',
            free: true,
            ...(result.error ? { fallbackReason: result.error.slice(0, 300) } : {}),
        });
    }
    catch (e) {
        return (0, response_1.fail)(res, e instanceof Error ? e.message : 'AI failed', 500);
    }
});
exports.default = router;
