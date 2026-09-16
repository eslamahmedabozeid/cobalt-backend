import { prisma } from './prisma';

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Build a live knowledge pack from the store database so the free AI can answer like a trained support agent. */
export async function buildStoreKnowledge(): Promise<string> {
  const [
    settings,
    services,
    categories,
    bundles,
    faqs,
    coupons,
    calc,
    portfolio,
    nav,
  ] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 'default' } }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        packages: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        addons: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.bundle.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.faq.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.coupon.findMany({ where: { active: true }, take: 20 }),
    prisma.calculatorConfig.findUnique({ where: { id: 'default' } }),
    prisma.portfolioItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    }),
    prisma.navItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const lines: string[] = [];
  lines.push('# متجر كوبالت — قاعدة معرفة المساعد الذكي');
  lines.push('');
  lines.push('## عن المتجر');
  lines.push(`الاسم: ${settings?.siteTitle || 'كوبالت'}`);
  lines.push(`الوصف: ${settings?.siteDescription || ''}`);
  if (settings?.whatsappNumber) {
    lines.push(`واتساب الدعم: ${settings.whatsappNumber}`);
  }
  if (settings?.supportBlurb) lines.push(`رسالة الدعم: ${settings.supportBlurb}`);
  if (settings?.footerDesc) lines.push(`نبذة: ${settings.footerDesc}`);

  if (categories.length) {
    lines.push('');
    lines.push('## التصنيفات');
    for (const c of categories) lines.push(`- ${c.name} (id: ${c.id})`);
  }

  lines.push('');
  lines.push('## الخدمات والأسعار (ريال سعودي)');
  for (const s of services) {
    const deliverables = parseJson<string[]>(s.deliverables, []);
    lines.push(`### ${s.title}`);
    lines.push(`- الرابط: /services/${s.slug}`);
    lines.push(`- التصنيف: ${s.categoryName}`);
    lines.push(`- السعر الأساسي: ${s.priceSAR} ر.س${s.oldPriceSAR ? ` (كان ${s.oldPriceSAR})` : ''}`);
    lines.push(`- مدة التسليم: ${s.delivery}`);
    lines.push(`- التقييم: ${s.rating} من ${s.reviewsCount} تقييم`);
    if (s.badge) lines.push(`- الشارة: ${s.badge}`);
    lines.push(`- الوصف: ${s.shortDesc}`);
    if (deliverables.length) lines.push(`- التسليمات: ${deliverables.join('؛ ')}`);
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
      lines.push(
        `- ${b.title}: ${b.priceSAR} ر.س${b.compareAtSAR ? ` (بدلاً من ${b.compareAtSAR})` : ''} — ${b.description}`
      );
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
    for (const n of nav) lines.push(`- ${n.label}: ${n.href}`);
  }

  lines.push('');
  lines.push('## قواعد الإجابة');
  lines.push('- أجب بالعربية الفصحى الواضحة والودية.');
  lines.push('- اعتمد فقط على المعلومات أعلاه. لا تختلق أسعاراً أو خدمات غير موجودة.');
  lines.push('- إذا لم تجد المعلومة، قل ذلك واقترح التواصل عبر واتساب.');
  lines.push('- شجّع العميل على الطلب من المتجر أو استخدام الحاسبة عند الحاجة.');
  lines.push('- كن مختصراً ومفيداً (3–8 جمل عادة).');

  let text = lines.join('\n');
  // Keep prompt within free-model context limits
  const maxChars = 28000;
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n\n[تم اختصار جزء من المعرفة لحدود النموذج]`;
  }
  return text;
}

export function offlineAnswer(question: string, knowledge: string): string {
  const q = question.trim().toLowerCase();
  const faqBlock = knowledge.match(/## الأسئلة الشائعة[\s\S]*?(?=## |$)/)?.[0] || '';
  const pairs = [...faqBlock.matchAll(/س: (.+)\nج: (.+)/g)];
  let best: { score: number; a: string } | null = null;
  for (const m of pairs) {
    const questionText = m[1].toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const score = words.reduce((s, w) => s + (questionText.includes(w) ? 1 : 0), 0);
    if (!best || score > best.score) best = { score, a: m[2] };
  }
  if (best && best.score >= 2) {
    return `${best.a}\n\nإذا احتجت مساعدة إضافية يمكنك التواصل عبر واتساب من زر المحادثة في الموقع.`;
  }

  const serviceTitles = [...knowledge.matchAll(/### (.+)/g)].map((m) => m[1]);
  const matched = serviceTitles.filter((t) =>
    t.split(/\s+/).some((w) => w.length > 3 && q.includes(w.toLowerCase()))
  );

  if (matched.length) {
    return `يمكنني مساعدتك بخصوص: ${matched.slice(0, 3).join('، ')}. تصفّح صفحة الخدمة من قسم الخدمات في الموقع، أو استخدم حاسبة الأسعار لمعرفة التكلفة. للتفاصيل النهائية تواصل معنا عبر واتساب.`;
  }

  if (/سعر|تكلف|كم|price|cost/i.test(q)) {
    return 'الأسعار تظهر داخل صفحة كل خدمة وباقاتها، ويمكنك استخدام حاسبة الأسعار في الصفحة الرئيسية. إذا أردت عرضاً مخصصاً راسلنا على واتساب.';
  }

  if (/كوبون|خصم|coupon/i.test(q)) {
    const codes = [...knowledge.matchAll(/الكود (\S+): خصم (\d+)%/g)].map(
      (m) => `${m[1]} (${m[2]}%)`
    );
    if (codes.length) {
      return `الكوبونات النشطة حالياً: ${codes.join('، ')}. أدخل الكود عند إتمام الطلب.`;
    }
  }

  return 'شكراً لسؤالك. لم أجد إجابة دقيقة في قاعدة المعرفة الحالية. يرجى توضيح الخدمة المطلوبة أو التواصل مع فريق كوبالت عبر واتساب وسنساعدك فوراً.';
}
