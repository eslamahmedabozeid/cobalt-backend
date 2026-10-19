/**
 * Company Profile service — dynamic pricing v1.1 (spec).
 * Money: integer SAR with Math.round half-up for fractional intermediate results.
 */

export const COMPANY_PROFILE_SERVICE_ID = 'company-profile';
export const PRICING_RULE_VERSION = 'company-profile-v1.1';

export type CompanyProfilePricingConfig = {
  version: string;
  promotionEnabled: boolean;
  promotionDiscountSAR: number;
  tiers: Array<{ id: string; label: string; min: number; max: number | null; standardBaseSAR: number }>;
  overage: { fromPage: number; baseStandardSAR: number; perPageSAR: number };
  rates: {
    rewriteOnePerPage: number;
    writeOnePerPage: number;
    translatePerPage: number;
    rewriteBothPerPage: number;
    writeBothPerPage: number;
    bilingualDesignPercent: number;
    identityBasicSAR: number;
    editableAiSAR: number;
  };
};

export const DEFAULT_COMPANY_PROFILE_PRICING: CompanyProfilePricingConfig = {
  version: PRICING_RULE_VERSION,
  promotionEnabled: true,
  promotionDiscountSAR: 140,
  tiers: [
    { id: '1-4', label: '1–4', min: 1, max: 4, standardBaseSAR: 490 },
    { id: '5-8', label: '5–8', min: 5, max: 8, standardBaseSAR: 790 },
    { id: '9-12', label: '9–12', min: 9, max: 12, standardBaseSAR: 1090 },
    { id: '13-16', label: '13–16', min: 13, max: 16, standardBaseSAR: 1390 },
    { id: '17+', label: '17+', min: 17, max: null, standardBaseSAR: 1390 },
  ],
  overage: { fromPage: 17, baseStandardSAR: 1390, perPageSAR: 75 },
  rates: {
    rewriteOnePerPage: 25,
    writeOnePerPage: 45,
    translatePerPage: 35,
    rewriteBothPerPage: 50,
    writeBothPerPage: 90,
    bilingualDesignPercent: 50,
    identityBasicSAR: 150,
    editableAiSAR: 150,
  },
};

export type PriceBreakdownLine = { key: string; label: string; amountSAR: number };

export type CompanyProfileQuote = {
  ok: true;
  pricingRuleVersion: string;
  promotionEnabled: boolean;
  /** Tier minimum used for preliminary per-page content (1/5/9/13/17) — not a final page count */
  preliminaryPages: number;
  /** @deprecated use preliminaryPages — kept for admin/order JSON compatibility */
  exactPages: number;
  pageTierId: string;
  pageTierLabel: string;
  isPreliminary: true;
  baseStandardSAR: number;
  baseActiveSAR: number;
  bilingualDesignSAR: number;
  contentSAR: number;
  translationDisplaySAR: number;
  identitySAR: number;
  deliverableSAR: number;
  expressFeeSAR: number;
  pretaxSubtotalSAR: number;
  pretaxTotalSAR: number;
  lines: PriceBreakdownLine[];
  blockCheckout?: string;
};

export type CompanyProfileQuoteError = { ok: false; message: string };

function asInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function roundSAR(n: number): number {
  return Math.round(n);
}

export function parsePricingConfig(raw: unknown): CompanyProfilePricingConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COMPANY_PROFILE_PRICING };
  const c = raw as Partial<CompanyProfilePricingConfig>;
  return {
    ...DEFAULT_COMPANY_PROFILE_PRICING,
    ...c,
    tiers: Array.isArray(c.tiers) && c.tiers.length ? c.tiers : DEFAULT_COMPANY_PROFILE_PRICING.tiers,
    overage: { ...DEFAULT_COMPANY_PROFILE_PRICING.overage, ...(c.overage || {}) },
    rates: { ...DEFAULT_COMPANY_PROFILE_PRICING.rates, ...(c.rates || {}) },
    promotionEnabled:
      typeof c.promotionEnabled === 'boolean'
        ? c.promotionEnabled
        : DEFAULT_COMPANY_PROFILE_PRICING.promotionEnabled,
  };
}

export function standardBaseForPages(pages: number, config: CompanyProfilePricingConfig): number {
  if (pages >= config.overage.fromPage) {
    return config.overage.baseStandardSAR + config.overage.perPageSAR * (pages - 16);
  }
  const tier = config.tiers.find((t) => t.max != null && pages >= t.min && pages <= t.max);
  if (!tier) throw new Error('لا يمكن تحديد شريحة الصفحات');
  return tier.standardBaseSAR;
}

/**
 * Drop incompatible / hidden content fields so ar and en quote identically
 * for the same visible options, and bilingual leftovers cannot affect pricing.
 */
export function normalizeCompanyProfileAnswers(
  answers: Record<string, unknown>
): Record<string, unknown> {
  const language = String(answers.language || '');
  const out: Record<string, unknown> = { ...answers };

  // Ambiguous legacy key must never override the language-scoped fields
  delete out.content_preparation;
  // Exact page count removed — ignore any stale client/hidden value
  delete out.exact_pages;
  delete out.express_approval_status;
  delete out.express_fee_sar;
  delete out.express_fee;
  delete out.expressFeeSAR;
  delete out.__expressQuote;

  if (language === 'both') {
    out.content_preparation_one = '';
    if (String(out.content_preparation_both || '') !== 'ready_one_translate') {
      out.source_language = '';
    }
  } else if (language === 'ar' || language === 'en') {
    out.content_preparation_both = '';
    out.source_language = '';
  } else {
    out.content_preparation_one = '';
    out.content_preparation_both = '';
    out.source_language = '';
  }

  return out;
}

export function computeCompanyProfileQuote(
  answersInput: Record<string, unknown>,
  configInput?: unknown
): CompanyProfileQuote | CompanyProfileQuoteError {
  const answers = normalizeCompanyProfileAnswers(answersInput || {});
  const config = parsePricingConfig(configInput);
  const tierId = String(answers.page_tier || '');
  const tier = config.tiers.find((t) => t.id === tierId);
  if (!tier) return { ok: false, message: 'يرجى اختيار شريحة عدد الصفحات' };

  // Preliminary content pages = tier minimum only (ignore any client exact_pages)
  const pages = tier.min;

  const language = String(answers.language || '');
  if (!['ar', 'en', 'both'].includes(language)) {
    return { ok: false, message: 'يرجى اختيار لغة البروفايل' };
  }

  // Language-scoped only — never mix one-language and bilingual content paths
  const contentPrep = String(
    language === 'both' ? answers.content_preparation_both || '' : answers.content_preparation_one || ''
  );
  const singleOpts = ['ready_one', 'rewrite_one', 'write_one'];
  const bothOpts = ['ready_both', 'ready_one_translate', 'rewrite_both', 'write_both'];
  if (language === 'both') {
    if (!bothOpts.includes(contentPrep)) {
      return { ok: false, message: 'يرجى اختيار طريقة إعداد المحتوى للنسختين' };
    }
  } else if (!singleOpts.includes(contentPrep)) {
    return { ok: false, message: 'يرجى اختيار طريقة إعداد المحتوى' };
  }

  if (contentPrep === 'ready_one_translate') {
    const src = String(answers.source_language || '');
    if (!['ar', 'en'].includes(src)) {
      return { ok: false, message: 'يرجى تحديد لغة المحتوى الأصلي للترجمة' };
    }
  }

  const identity = String(answers.visual_identity || '');
  if (!['ready', 'basic', 'full_brand'].includes(identity)) {
    return { ok: false, message: 'يرجى تحديد حالة الهوية البصرية' };
  }

  const deliverables = String(answers.deliverables || '');
  if (!['pdf', 'editable'].includes(deliverables)) {
    return { ok: false, message: 'يرجى اختيار ملفات التسليم النهائية' };
  }

  const delivery = String(answers.delivery_speed || '');
  if (!['standard', 'rush'].includes(delivery)) {
    return { ok: false, message: 'يرجى اختيار سرعة التسليم' };
  }

  // Express fee/approval must NEVER come from customer answers.
  // Only a future server-side approved quote (answers.__expressQuote from trusted merge) may apply.
  let expressFeeSAR = 0;
  let blockCheckout: string | undefined;
  // full_brand: no automatic identity fee; profile/other charges stay; answer is saved with the order.
  if (delivery === 'rush') {
    const trusted = answers.__expressQuote;
    const quote =
      trusted && typeof trusted === 'object' && !Array.isArray(trusted)
        ? (trusted as Record<string, unknown>)
        : null;
    const approved = quote && String(quote.status || '') === 'approved';
    const fee = quote ? asInt(quote.feeSAR) : null;
    if (!approved || fee == null || fee < 0) {
      blockCheckout =
        'التسليم العاجل يتطلب عرض سعر معتمداً من حاسبة الطلبات المستعجلة مع موافقة الفريق. لا يمكن إتمام الدفع حتى الاعتماد.';
      expressFeeSAR = 0;
    } else {
      expressFeeSAR = fee;
    }
  }

  // Tier design price unchanged; 17+ uses formula at tier minimum
  const baseStandardSAR = standardBaseForPages(pages, config);
  const baseActiveSAR = config.promotionEnabled
    ? Math.max(0, baseStandardSAR - config.promotionDiscountSAR)
    : baseStandardSAR;

  const bilingualDesignSAR =
    language === 'both'
      ? roundSAR((baseActiveSAR * config.rates.bilingualDesignPercent) / 100)
      : 0;

  let contentSAR = 0;
  let translationDisplaySAR = 0;
  const r = config.rates;
  switch (contentPrep) {
    case 'ready_one':
    case 'ready_both':
      contentSAR = 0;
      break;
    case 'rewrite_one':
      contentSAR = r.rewriteOnePerPage * pages;
      break;
    case 'write_one':
      contentSAR = r.writeOnePerPage * pages;
      break;
    case 'ready_one_translate':
      contentSAR = r.translatePerPage * pages;
      translationDisplaySAR = contentSAR;
      break;
    case 'rewrite_both':
      contentSAR = r.rewriteBothPerPage * pages;
      break;
    case 'write_both':
      contentSAR = r.writeBothPerPage * pages;
      break;
  }

  const identitySAR = identity === 'basic' ? r.identityBasicSAR : 0;
  const deliverableSAR = deliverables === 'editable' ? r.editableAiSAR : 0;

  const pretaxSubtotalSAR =
    baseActiveSAR + bilingualDesignSAR + contentSAR + identitySAR + deliverableSAR;
  const pretaxTotalSAR = pretaxSubtotalSAR + expressFeeSAR;

  const lines: PriceBreakdownLine[] = [
    {
      key: 'base',
      label: config.promotionEnabled
        ? `تصميم أساسي تقديري (عرض الإطلاق — شريحة ${tier.label})`
        : `تصميم أساسي تقديري (شريحة ${tier.label})`,
      amountSAR: baseActiveSAR,
    },
  ];
  if (config.promotionEnabled) {
    lines.push({
      key: 'base_standard',
      label: 'السعر الأساسي القياسي (قبل العرض)',
      amountSAR: baseStandardSAR,
    });
    lines.push({
      key: 'promo_discount',
      label: 'خصم عرض الإطلاق',
      amountSAR: -(baseStandardSAR - baseActiveSAR),
    });
  }
  if (bilingualDesignSAR) {
    lines.push({
      key: 'bilingual_design',
      label: 'تصميم النسخة الثانية من اللغة (+50%) — تقديري',
      amountSAR: bilingualDesignSAR,
    });
  }
  if (contentSAR) {
    lines.push({
      key: 'content',
      label:
        contentPrep === 'ready_one_translate'
          ? `ترجمة المحتوى (تقديري × ${pages} صفحات حد أدنى للشريحة)`
          : `إعداد/كتابة المحتوى (تقديري × ${pages} صفحات حد أدنى للشريحة)`,
      amountSAR: contentSAR,
    });
  }
  if (identitySAR) {
    lines.push({ key: 'identity', label: 'تنسيق الألوان والخطوط مع الشعار', amountSAR: identitySAR });
  }
  if (deliverableSAR) {
    lines.push({
      key: 'editable_ai',
      label: 'ملف مصدر Adobe Illustrator (.ai)',
      amountSAR: deliverableSAR,
    });
  }
  if (expressFeeSAR) {
    lines.push({ key: 'express', label: 'رسوم التسليم العاجل (معتمدة)', amountSAR: expressFeeSAR });
  }
  lines.push({
    key: 'preliminary_note',
    label: 'يبدأ من',
    amountSAR: 0,
  });

  return {
    ok: true,
    pricingRuleVersion: config.version,
    promotionEnabled: config.promotionEnabled,
    preliminaryPages: pages,
    exactPages: pages,
    pageTierId: tierId,
    pageTierLabel: tier.label,
    isPreliminary: true,
    baseStandardSAR,
    baseActiveSAR,
    bilingualDesignSAR,
    contentSAR,
    translationDisplaySAR,
    identitySAR,
    deliverableSAR,
    expressFeeSAR,
    pretaxSubtotalSAR,
    pretaxTotalSAR,
    lines,
    blockCheckout,
  };
}

/** Arabic FormDefinition v1.1 for company-profile */
export const COMPANY_PROFILE_FORM_V11 = {
  version: 2 as const,
  stepLabels: [
    'بيانات الشركة والتواصل',
    'إعداد البروفايل والتسعير',
    'محتوى البروفايل',
    'الملفات والمراجع',
    'المراجعة والسلة',
  ],
  guaranteesTitle: 'ضمانات تصميم بروفايل الشركة',
  guarantees: [
    {
      icon: '🔄',
      title: 'جولتان من التعديلات التصميمية',
      desc: 'مشمول ضمن النطاق الأساسي؛ أي جولات إضافية أو تغيير نطاق يُسعَّر بشكل منفصل.',
    },
    {
      icon: '⏱️',
      title: 'تسليم قياسي 3–5 أيام عمل',
      desc: 'يبدأ العدّ من يوم العمل التالي بعد اعتماد النطاق النهائي والدفع واستلام المحتوى/الأصول الصالحة.',
    },
    {
      icon: '📋',
      title: 'تسعير يبدأ من',
      desc: 'الأسعار المعروضة «تبدأ من» حسب شريحة الصفحات.',
    },
    {
      icon: '📁',
      title: 'PDF عالي الجودة ضمن الباقة',
      desc: 'ملف المصدر .ai اختياري برسوم إضافية واضحة — وليس مجاناً دائماً.',
    },
  ],
  sections: [
    {
      id: 'company-contact',
      step: '01',
      icon: '🏢',
      title: 'بيانات الشركة والتواصل',
      desc: 'معلومات أساسية بدون تأثير على السعر',
      fields: [
        {
          id: 'company_name',
          type: 'text',
          label: 'ما اسم شركتك أو علامتك التجارية؟',
          outputKey: 'اسم الشركة / البراند',
          required: true,
          icon: '🏷️',
        },
        {
          id: 'country',
          type: 'select',
          label: 'في أي دولة يقع مقر شركتك؟',
          outputKey: 'الدولة',
          required: true,
          options: [
            { value: 'السعودية', label: 'السعودية' },
            { value: 'الإمارات', label: 'الإمارات' },
            { value: 'مصر', label: 'مصر' },
            { value: 'الكويت', label: 'الكويت' },
            { value: 'قطر', label: 'قطر' },
            { value: 'البحرين', label: 'البحرين' },
            { value: 'عمان', label: 'عمان' },
            { value: 'الأردن', label: 'الأردن' },
            { value: 'أخرى', label: 'أخرى' },
          ],
        },
        {
          id: 'company_name_ar',
          type: 'text',
          label: 'اسم الشركة بالعربية (إن وجد)',
          outputKey: 'اسم الشركة بالعربي',
          required: false,
        },
        {
          id: 'company_name_en',
          type: 'text',
          label: 'اسم الشركة بالإنجليزية (إن وجد)',
          outputKey: 'اسم الشركة بالإنجليزي',
          required: false,
        },
        {
          id: 'industry',
          type: 'text',
          label: 'ما مجال نشاط شركتك؟',
          outputKey: 'مجال النشاط',
          required: true,
        },
        {
          id: 'founded_year',
          type: 'text',
          label: 'سنة تأسيس الشركة',
          outputKey: 'سنة التأسيس',
          required: false,
          placeholder: 'مثال: 2019',
        },
        {
          id: 'city',
          type: 'text',
          label: 'مدينة المقر الرئيسي',
          outputKey: 'المدينة',
          required: false,
        },
        {
          id: 'website',
          type: 'text',
          label: 'رابط الموقع الإلكتروني',
          outputKey: 'الموقع الإلكتروني',
          required: false,
          placeholder: 'https://',
        },
        {
          id: 'social_links',
          type: 'url_list',
          label: 'روابط حسابات التواصل الاجتماعي',
          outputKey: 'حسابات السوشيال',
          required: false,
          placeholder: 'https://',
        },
        {
          id: 'preferred_contact',
          type: 'select',
          label: 'طريقة التواصل المفضلة',
          outputKey: 'طريقة التواصل المفضلة',
          required: true,
          defaultValue: 'واتساب',
          options: [
            { value: 'واتساب', label: 'واتساب' },
            { value: 'هاتف', label: 'هاتف' },
            { value: 'بريد إلكتروني', label: 'بريد إلكتروني' },
          ],
        },
        {
          id: 'contact_details',
          type: 'text',
          label: 'بيانات التواصل لطريقة التواصل المختارة',
          outputKey: 'بيانات التواصل',
          required: true,
          placeholder: 'رقم الجوال أو البريد...',
        },
      ],
    },
    {
      id: 'config-pricing',
      step: '02',
      icon: '💰',
      title: 'إعداد البروفايل والتسعير التقديري',
      desc: 'الأسعار المعروضة «تبدأ من» وفق الحد الأدنى لشريحة الصفحات',
      fields: [
        {
          id: 'page_tier',
          type: 'select',
          label: 'ما نطاق عدد الصفحات المتوقع لبروفايل الشركة؟ (يشمل الغلاف والصفحة الخلفية)',
          outputKey: 'شريحة الصفحات',
          required: true,
          options: [
            { value: '1-4', label: '1–4 صفحات' },
            { value: '5-8', label: '5–8 صفحات' },
            { value: '9-12', label: '9–12 صفحات' },
            { value: '13-16', label: '13–16 صفحات' },
            { value: '17+', label: '17 صفحة فأكثر' },
          ],
        },
        {
          id: 'language',
          type: 'select',
          label: 'بأي لغة تريد تصميم البروفايل؟',
          outputKey: 'لغة البروفايل',
          required: true,
          options: [
            { value: 'ar', label: 'العربية فقط' },
            { value: 'en', label: 'الإنجليزية فقط' },
            { value: 'both', label: 'العربية والإنجليزية (نسختان منفصلتان)' },
          ],
        },
        {
          id: 'content_preparation_one',
          type: 'select',
          label: 'كيف سيتم إعداد محتوى البروفايل؟',
          outputKey: 'إعداد المحتوى (لغة واحدة)',
          required: true,
          showIf: { field: 'language', equals: ['ar', 'en'] },
          options: [
            {
              value: 'ready_one',
              label: 'سأوفّر محتوى نهائياً باللغة المختارة (بدون رسوم محتوى)',
            },
            {
              value: 'rewrite_one',
              label: 'لدي مسودة؛ أريد إعادة صياغة وتنظيم (من 25 ر.س × الحد الأدنى لشريحة الصفحات)',
            },
            {
              value: 'write_one',
              label: 'أريد كتابة المحتوى من معلومات الشركة (من 45 ر.س × الحد الأدنى لشريحة الصفحات)',
            },
          ],
        },
        {
          id: 'content_preparation_both',
          type: 'select',
          label: 'من سيوفّر محتوى النسختين (عربي + إنجليزي)؟',
          outputKey: 'إعداد المحتوى (لغتان)',
          required: true,
          showIf: { field: 'language', equals: 'both' },
          options: [
            {
              value: 'ready_both',
              label: 'سأوفّر محتوى نهائياً بالعربي والإنجليزي (بدون رسوم محتوى/ترجمة)',
            },
            {
              value: 'ready_one_translate',
              label: 'لدي محتوى نهائي بلغة واحدة؛ كوبالت تترجم للأخرى (من 35 ر.س × الحد الأدنى للشريحة)',
            },
            {
              value: 'rewrite_both',
              label: 'لدي مسودات باللغتين؛ كوبالت تعيد الصياغة (من 50 ر.س × الحد الأدنى للشريحة)',
            },
            {
              value: 'write_both',
              label: 'كوبالت تكتب المحتوى بالعربي والإنجليزي (من 90 ر.س × الحد الأدنى للشريحة)',
            },
          ],
        },
        {
          id: 'source_language',
          type: 'select',
          label: 'ما لغة المحتوى النهائي الأصلي المطلوب ترجمته؟',
          outputKey: 'لغة المصدر للترجمة',
          required: true,
          showIf: { field: 'content_preparation_both', equals: 'ready_one_translate' },
          options: [
            { value: 'ar', label: 'عربي — تُترجم إلى الإنجليزي' },
            { value: 'en', label: 'إنجليزي — تُترجم إلى العربي' },
          ],
        },
        {
          id: 'visual_identity',
          type: 'select',
          label: 'هل لديك هوية بصرية جاهزة لاستخدامها في البروفايل؟',
          outputKey: 'حالة الهوية البصرية',
          required: true,
          options: [
            { value: 'ready', label: 'نعم — شعار وألوان وخطوط معتمدة (بدون رسوم إضافية)' },
            {
              value: 'basic',
              label: 'لدي شعار وأحتاج تنسيق ألوان وخطوط للبروفايل (+150 ر.س)',
            },
            {
              value: 'full_brand',
              label: 'أحتاج هوية بصرية كاملة (خدمة منفصلة — لا تُسعَّر تلقائياً هنا)',
            },
          ],
        },
        {
          id: 'brand_assets',
          type: 'file',
          label: 'ارفع ملفات الهوية البصرية إن وُجدت',
          outputKey: 'ملفات الهوية',
          multiple: true,
          required: false,
          showIf: { field: 'visual_identity', equals: 'ready' },
        },
        {
          id: 'deliverables',
          type: 'select',
          label: 'ما الملفات النهائية التي تريد استلامها؟',
          outputKey: 'ملفات التسليم',
          required: true,
          options: [
            { value: 'pdf', label: 'ملفات PDF عالية الجودة للعرض والطباعة (مشمولة)' },
            {
              value: 'editable',
              label: 'PDF + ملف مصدر Adobe Illustrator (.ai) فقط (+150 ر.س)',
            },
          ],
        },
        {
          id: 'delivery_speed',
          type: 'select',
          label: 'متى تحتاج استلام البروفايل؟',
          outputKey: 'سرعة التسليم',
          required: true,
          defaultValue: 'standard',
          options: [
            {
              value: 'standard',
              label: 'تسليم قياسي — 3 إلى 5 أيام عمل (بدون رسوم إضافية)',
            },
            // rush temporarily hidden until express approval flow is available
          ],
        },
      ],
    },
    {
      id: 'profile-content',
      step: '03',
      icon: '📝',
      title: 'محتوى البروفايل',
      desc: 'حقول تعريفية — لا تغيّر السعر مباشرة',
      fields: [
        {
          id: 'company_overview',
          type: 'textarea',
          label: 'قدّم نبذة مختصرة عن شركتك',
          outputKey: 'نبذة عن الشركة',
          required: false,
          rows: 3,
        },
        {
          id: 'offerings',
          type: 'textarea',
          label: 'ما الخدمات أو المنتجات التي تقدمها شركتك؟',
          outputKey: 'الخدمات / المنتجات',
          required: false,
          rows: 3,
        },
        {
          id: 'vision',
          type: 'text',
          label: 'ما رؤية شركتك؟',
          outputKey: 'الرؤية',
          required: false,
        },
        {
          id: 'mission',
          type: 'text',
          label: 'ما رسالة شركتك؟',
          outputKey: 'الرسالة',
          required: false,
        },
        {
          id: 'values',
          type: 'text',
          label: 'ما القيم الأساسية لشركتك؟',
          outputKey: 'القيم',
          required: false,
        },
        {
          id: 'differentiators',
          type: 'textarea',
          label: 'لماذا يختار العملاء شركتك دون المنافسين؟',
          outputKey: 'لماذا يختارونكم',
          required: false,
          rows: 3,
        },
        {
          id: 'portfolio_summary',
          type: 'textarea',
          label: 'أبرز المشاريع أو الأعمال السابقة التي تود إبرازها',
          outputKey: 'أبرز المشاريع',
          required: false,
          rows: 3,
        },
        {
          id: 'clients_partners',
          type: 'text',
          label: 'أبرز العملاء أو الشركاء',
          outputKey: 'العملاء / الشركاء',
          required: false,
        },
        {
          id: 'certifications',
          type: 'text',
          label: 'شهادات أو اعتمادات تود إبرازها',
          outputKey: 'الشهادات',
          required: false,
        },
        {
          id: 'profile_goal',
          type: 'select',
          label: 'ما الهدف الرئيسي من بروفايل الشركة؟',
          outputKey: 'هدف البروفايل',
          required: false,
          options: [
            { value: 'تعريف بالشركة', label: 'تعريف بالشركة' },
            { value: 'جذب عملاء جدد', label: 'جذب عملاء جدد' },
            { value: 'تقديم مناقصات', label: 'تقديم مناقصات' },
            { value: 'جذب شركاء أو مستثمرين', label: 'جذب شركاء أو مستثمرين' },
            { value: 'أخرى', label: 'أخرى' },
          ],
        },
        {
          id: 'target_audience',
          type: 'multichip',
          label: 'من الجمهور المستهدف؟',
          outputKey: 'الجمهور المستهدف',
          required: false,
          options: [
            { value: 'شركات', label: 'شركات' },
            { value: 'أفراد', label: 'أفراد' },
            { value: 'جهات حكومية', label: 'جهات حكومية' },
            { value: 'مستثمرون', label: 'مستثمرون' },
            { value: 'شركاء', label: 'شركاء' },
            { value: 'أخرى', label: 'أخرى' },
          ],
        },
      ],
    },
    {
      id: 'files-refs',
      step: '04',
      icon: '📁',
      title: 'الملفات والمراجع الإبداعية',
      desc: 'الصور والملفات الاختيارية لا تمنع إتمام الطلب؛ قد تُطلب قبل بدء التنفيذ',
      fields: [
        {
          id: 'final_copy_file',
          type: 'file',
          label: 'ارفع المحتوى النصي النهائي إن وُجد',
          outputKey: 'ملف المحتوى النهائي',
          multiple: true,
          required: false,
        },
        {
          id: 'logo_file',
          type: 'file',
          label: 'ارفع شعار الشركة',
          outputKey: 'الشعار',
          multiple: true,
          required: false,
          showIf: { field: 'visual_identity', equals: ['ready', 'basic'] },
        },
        {
          id: 'company_images',
          type: 'file',
          label: 'صور الشركة / المشاريع / المنتجات',
          outputKey: 'صور الشركة',
          multiple: true,
          required: false,
        },
        {
          id: 'portfolio_files',
          type: 'file',
          label: 'أمثلة من مشاريع سابقة',
          outputKey: 'ملفات المشاريع',
          multiple: true,
          required: false,
        },
        {
          id: 'client_logos',
          type: 'file',
          label: 'شعارات العملاء أو الشركاء',
          outputKey: 'شعارات العملاء',
          multiple: true,
          required: false,
        },
        {
          id: 'certificate_files',
          type: 'file',
          label: 'ملفات الشهادات والاعتمادات',
          outputKey: 'ملفات الشهادات',
          multiple: true,
          required: false,
        },
        {
          id: 'existing_profile',
          type: 'yesno',
          label: 'هل لديك بروفايل سابق يمكن استخدامه كمرجع؟',
          outputKey: 'يوجد بروفايل سابق',
          required: false,
        },
        {
          id: 'existing_profile_file',
          type: 'file',
          label: 'ارفع البروفايل السابق',
          outputKey: 'ملف البروفايل السابق',
          multiple: true,
          required: false,
          showIf: { field: 'existing_profile', equals: 'yes' },
        },
        {
          id: 'design_references',
          type: 'url_list',
          label: 'روابط لتصاميم بروفايل تعجبك',
          outputKey: 'مراجع تصميم',
          required: false,
          placeholder: 'https://',
        },
        {
          id: 'design_notes',
          type: 'textarea',
          label: 'ملاحظات أو تفضيلات تصميم إضافية',
          outputKey: 'ملاحظات التصميم',
          required: false,
          rows: 3,
        },
      ],
    },
    {
      id: 'review',
      step: '05',
      icon: '✅',
      title: 'المراجعة وإضافة للسلة',
      desc: 'راجع الملخص ثم أضف الطلب للسلة.',
      fields: [
        {
          id: 'review_ack',
          type: 'yesno',
          label: 'أقرّ بأن المبلغ المعروض «يبدأ من»',
          outputKey: 'إقرار أن السعر يبدأ من',
          required: true,
        },
      ],
    },
  ],
};
