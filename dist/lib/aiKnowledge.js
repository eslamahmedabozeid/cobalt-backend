"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStoreKnowledge = buildStoreKnowledge;
exports.questionAsksForSiteUrl = questionAsksForSiteUrl;
exports.sanitizeAiAnswer = sanitizeAiAnswer;
exports.offlineAnswer = offlineAnswer;
const prisma_1 = require("./prisma");
function parseJson(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
/** Build a live knowledge pack from the store database so the free AI can answer like a trained support agent. */
async function buildStoreKnowledge() {
    const [settings, services, categories, bundles, faqs, coupons, calc, portfolio, nav,] = await Promise.all([
        prisma_1.prisma.siteSettings.findUnique({ where: { id: 'default' } }),
        prisma_1.prisma.service.findMany({
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
                addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            },
        }),
        prisma_1.prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.bundle.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.faq.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
        prisma_1.prisma.coupon.findMany({ where: { active: true }, take: 20 }),
        prisma_1.prisma.calculatorConfig.findUnique({ where: { id: 'default' } }),
        prisma_1.prisma.portfolioItem.findMany({
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            take: 12,
        }),
        prisma_1.prisma.navItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const lines = [];
    lines.push('# متجر كوبالت — قاعدة معرفة المساعد الذكي');
    lines.push('');
    lines.push('## عن المتجر');
    lines.push(`الاسم: ${settings?.siteTitle || 'كوبالت'}`);
    lines.push(`الوصف: ${settings?.siteDescription || ''}`);
    if (settings?.whatsappNumber) {
        lines.push(`واتساب الدعم: ${settings.whatsappNumber}`);
    }
    if (settings?.supportBlurb)
        lines.push(`رسالة الدعم: ${settings.supportBlurb}`);
    if (settings?.footerDesc)
        lines.push(`نبذة: ${settings.footerDesc}`);
    if (categories.length) {
        lines.push('');
        lines.push('## التصنيفات');
        for (const c of categories)
            lines.push(`- ${c.name} (id: ${c.id})`);
    }
    lines.push('');
    lines.push('## الخدمات والأسعار (ريال سعودي)');
    for (const s of services) {
        const deliverables = parseJson(s.deliverables, []);
        lines.push(`### ${s.title}`);
        lines.push(`- الرابط: /services/${s.slug}`);
        lines.push(`- التصنيف: ${s.categoryName}`);
        lines.push(`- السعر الأساسي: ${s.priceSAR} ر.س${s.oldPriceSAR ? ` (كان ${s.oldPriceSAR})` : ''}`);
        lines.push(`- مدة التسليم: ${s.delivery}`);
        lines.push(`- التقييم: ${s.rating} من ${s.reviewsCount} تقييم`);
        if (s.badge)
            lines.push(`- الشارة: ${s.badge}`);
        lines.push(`- الوصف: ${s.shortDesc}`);
        if (deliverables.length)
            lines.push(`- التسليمات: ${deliverables.join('؛ ')}`);
        if (s.packages.length) {
            lines.push('- الباقات:');
            for (const p of s.packages) {
                lines.push(`  • ${p.name}: ${p.priceSAR} ر.س — ${p.description}`);
            }
        }
        if (s.addons.length) {
            lines.push('- الإضافات:');
            for (const a of s.addons) {
                lines.push(`  • ${a.title}: ${a.priceSAR} ر.س — ${a.desc}`);
            }
        }
    }
    if (bundles.length) {
        lines.push('');
        lines.push('## الباقات المجمعة');
        for (const b of bundles) {
            lines.push(`- ${b.title}: ${b.priceSAR} ر.س${b.compareAtSAR ? ` (بدلاً من ${b.compareAtSAR})` : ''} — ${b.description}`);
        }
    }
    if (coupons.length) {
        lines.push('');
        lines.push('## كوبونات الخصم النشطة');
        for (const c of coupons) {
            lines.push(`- الكود ${c.code}: خصم ${c.discountPercentage}%`);
        }
    }
    if (calc) {
        lines.push('');
        lines.push('## خيارات الحاسبة والتسليم');
        lines.push(`- قياسي: ${calc.normalLabel}`);
        lines.push(`- عاجل: ${calc.expressLabel} (+${calc.expressFeeSAR} ر.س)`);
        lines.push(`- VIP: ${calc.vipLabel} (+${calc.vipFeeSAR} ر.س)`);
        lines.push(`- متعدد اللغات: ${calc.multilingualLabel} (+${calc.multilingualFeeSAR} ر.س)`);
    }
    if (faqs.length) {
        lines.push('');
        lines.push('## الأسئلة الشائعة');
        for (const f of faqs) {
            lines.push(`س: ${f.question}`);
            lines.push(`ج: ${f.answer}`);
        }
    }
    if (portfolio.length) {
        lines.push('');
        lines.push('## نماذج من الأعمال');
        for (const p of portfolio) {
            lines.push(`- ${p.title} (${p.categoryName}) — العميل: ${p.client} — المدة: ${p.duration}`);
        }
    }
    if (nav.length) {
        lines.push('');
        lines.push('## روابط الموقع');
        for (const n of nav)
            lines.push(`- ${n.label}: ${n.href}`);
    }
    lines.push('');
    lines.push('## الموقع الرسمي');
    lines.push(`الرابط الرسمي الوحيد للمتجر: ${process.env.PUBLIC_SITE_URL || 'http://cobalt-db.com/'}`);
    lines.push('لا تذكر أي رابط موقع آخر أبداً (مثل cobalt.com.sa أو أي نطاق مخترع).');
    lines.push('');
    lines.push('## قواعد الإجابة');
    lines.push('- أجب بالعربية الواضحة والودية.');
    lines.push('- اعتمد فقط على المعلومات أعلاه. لا تختلق أسعاراً أو خدمات أو روابط غير موجودة.');
    lines.push('- لا تستخدم HTML أبداً (مثل br أو table أو div). لا تكتب وسوم مثل <br>.');
    lines.push('- لا تستخدم جداول Markdown المعقدة. استخدم نقاطاً وقوائم نصية بسيطة فقط.');
    lines.push('- لا تذكر رابط الموقع الرسمي إلا إذا سأل العميل صراحة عن رابط الموقع أو أين يجد المتجر.');
    lines.push('- إذا لم تجد المعلومة، قل ذلك واقترح التواصل عبر واتساب.');
    lines.push('- عند شرح الشراء: اختر الخدمة من قسم الخدمات، اختر الباقة، أضف للسلة أو اطلب عبر واتساب، ثم أكمل البيانات.');
    lines.push('- كن واضحاً ومنظماً، ويمكنك الإطالة قليلاً عند سؤال شامل عن كل الخدمات.');
    let text = lines.join('\n');
    // Keep prompt within free-model context limits
    const maxChars = 28000;
    if (text.length > maxChars) {
        text = `${text.slice(0, maxChars)}\n\n[تم اختصار جزء من المعرفة لحدود النموذج]`;
    }
    return text;
}
/** True when the customer explicitly asks for the store website / URL. */
function questionAsksForSiteUrl(question) {
    const q = String(question || '').toLowerCase();
    return /رابط|موقعكم|الموقع|website|url|لينك|link|وين الموقع|أين الموقع|ازاي اوصل|كيف اوصل للمتجر|عنوان الموقع/.test(q);
}
/** Clean model output for chat UI (plain text only). */
function sanitizeAiAnswer(raw, opts) {
    let text = String(raw || '');
    // Convert common HTML breaks/paragraphs to newlines before stripping tags
    text = text
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*p\s*>/gi, '\n')
        .replace(/<\/\s*div\s*>/gi, '\n')
        .replace(/<\/\s*li\s*>/gi, '\n')
        .replace(/<\/\s*tr\s*>/gi, '\n')
        .replace(/<\/\s*h[1-6]\s*>/gi, '\n');
    // Strip remaining HTML tags
    text = text.replace(/<\/?[^>]+>/g, '');
    // Decode a few common entities
    text = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'");
    // Always remove wrong/hallucinated Cobalt domains
    text = text.replace(/https?:\/\/(?:www\.)?cobalt\.com\.sa\/?/gi, '');
    text = text.replace(/(?:www\.)?cobalt\.com\.sa/gi, '');
    text = text.replace(/https?:\/\/(?![^\s]*cobalt-db\.com)[^\s]*cobalt[^\s]*/gi, '');
    const official = (process.env.PUBLIC_SITE_URL || 'http://cobalt-db.com/').trim();
    if (!opts?.allowSiteUrl) {
        // Do not share the main site URL unless the client asked for it
        text = text.replace(/https?:\/\/(?:www\.)?cobalt-db\.com\/?/gi, '');
        text = text.replace(/(?:www\.)?cobalt-db\.com\/?/gi, '');
        if (official) {
            const escaped = official.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(escaped, 'gi'), '');
        }
    }
    else {
        // If they asked, replace any remaining fake domains with the official URL
        text = text.replace(/https?:\/\/(?:www\.)?cobalt\.com\.sa\/?/gi, official);
    }
    // Collapse excess blank lines / spaces left after stripping URLs
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    text = text.replace(/ {2,}/g, ' ');
    // Clean leftover "افتح الرابط:" / "زيارة الموقع" lines that became empty
    text = text
        .replace(/^[^\n]*(?:الرابط|زيارة الموقع|افتح الرابط)[^\n]*:\s*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text;
}
function offlineAnswer(question, knowledge) {
    const q = question.trim().toLowerCase();
    const faqBlock = knowledge.match(/## الأسئلة الشائعة[\s\S]*?(?=## |$)/)?.[0] || '';
    const pairs = [...faqBlock.matchAll(/س: (.+)\nج: (.+)/g)];
    let best = null;
    for (const m of pairs) {
        const questionText = m[1].toLowerCase();
        const words = q.split(/\s+/).filter((w) => w.length > 2);
        const score = words.reduce((s, w) => s + (questionText.includes(w) ? 1 : 0), 0);
        if (!best || score > best.score)
            best = { score, a: m[2] };
    }
    if (best && best.score >= 2) {
        return `${best.a}\n\nإذا احتجت مساعدة إضافية يمكنك التواصل عبر واتساب من زر المحادثة في الموقع.`;
    }
    const serviceTitles = [...knowledge.matchAll(/### (.+)/g)].map((m) => m[1]);
    const matched = serviceTitles.filter((t) => t.split(/\s+/).some((w) => w.length > 3 && q.includes(w.toLowerCase())));
    if (matched.length) {
        return `يمكنني مساعدتك بخصوص: ${matched.slice(0, 3).join('، ')}. تصفّح صفحة الخدمة من قسم الخدمات في الموقع، أو استخدم حاسبة الأسعار لمعرفة التكلفة. للتفاصيل النهائية تواصل معنا عبر واتساب.`;
    }
    if (/سعر|تكلف|كم|price|cost/i.test(q)) {
        return 'الأسعار تظهر داخل صفحة كل خدمة وباقاتها، ويمكنك استخدام حاسبة الأسعار في الصفحة الرئيسية. إذا أردت عرضاً مخصصاً راسلنا على واتساب.';
    }
    if (/كوبون|خصم|coupon/i.test(q)) {
        const codes = [...knowledge.matchAll(/الكود (\S+): خصم (\d+)%/g)].map((m) => `${m[1]} (${m[2]}%)`);
        if (codes.length) {
            return `الكوبونات النشطة حالياً: ${codes.join('، ')}. أدخل الكود عند إتمام الطلب.`;
        }
    }
    return 'شكراً لسؤالك. لم أجد إجابة دقيقة في قاعدة المعرفة الحالية. يرجى توضيح الخدمة المطلوبة أو التواصل مع فريق كوبالت عبر واتساب وسنساعدك فوراً.';
}
