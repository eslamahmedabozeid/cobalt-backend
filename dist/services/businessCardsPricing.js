"use strict";
/**
 * Business Card Design service — dynamic pricing v1.0 (spec).
 * Design only (no physical print). Double-sided always included.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_CARDS_FORM_V1 = exports.DEFAULT_BUSINESS_CARDS_PRICING = exports.BUSINESS_CARDS_PRICING_VERSION = exports.BUSINESS_CARDS_SERVICE_ID = void 0;
exports.parseBusinessCardsPricingConfig = parseBusinessCardsPricingConfig;
exports.normalizeBusinessCardsAnswers = normalizeBusinessCardsAnswers;
exports.computeBusinessCardsQuote = computeBusinessCardsQuote;
exports.buildBusinessCardsDeliveryMeta = buildBusinessCardsDeliveryMeta;
exports.hasAdditionalPeopleFile = hasAdditionalPeopleFile;
exports.validateBusinessCardsPeople = validateBusinessCardsPeople;
exports.BUSINESS_CARDS_SERVICE_ID = 'business-cards';
exports.BUSINESS_CARDS_PRICING_VERSION = 'business-cards-v1.0';
exports.DEFAULT_BUSINESS_CARDS_PRICING = {
    version: exports.BUSINESS_CARDS_PRICING_VERSION,
    promotionEnabled: true,
    baseRegularSAR: 249,
    baseLaunchSAR: 149,
    separateLanguageSAR: 60,
    additionalPersonSAR: 25,
    brandCoordinationSAR: 50,
    editableAiSAR: 75,
    maxPeople: 20,
};
function asInt(v) {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : null;
}
function roundSAR(n) {
    return Math.round(n * 100) / 100;
}
function parseBusinessCardsPricingConfig(raw) {
    if (!raw || typeof raw !== 'object')
        return { ...exports.DEFAULT_BUSINESS_CARDS_PRICING };
    const c = raw;
    return {
        ...exports.DEFAULT_BUSINESS_CARDS_PRICING,
        ...c,
        version: String(c.version || exports.DEFAULT_BUSINESS_CARDS_PRICING.version),
        promotionEnabled: typeof c.promotionEnabled === 'boolean'
            ? c.promotionEnabled
            : exports.DEFAULT_BUSINESS_CARDS_PRICING.promotionEnabled,
        baseRegularSAR: asInt(c.baseRegularSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.baseRegularSAR,
        baseLaunchSAR: asInt(c.baseLaunchSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.baseLaunchSAR,
        separateLanguageSAR: asInt(c.separateLanguageSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.separateLanguageSAR,
        additionalPersonSAR: asInt(c.additionalPersonSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.additionalPersonSAR,
        brandCoordinationSAR: asInt(c.brandCoordinationSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.brandCoordinationSAR,
        editableAiSAR: asInt(c.editableAiSAR) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.editableAiSAR,
        maxPeople: asInt(c.maxPeople) ?? exports.DEFAULT_BUSINESS_CARDS_PRICING.maxPeople,
    };
}
function normalizeBusinessCardsAnswers(answers) {
    const out = { ...answers };
    delete out.__expressQuote;
    const people = asInt(out.number_of_people);
    if (people != null && people < 1)
        out.number_of_people = '1';
    if (String(out.wants_qr || '') !== 'yes') {
        out.qr_payload = '';
    }
    if (String(out.brand_mode || '') !== 'none') {
        out.text_only_confirm = 'no';
    }
    if (String(out.print_ready || '') !== 'yes') {
        out.print_specs = '';
    }
    if (String(out.delivery_speed || '') === 'rush') {
        out.delivery_speed = 'standard';
    }
    return out;
}
function personHasPrintableContact(p) {
    return Boolean(String(p.phone || '').trim() ||
        String(p.email || '').trim() ||
        String(p.website || '').trim() ||
        String(p.social || '').trim());
}
function computeBusinessCardsQuote(answersInput, configInput) {
    const answers = normalizeBusinessCardsAnswers(answersInput || {});
    const config = parseBusinessCardsPricingConfig(configInput);
    const languageMode = String(answers.language_mode || '');
    const allowedLang = ['ar', 'en', 'bilingual_same', 'separate_ar_en'];
    if (!allowedLang.includes(languageMode)) {
        return { ok: false, message: 'يرجى اختيار صيغة اللغة للكرت' };
    }
    const peopleRaw = asInt(answers.number_of_people);
    if (peopleRaw == null || peopleRaw < 1) {
        return { ok: false, message: 'يرجى تحديد عدد الأشخاص' };
    }
    const numberOfPeople = Math.min(config.maxPeople, Math.max(1, peopleRaw));
    const brandMode = String(answers.brand_mode || '');
    if (!['ready', 'coordination', 'none'].includes(brandMode)) {
        return { ok: false, message: 'يرجى تحديد حالة الشعار والهوية' };
    }
    if (brandMode === 'none' && String(answers.text_only_confirm || '') !== 'yes') {
        return {
            ok: false,
            message: 'بدون شعار: أكّد قبول كرت نصي فقط أو اطلب خدمة تصميم الشعار',
        };
    }
    const wantsAi = String(answers.wants_editable_ai || '');
    if (!['no', 'yes'].includes(wantsAi)) {
        return { ok: false, message: 'يرجى اختيار ملفات التسليم (مع/بدون مصدر .ai)' };
    }
    const delivery = String(answers.delivery_speed || 'standard');
    let rushAddOnSAR = 0;
    let blockCheckout;
    if (delivery === 'rush') {
        const trusted = answers.__expressQuote;
        const quote = trusted && typeof trusted === 'object' && !Array.isArray(trusted)
            ? trusted
            : null;
        const approved = quote && String(quote.status || '') === 'approved';
        const fee = quote ? asInt(quote.feeSAR) : null;
        if (!approved || fee == null || fee < 0) {
            blockCheckout =
                'التسليم العاجل يتطلب عرض سعر معتمداً من حاسبة الطلبات المستعجلة. لا يمكن إتمام الدفع حتى الاعتماد.';
            rushAddOnSAR = 0;
        }
        else {
            rushAddOnSAR = fee;
        }
    }
    const baseStandardSAR = config.baseRegularSAR;
    const baseActiveSAR = config.promotionEnabled ? config.baseLaunchSAR : config.baseRegularSAR;
    const languageAddOnSAR = languageMode === 'separate_ar_en' ? config.separateLanguageSAR : 0;
    const peopleAddOnSAR = Math.max(0, numberOfPeople - 1) * config.additionalPersonSAR;
    const brandAddOnSAR = brandMode === 'coordination' ? config.brandCoordinationSAR : 0;
    const aiAddOnSAR = wantsAi === 'yes' ? config.editableAiSAR : 0;
    const pretaxSubtotalSAR = roundSAR(baseActiveSAR + languageAddOnSAR + peopleAddOnSAR + brandAddOnSAR + aiAddOnSAR);
    const pretaxTotalSAR = roundSAR(pretaxSubtotalSAR + rushAddOnSAR);
    const lines = [];
    if (config.promotionEnabled) {
        lines.push({
            key: 'base_standard',
            label: 'السعر الأساسي (قبل العرض)',
            amountSAR: baseStandardSAR,
        });
        lines.push({
            key: 'promo_discount',
            label: 'خصم عرض الإطلاق',
            amountSAR: -(baseStandardSAR - baseActiveSAR),
        });
    }
    lines.push({
        key: 'base',
        label: 'تصميم كرت مزدوج الوجه (شخص واحد)',
        amountSAR: baseActiveSAR,
    });
    if (languageAddOnSAR) {
        lines.push({
            key: 'language',
            label: 'نسختان منفصلتان عربي/إنجليزي',
            amountSAR: languageAddOnSAR,
        });
    }
    if (peopleAddOnSAR) {
        lines.push({
            key: 'people',
            label: `أشخاص إضافيون (${numberOfPeople - 1} × ${config.additionalPersonSAR} ر.س)`,
            amountSAR: peopleAddOnSAR,
        });
    }
    if (brandAddOnSAR) {
        lines.push({
            key: 'brand',
            label: 'تنسيق ألوان وخطوط الكرت مع الشعار',
            amountSAR: brandAddOnSAR,
        });
    }
    if (aiAddOnSAR) {
        lines.push({
            key: 'editable_ai',
            label: 'ملف مصدر Adobe Illustrator (.ai)',
            amountSAR: aiAddOnSAR,
        });
    }
    if (rushAddOnSAR) {
        lines.push({ key: 'express', label: 'رسوم عاجلة معتمدة', amountSAR: rushAddOnSAR });
    }
    lines.push({ key: 'preliminary_note', label: 'يبدأ من', amountSAR: 0 });
    return {
        ok: true,
        pricingRuleVersion: config.version,
        promotionEnabled: config.promotionEnabled,
        isPreliminary: true,
        baseStandardSAR,
        baseActiveSAR,
        languageAddOnSAR,
        peopleAddOnSAR,
        brandAddOnSAR,
        aiAddOnSAR,
        rushAddOnSAR,
        pretaxSubtotalSAR,
        pretaxTotalSAR,
        numberOfPeople,
        languageMode,
        brandMode,
        lines,
        blockCheckout,
    };
}
function buildBusinessCardsDeliveryMeta(answers) {
    const pending = [];
    if (String(answers.website_link_later || '') === 'yes')
        pending.push('رابط الموقع');
    if (String(answers.social_links_later || '') === 'yes')
        pending.push('روابط التواصل');
    if (String(answers.logo_later || '') === 'yes')
        pending.push('ملف الشعار');
    const people = Array.isArray(answers.people_list)
        ? answers.people_list
        : [];
    people.forEach((p, idx) => {
        if (String(p.photo_later || '') === 'yes' || String(p.include_photo || '') === 'yes') {
            const hasPhoto = Array.isArray(p.photo) &&
                p.photo.some((f) => f && typeof f === 'object' && typeof f.id === 'string');
            if (String(p.photo_later || '') === 'yes' || (String(p.include_photo || '') === 'yes' && !hasPhoto)) {
                if (String(p.photo_later || '') === 'yes') {
                    pending.push(`صورة شخصية — شخص ${idx + 1}`);
                }
            }
        }
    });
    if (!pending.length)
        return null;
    return {
        status: 'awaiting_content',
        missingLabel: pending.join(' · '),
        productionEligible: false,
        productionStartedAt: null,
        updatedAt: new Date().toISOString(),
    };
}
/** True when customer uploaded Excel/CSV/PDF names list (makes people_list optional). */
function hasAdditionalPeopleFile(answers) {
    const files = answers.additional_people_file;
    if (!Array.isArray(files))
        return false;
    return files.some((f) => f && typeof f === 'object' && typeof f.id === 'string' && !!f.id);
}
/** Validate people_list completeness for checkout (shared by questionnaire). */
function validateBusinessCardsPeople(answers, configInput) {
    // Uploaded names file substitutes for typed people cards.
    if (hasAdditionalPeopleFile(answers)) {
        return null;
    }
    const config = parseBusinessCardsPricingConfig(configInput);
    const n = Math.min(config.maxPeople, Math.max(1, asInt(answers.number_of_people) || 1));
    const list = Array.isArray(answers.people_list)
        ? answers.people_list
        : [];
    if (list.length < n) {
        return `يرجى إدخال بيانات ${n} شخص/أشخاص على الكرت`;
    }
    const separate = String(answers.language_mode || '') === 'separate_ar_en';
    const wantsPhotoGlobal = String(answers.wants_photo || '') === 'yes';
    for (let i = 0; i < n; i++) {
        const p = list[i] || {};
        if (!String(p.name || '').trim()) {
            return `الاسم مطلوب للشخص ${i + 1}`;
        }
        if (!String(p.company_name || '').trim()) {
            return `اسم الشركة على الكرت مطلوب للشخص ${i + 1}`;
        }
        if (!personHasPrintableContact(p)) {
            return `أضف وسيلة تواصل واحدة على الأقل للطباعة على كرت الشخص ${i + 1} (هاتف/بريد/موقع/سوشيال)`;
        }
        if (separate && !String(p.name_en || '').trim()) {
            return `الاسم بالإنجليزية مطلوب للشخص ${i + 1} (نسختان منفصلتان)`;
        }
        if (wantsPhotoGlobal) {
            const include = String(p.include_photo || 'yes');
            if (include === 'yes') {
                const later = String(p.photo_later || '') === 'yes';
                const hasPhoto = Array.isArray(p.photo) &&
                    p.photo.some((f) => f && typeof f === 'object' && typeof f.id === 'string');
                if (!later && !hasPhoto) {
                    return `ارفع صورة شخصية للشخص ${i + 1} أو اختر «سأرفعها لاحقًا»`;
                }
            }
        }
    }
    return null;
}
const peopleOptions = Array.from({ length: exports.DEFAULT_BUSINESS_CARDS_PRICING.maxPeople }, (_, i) => {
    const n = i + 1;
    return {
        value: String(n),
        label: n === 1 ? 'شخص واحد (مشمول)' : `${n} أشخاص (+${(n - 1) * 25} ر.س)`,
    };
});
/** Arabic FormDefinition v1.0 for business-cards */
exports.BUSINESS_CARDS_FORM_V1 = {
    version: 2,
    stepLabels: [
        'بيانات الشركة والتواصل',
        'تخصيص الكرت والتسعير',
        'بيانات الكرت والملفات',
        'المراجعة والسلة',
    ],
    guaranteesTitle: 'ضمانات تصميم كروت الأعمال',
    guarantees: [
        {
            icon: '💳',
            title: 'وجه وظهر مشمولان دائمًا',
            desc: 'تصميم مزدوج الوجه ضمن السعر الأساسي — دون خيار وجه واحد.',
        },
        {
            icon: '🖨️',
            title: 'تصميم رقمي فقط',
            desc: 'الملفات رقمية؛ الطباعة الورقية والشحن غير مشمولين.',
        },
        {
            icon: '⏱️',
            title: 'تسليم قياسي 2–3 أيام عمل',
            desc: 'يبدأ العد بعد استلام البيانات والملفات الصالحة واعتماد النطاق.',
        },
        {
            icon: '📁',
            title: 'ملف .ai اختياري',
            desc: 'المصدر القابل للتحرير يُضاف برسوم واضحة عند الطلب.',
        },
    ],
    sections: [
        {
            id: 'client-contact',
            step: '01',
            icon: '🏢',
            title: 'بيانات الشركة والتواصل',
            desc: 'للتواصل بشأن الطلب — منفصلة عن بيانات الطباعة على الكرت',
            fields: [
                {
                    id: 'company_name',
                    type: 'text',
                    label: 'ما اسم شركتك أو علامتك التجارية؟',
                    outputKey: 'اسم الشركة',
                    required: true,
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
                    id: 'preferred_contact',
                    type: 'select',
                    label: 'طريقة التواصل المفضلة بخصوص الطلب',
                    outputKey: 'طريقة التواصل',
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
                    label: 'رقم أو بريد للتواصل بشأن الطلب',
                    outputKey: 'بيانات التواصل للطلب',
                    required: true,
                    placeholder: 'رقم الجوال أو البريد الإلكتروني',
                },
                {
                    id: 'digital_presence_type',
                    type: 'radio',
                    label: 'هل تمتلك شركتك موقعًا إلكترونيًا أو حسابات تواصل؟',
                    outputKey: 'الحضور الرقمي',
                    required: true,
                    options: [
                        { value: 'both', label: 'نعم، موقع وحسابات تواصل' },
                        { value: 'website_only', label: 'موقع إلكتروني فقط' },
                        { value: 'social_only', label: 'حسابات تواصل فقط' },
                        { value: 'none', label: 'لا يوجد حاليًا' },
                    ],
                },
                {
                    id: 'website_link_later',
                    type: 'checkbox',
                    label: 'تأجيل رابط الموقع',
                    outputKey: 'رابط الموقع لاحقًا',
                    required: false,
                    placeholder: 'سأضيف الرابط لاحقًا',
                    showIf: { field: 'digital_presence_type', equals: ['both', 'website_only'] },
                },
                {
                    id: 'website_url',
                    type: 'text',
                    label: 'رابط الموقع الإلكتروني',
                    outputKey: 'الموقع الإلكتروني',
                    required: false,
                    placeholder: 'https://',
                    showIf: { field: 'digital_presence_type', equals: ['both', 'website_only'] },
                },
                {
                    id: 'social_links_later',
                    type: 'checkbox',
                    label: 'تأجيل روابط التواصل',
                    outputKey: 'روابط التواصل لاحقًا',
                    required: false,
                    placeholder: 'سأضيف الروابط لاحقًا',
                    showIf: { field: 'digital_presence_type', equals: ['both', 'social_only'] },
                },
                {
                    id: 'social_media_urls',
                    type: 'url_list',
                    label: 'روابط حسابات التواصل',
                    outputKey: 'حسابات السوشيال',
                    required: false,
                    placeholder: 'https://',
                    addButtonLabel: 'إضافة رابط +',
                    showIf: { field: 'digital_presence_type', equals: ['both', 'social_only'] },
                },
            ],
        },
        {
            id: 'card-config',
            step: '02',
            icon: '💰',
            title: 'تخصيص الكرت والتسعير التقديري',
            desc: 'تصميم مزدوج الوجه مشمول دائمًا — الأسعار «تبدأ من» حسب خياراتك',
            fields: [
                {
                    id: 'sides_note',
                    type: 'text',
                    label: 'تصميم كرت مزدوج الوجه مشمول في السعر الأساسي',
                    outputKey: 'عدد الأوجه',
                    required: false,
                    defaultValue: 'وجه وظهر — مشمول',
                    placeholder: 'وجه وظهر — مشمول (لا يوجد خيار وجه واحد)',
                },
                {
                    id: 'language_mode',
                    type: 'select',
                    label: 'ما صيغة اللغة التي تريدها للكرت؟',
                    outputKey: 'صيغة اللغة',
                    required: true,
                    options: [
                        { value: 'ar', label: 'العربية فقط (مشمولة)' },
                        { value: 'en', label: 'الإنجليزية فقط (مشمولة)' },
                        { value: 'bilingual_same', label: 'عربي وإنجليزي على نفس الكرت (مشمول)' },
                        {
                            value: 'separate_ar_en',
                            label: 'نسختان منفصلتان عربي وإنجليزي (+60 ر.س)',
                        },
                    ],
                },
                {
                    id: 'number_of_people',
                    type: 'select',
                    label: 'كم شخصًا يحتاج كروتًا بنفس التصميم؟',
                    outputKey: 'عدد الأشخاص',
                    required: true,
                    defaultValue: '1',
                    options: peopleOptions,
                },
                {
                    id: 'brand_mode',
                    type: 'select',
                    label: 'هل لديك شعار وأسلوب هوية للكروت؟',
                    outputKey: 'حالة الهوية',
                    required: true,
                    options: [
                        { value: 'ready', label: 'نعم — شعار وإرشادات جاهزة (بدون رسوم)' },
                        {
                            value: 'coordination',
                            label: 'لدي شعار وأحتاج تنسيق ألوان وخطوط للكرت (+50 ر.س)',
                        },
                        {
                            value: 'none',
                            label: 'لا يوجد شعار — كرت نصي أو خدمة تصميم شعار منفصلة',
                        },
                    ],
                },
                {
                    id: 'text_only_confirm',
                    type: 'checkbox',
                    label: 'أؤكد أن الكرت نصي بدون شعار مقبول',
                    outputKey: 'تأكيد كرت نصي',
                    required: false,
                    placeholder: 'أوافق على المتابعة بكرت نصي بدون شعار',
                    showIf: { field: 'brand_mode', equals: 'none' },
                },
                {
                    id: 'wants_qr',
                    type: 'yesno',
                    label: 'هل تريد إضافة رمز QR ثابت على الكرت؟',
                    outputKey: 'رمز QR',
                    required: true,
                },
                {
                    id: 'wants_editable_ai',
                    type: 'select',
                    label: 'هل تريد ملف المصدر القابل للتحرير؟',
                    outputKey: 'ملف المصدر',
                    required: true,
                    options: [
                        { value: 'no', label: 'لا — ملفات التصدير النهائية فقط (مشمولة)' },
                        { value: 'yes', label: 'نعم — Adobe Illustrator (.ai) (+75 ر.س)' },
                    ],
                },
                {
                    id: 'delivery_speed',
                    type: 'select',
                    label: 'متى تحتاج استلام التصميم؟',
                    outputKey: 'سرعة التسليم',
                    required: true,
                    defaultValue: 'standard',
                    options: [
                        {
                            value: 'standard',
                            label: 'تسليم قياسي — 2 إلى 3 أيام عمل (بدون رسوم إضافية)',
                        },
                    ],
                },
            ],
        },
        {
            id: 'card-content',
            step: '03',
            icon: '📝',
            title: 'بيانات الكرت والملفات',
            desc: 'المعلومات التي ستظهر على الكرت — منفصلة عن بيانات تواصل الطلب',
            fields: [
                {
                    id: 'print_disclaimer',
                    type: 'text',
                    label: 'تنبيه: هذه الخدمة تصميم رقمي فقط — الطباعة الورقية والشحن غير مشمولين',
                    outputKey: 'تنبيه الطباعة',
                    required: false,
                    defaultValue: 'تصميم رقمي فقط',
                    placeholder: 'تصميم رقمي فقط — بدون طباعة أو شحن',
                },
                {
                    id: 'additional_people_file',
                    type: 'file',
                    label: 'ارفع قائمة أسماء/بيانات إضافية (Excel/CSV/PDF) إن كان أسهل',
                    outputKey: 'ملف بيانات الأشخاص',
                    required: false,
                    multiple: false,
                    showIf: { field: 'number_of_people', equals: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'] },
                },
                {
                    id: 'wants_photo',
                    type: 'yesno',
                    label: 'هل تريد صورة شخصية على الكرت؟',
                    outputKey: 'صورة شخصية',
                    required: true,
                },
                {
                    id: 'people_list',
                    type: 'people_list',
                    label: 'بيانات الأشخاص على الكرت',
                    outputKey: 'بيانات الأشخاص',
                    required: true,
                },
                {
                    id: 'print_ready',
                    type: 'yesno',
                    label: 'هل تحتاج ملفًا جاهزًا للطباعة الورقية؟',
                    outputKey: 'ملف طباعة جاهز',
                    required: true,
                },
                {
                    id: 'print_specs',
                    type: 'text',
                    label: 'هل لدى المطبعة مقاس أو مواصفات محددة؟ (اختياري)',
                    outputKey: 'مواصفات المطبعة',
                    required: false,
                    placeholder: 'مثال: 9×5 سم مع هوامش...',
                    showIf: { field: 'print_ready', equals: 'yes' },
                },
                {
                    id: 'logo_upload',
                    type: 'file',
                    label: 'ارفع شعار الشركة',
                    outputKey: 'الشعار',
                    required: false,
                    multiple: true,
                    showIf: { field: 'brand_mode', equals: ['ready', 'coordination'] },
                },
                {
                    id: 'logo_later',
                    type: 'checkbox',
                    label: 'سأرفع الشعار لاحقًا',
                    outputKey: 'الشعار لاحقًا',
                    required: false,
                    placeholder: 'سأرفع الشعار لاحقًا',
                    showIf: { field: 'brand_mode', equals: ['ready', 'coordination'] },
                },
                {
                    id: 'brand_files',
                    type: 'file',
                    label: 'ملفات إرشادات الهوية أو أصول إضافية (اختياري)',
                    outputKey: 'ملفات الهوية',
                    required: false,
                    multiple: true,
                    showIf: { field: 'brand_mode', equals: ['ready', 'coordination'] },
                },
                {
                    id: 'qr_payload',
                    type: 'text',
                    label: 'ما الرابط أو بيانات التواصل التي يفتحها رمز QR؟',
                    outputKey: 'هدف QR',
                    required: false,
                    placeholder: 'https:// أو رقم واتساب...',
                    showIf: { field: 'wants_qr', equals: 'yes' },
                },
                {
                    id: 'card_orientation',
                    type: 'select',
                    label: 'هل تفضّل كرتًا أفقيًا أم عموديًا؟',
                    outputKey: 'اتجاه الكرت',
                    required: true,
                    options: [
                        { value: 'horizontal', label: 'أفقي' },
                        { value: 'vertical', label: 'عمودي' },
                    ],
                },
                {
                    id: 'design_references',
                    type: 'url_list',
                    label: 'روابط لمراجع تصميم تعجبك (اختياري)',
                    outputKey: 'مراجع تصميم',
                    required: false,
                    placeholder: 'https://',
                    addButtonLabel: 'إضافة رابط +',
                },
                {
                    id: 'design_notes',
                    type: 'textarea',
                    label: 'ملاحظات أو تعليمات تصميم إضافية',
                    outputKey: 'ملاحظات التصميم',
                    required: false,
                    rows: 3,
                },
            ],
        },
        {
            id: 'review',
            step: '04',
            icon: '✅',
            title: 'المراجعة وإضافة للسلة',
            desc: 'راجع الملخص ثم أضف الطلب للسلة',
            fields: [
                {
                    id: 'review_ack',
                    type: 'yesno',
                    label: 'أقرّ بأن الأسماء والأرقام والمعلومات المعروضة على الكروت صحيحة، وأن المبلغ اجمالي',
                    outputKey: 'إقرار صحة البيانات',
                    required: true,
                },
            ],
        },
    ],
};
