"use strict";
/**
 * Free AI providers only:
 * - Groq (default): free tier — https://console.groq.com
 * - Google Gemini free tier — https://aistudio.google.com/apikey
 * - Offline fallback: answers from store knowledge with no API key
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.askFreeModel = askFreeModel;
async function callGroq(messages) {
    const key = process.env.GROQ_API_KEY?.trim();
    if (!key)
        throw new Error('GROQ_API_KEY missing');
    const candidates = [
        process.env.GROQ_MODEL,
        'openai/gpt-oss-20b',
        'openai/gpt-oss-120b',
        'qwen/qwen3.6-27b',
    ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
    let lastError = 'No Groq model tried';
    for (const model of candidates) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.3,
                max_tokens: 700,
                messages,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            lastError = `Groq error ${res.status} (${model}): ${text.slice(0, 180)}`;
            // try next model on not-found
            if (res.status === 404 || text.includes('model_not_found'))
                continue;
            throw new Error(lastError);
        }
        const json = (await res.json());
        const answer = json.choices?.[0]?.message?.content?.trim();
        if (!answer)
            throw new Error('Empty Groq response');
        return answer;
    }
    throw new Error(lastError);
}
async function callGemini(messages) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key)
        throw new Error('GEMINI_API_KEY missing');
    const candidates = [
        process.env.GEMINI_MODEL,
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash-latest',
        'gemini-flash-latest',
    ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const userParts = messages.filter((m) => m.role !== 'system');
    let lastError = 'No Gemini model tried';
    for (const model of candidates) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents: userParts.map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                })),
                generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            lastError = `Gemini error ${res.status} (${model}): ${text.slice(0, 180)}`;
            if (res.status === 404)
                continue;
            throw new Error(lastError);
        }
        const json = (await res.json());
        const answer = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
        if (!answer)
            throw new Error('Empty Gemini response');
        return answer;
    }
    throw new Error(lastError);
}
async function askFreeModel(systemPrompt, question, history = []) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: question },
    ];
    const preferred = (process.env.AI_PROVIDER || 'groq').toLowerCase();
    const errors = [];
    async function tryGroq() {
        try {
            return { answer: await callGroq(messages), provider: 'groq' };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`groq: ${msg}`);
            console.error('[AI] Groq failed:', msg);
            return null;
        }
    }
    async function tryGemini() {
        try {
            return { answer: await callGemini(messages), provider: 'gemini' };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`gemini: ${msg}`);
            console.error('[AI] Gemini failed:', msg);
            return null;
        }
    }
    if (preferred === 'gemini' && process.env.GEMINI_API_KEY?.trim()) {
        const r = await tryGemini();
        if (r)
            return r;
        if (process.env.GROQ_API_KEY?.trim()) {
            const g = await tryGroq();
            if (g)
                return g;
        }
    }
    else if (process.env.GROQ_API_KEY?.trim()) {
        const g = await tryGroq();
        if (g)
            return g;
        if (process.env.GEMINI_API_KEY?.trim()) {
            const r = await tryGemini();
            if (r)
                return r;
        }
    }
    else if (process.env.GEMINI_API_KEY?.trim()) {
        const r = await tryGemini();
        if (r)
            return r;
    }
    return { answer: '', provider: 'offline', error: errors.join(' | ') || 'no api key' };
}
