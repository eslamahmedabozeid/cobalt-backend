import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FORM_DEFINITIONS } from './formDefinitions';
import {
  CONTENT_SECTIONS,
  FEATURE_BADGES,
  TRUST_STATS,
  VALUE_PROP_CARDS,
  HOW_IT_WORKS,
  PROCESS_STEPS,
  GUARANTEES,
  COMPARISON_COLUMNS,
  INQUIRIES_CTA,
  NAV_ITEMS,
  TOP_BAR,
  FOOTER_LINKS,
  CATEGORIES,
  FOOTER_DESC,
  SUPPORT_BLURB,
} from './seedCmsContent';
import {
  EDITOR_ROLE_ID,
  SUPER_ADMIN_ROLE_ID,
  VIEWER_ROLE_ID,
  editorPermissions,
  viewerPermissions,
} from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@cobalt.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.ADMIN_NAME || 'Cobalt Admin';

  await prisma.role.upsert({
    where: { id: SUPER_ADMIN_ROLE_ID },
    update: {
      slug: 'super-admin',
      name: 'مدير النظام',
      description: 'صلاحيات كاملة على كل الأقسام والعمليات',
      isSystem: true,
      permissions: '*',
    },
    create: {
      id: SUPER_ADMIN_ROLE_ID,
      slug: 'super-admin',
      name: 'مدير النظام',
      description: 'صلاحيات كاملة على كل الأقسام والعمليات',
      isSystem: true,
      permissions: '*',
    },
  });

  await prisma.role.upsert({
    where: { id: EDITOR_ROLE_ID },
    update: {
      slug: 'editor',
      name: 'محرر',
      description: 'إدارة المحتوى والمتجر بدون إدارة المستخدمين والأدوار',
      isSystem: true,
      permissions: JSON.stringify(editorPermissions()),
    },
    create: {
      id: EDITOR_ROLE_ID,
      slug: 'editor',
      name: 'محرر',
      description: 'إدارة المحتوى والمتجر بدون إدارة المستخدمين والأدوار',
      isSystem: true,
      permissions: JSON.stringify(editorPermissions()),
    },
  });

  await prisma.role.upsert({
    where: { id: VIEWER_ROLE_ID },
    update: {
      slug: 'viewer',
      name: 'مشاهد',
      description: 'عرض فقط بدون إضافة أو تعديل أو حذف',
      isSystem: true,
      permissions: JSON.stringify(viewerPermissions()),
    },
    create: {
      id: VIEWER_ROLE_ID,
      slug: 'viewer',
      name: 'مشاهد',
      description: 'عرض فقط بدون إضافة أو تعديل أو حذف',
      isSystem: true,
      permissions: JSON.stringify(viewerPermissions()),
    },
  });

  await prisma.adminUser.upsert({
    where: { email },
    update: { roleId: SUPER_ADMIN_ROLE_ID, active: true },
    create: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      roleId: SUPER_ADMIN_ROLE_ID,
      active: true,
    },
  });

  const currencies = [
    { code: 'SAR', symbol: 'ر.س', rate: 1.0, name: 'ريال سعودي', flag: '🇸🇦' },
    { code: 'USD', symbol: '$', rate: 0.27, name: 'دولار أمريكي', flag: '🇺🇸' },
    { code: 'AED', symbol: 'د.إ', rate: 0.98, name: 'درهم إماراتي', flag: '🇦🇪' },
    { code: 'EGP', symbol: 'ج.م', rate: 13.2, name: 'جنيه مصري', flag: '🇪🇬' },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {
      footerDesc: FOOTER_DESC,
      supportBlurb: SUPPORT_BLURB,
    },
    create: {
      id: 'default',
      siteTitle: 'كوبالت | متجر الخدمات الرقمية والتسويقية والمواقع',
      siteDescription:
        'المتجر الإلكتروني المباشر لخدمات كوبالت الرقمية: السوشيال ميديا، تصميم موقع إلكتروني، المتجر الإلكتروني، موشن جرافيك وفيديو، والتسويق والإعلانات مع حاسبة تكلفة وسلة شراء سريعة.',
      whatsappNumber: '201061265862',
      logoUrl: '/assets/logo-cobalt-Be-YWUxa.png',
      instagramUrl: 'https://instagram.com',
      twitterUrl: 'https://twitter.com',
      tiktokUrl: 'https://tiktok.com',
      copyrightText: 'كوبالت للخدمات الرقمية (Cobalt). جميع الحقوق محفوظة.',
      paymentBadges: JSON.stringify(['مدى Mada', 'Apple Pay', 'Visa / Master', 'تابي Tabby', 'تمارا Tamara']),
      footerDesc: FOOTER_DESC,
      supportBlurb: SUPPORT_BLURB,
    },
  });

  await prisma.calculatorConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      expressFeeSAR: 150,
      vipFeeSAR: 250,
      multilingualFeeSAR: 200,
      normalLabel: 'تسليم قياسي مريح (خلال 3 - 5 أيام)',
      expressLabel: 'تسليم عاجل',
      vipLabel: 'تسليم فوري VIP خلال 24 ساعة',
      multilingualLabel: 'إضافة اللغة الإنجليزية للمشروع',
    },
  });

  const coupons = [
    { code: 'COBALT20', discountPercentage: 20 },
    { code: 'WELCOME10', discountPercentage: 10 },
    { code: 'VIP25', discountPercentage: 25 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { discountPercentage: c.discountPercentage, active: true },
      create: c,
    });
  }

  // Services from src/data/services.ts
  const services = [
    {
      id: 'social-media-posts',
      slug: 'social-media-posts',
      title: 'تصميم وإدارة منشورات السوشيال ميديا',
      category: 'social',
      categoryName: 'السوشيال ميديا',
      badge: '⭐ مبيعات وتفاعل',
      delivery: '⚡ تسليم في 48 ساعة',
      rating: 4.95,
      reviewsCount: 64,
      image: '/assets/cobalt_social_cover_1787772934272.jpg',
      priceSAR: 199,
      oldPriceSAR: 350,
      shortDesc: 'تصاميم جرافيك وإدارة احترافية لكافة منصات التواصل لزيادة المبيعات والوصول للجمهور المستهدف.',
      deliverables: [
        'تصاميم مقاسات مخصصة (بوستات، ستوريز، ريلز)',
        'صياغة الكابشن والهاشتاجات النشطة الموجهة',
        'تسليم ملفات الجرافيك بدقة عالية PNG + قوالب التعديل',
      ],
      sortOrder: 1,
      packages: [
        { id: 'posts_4', name: '4 منشورات احترافية', priceSAR: 199, description: '4 تصاميم بوستات + كتابة كابشن وهاشتاجات', sortOrder: 1 },
        { id: 'posts_8', name: '8 منشورات متكاملة', priceSAR: 349, description: '8 تصاميم بوستات/ستوريز + خطة نشر متكاملة', sortOrder: 2 },
        { id: 'posts_12', name: '12 منشور تسويقي VIP', priceSAR: 480, description: '12 تصميم + هايلايتس + كتابة محتوى بيعي', sortOrder: 3 },
      ],
      addons: [
        { id: 'addon_reels_cover', title: 'تصميم أغطية ريلز وفيديوهات (3 تصاميم)', priceSAR: 80, desc: 'أغلفة جذابة لريلز انستقرام وتيك توك', sortOrder: 1 },
        { id: 'addon_motion_intro', title: 'إنترو موشن جرافيك للشعار (5 ثوانٍ)', priceSAR: 150, desc: 'تحريك شعار براندك باحترافية', sortOrder: 2 },
        { id: 'addon_fast_delivery', title: 'تسليم فوري مستعجل خلال 24 ساعة', priceSAR: 90, desc: 'أولوية تنفيذ عاجلة', sortOrder: 3 },
      ],
    },
    {
      id: 'website-design',
      slug: 'website-design',
      title: 'تصميم وتطوير المواقع الإلكترونية والشركات',
      category: 'web',
      categoryName: 'تصميم موقع إلكتروني',
      badge: '🚀 الأكثر طلباً للشركات',
      delivery: '⚡ تسليم في 5-7 أيام',
      rating: 4.97,
      reviewsCount: 54,
      image: '/assets/cobalt_web_cover_1787772997952.jpg',
      priceSAR: 1499,
      oldPriceSAR: 2400,
      shortDesc: 'تصميم مواقع تعريفية وصفحات هبوط عصرية سريعة، متجاوبة 100% مع كافة الجوالات ومجهزة بالكامل.',
      deliverables: [
        'تصميم عصري متجاوب 100% مع الجوال والشاشات المختلفة',
        'ربط استمارة التواصل والواتساب وخرائط جوجل',
        'استضافة ودومين مجاني للسنة الأولى مع شهادة SSL',
      ],
      sortOrder: 2,
      packages: [
        { id: 'landing_page', name: 'صفحة هبوط تسويقية (Landing Page)', priceSAR: 999, description: 'صفحة واحدة فائقة الإقناع والسرعة لحملاتك', sortOrder: 1 },
        { id: 'company_site', name: 'موقع شركة متكامل (5-8 صفحات)', priceSAR: 1499, description: 'موقع مؤسسي تعريفي فاخر بكامل الأقسام', sortOrder: 2 },
        { id: 'booking_services', name: 'موقع خدمات وحجوزات متقدم', priceSAR: 1899, description: 'موقع مع نظام حجز واستقبال طلبات أونلاين', sortOrder: 3 },
      ],
      addons: [
        { id: 'addon_multilingual', title: 'إضافة لغة إضافية (إنجليزي / عربي)', priceSAR: 350, desc: 'ترجمة كاملة وضبط واجهة اللغات', sortOrder: 1 },
        { id: 'addon_seo_pro', title: 'تهيئة محركات البحث المتقدمة (SEO Pro)', priceSAR: 250, desc: 'أرشفة جوجل وميتا تاج وسرعة خارقة', sortOrder: 2 },
        { id: 'addon_chat_widget', title: 'تكامل المحادثة الفورية والذكاء الاصطناعي', priceSAR: 180, desc: 'بوت دردشة واستقبال عملاء 24/7', sortOrder: 3 },
      ],
    },
    {
      id: 'ecommerce-store',
      slug: 'ecommerce-store',
      title: 'تصميم وتجهيز المتاجر الإلكترونية المتكاملة',
      category: 'store',
      categoryName: 'المتجر الإلكتروني',
      badge: '🛍️ تجارة إلكترونية متكاملة',
      delivery: '⚡ تسليم في 5-8 أيام',
      rating: 4.98,
      reviewsCount: 68,
      image: '/assets/cobalt_web_cover_1787772997952.jpg',
      priceSAR: 1999,
      oldPriceSAR: 3200,
      shortDesc: 'متجر إلكتروني احترافي متكامل مهيأ للمبيعات، مربوط ببوابات الدفع (مدى، Apple Pay) وشركات الشحن.',
      deliverables: [
        'تجهيز وضبط المنتجات والتصنيفات وسياسات المتجر',
        'ربط بوابات الدفع الإلكتروني (مدى، فيزا، تابي، تمارا)',
        'ربط خيارات وشركات الشحن وحساب الضريبة التلقائي',
      ],
      sortOrder: 3,
      packages: [
        { id: 'store_starter', name: 'متجر مبتدئ (حتى 50 منتج)', priceSAR: 1999, description: 'إعداد المتجر + ربط الدفع والشحن + ضبط التصنيفات', sortOrder: 1 },
        { id: 'store_pro', name: 'متجر احترافي غير محدود (Pro Store)', priceSAR: 2899, description: 'متجر فاخر غير محدود المنتجات + ثيم مدفوع + ربط التسويق', sortOrder: 2 },
      ],
      addons: [
        { id: 'addon_product_upload', title: 'إدخال وضبط 50 منتج إضافي مع الصور', priceSAR: 300, desc: 'تفريغ وتنسيق صور المنتجات والأسعار', sortOrder: 1 },
        { id: 'addon_tabby_tamara', title: 'توثيق وربط أقساط تابي وتمارا رسمي', priceSAR: 200, desc: 'زيادة المبيعات بنظام الدفع الآجل', sortOrder: 2 },
        { id: 'addon_pixels_tracking', title: 'ربط سناب وتيك توك وفيسبوك بيكسل', priceSAR: 150, desc: 'تتبع شامل للأحداث والتحويلات', sortOrder: 3 },
      ],
    },
    {
      id: 'motion-graphics',
      slug: 'motion-graphics',
      title: 'إنتاج فيديوهات الموشن جرافيك والمونتاج',
      category: 'motion',
      categoryName: 'موشن جرافيك / فيديو',
      badge: '🎬 فيديو إعلاني مبهر',
      delivery: '⚡ تسليم في 3-5 أيام',
      rating: 4.94,
      reviewsCount: 46,
      image: '/assets/cobalt_marketing_cover_1787773021459.jpg',
      priceSAR: 850,
      oldPriceSAR: 1400,
      shortDesc: 'فيديوهات موشن جرافيك 2D/3D إعلانية جذابة مع كتابة السيناريو الاحترافي والتعليق الصوتي الفاخر.',
      deliverables: [
        'كتابة سيناريو إعلاني جذاب (Scriptwriting)',
        'تعليق صوتي فخم بمختلف اللهجات واللغات',
        'تحريك ورسوم بصرية عالية الدقة 4K / Full HD',
      ],
      sortOrder: 4,
      packages: [
        { id: 'motion_15s', name: 'فيديو إعلاني قصير 15 ثانية', priceSAR: 550, description: 'مناسب لستوريز وتيك توك وسناب شات', sortOrder: 1 },
        { id: 'motion_30s', name: 'فيديو إعلاني قياسي 30 ثانية', priceSAR: 850, description: 'الخيار الأكثر طلباً للشرح والتسويق المتكامل', sortOrder: 2 },
        { id: 'motion_60s', name: 'فيديو تسويقي شامل 60 ثانية', priceSAR: 1450, description: 'شرح مفصل للتطبيقات والمشاريع الكبيرة', sortOrder: 3 },
      ],
      addons: [
        { id: 'addon_multiple_aspects', title: 'تصدير الفيديو بمقاسين مختلفين (عمودي + أفقي)', priceSAR: 120, desc: 'مقاس 9:16 للجوال و16:9 لليوتيوب', sortOrder: 1 },
        { id: 'addon_soundtrack_license', title: 'موسيقى ومؤثرات صوتية مرخصة تجارياً', priceSAR: 100, desc: 'أصوات ومؤثرات حصرية بدون حقوق', sortOrder: 2 },
        { id: 'addon_english_subtitles', title: 'ترجمة نصية وتفريغ كابشن إنجليزي', priceSAR: 80, desc: 'إضافة نصوص مترجمة متحركة', sortOrder: 3 },
      ],
    },
    {
      id: 'digital-marketing',
      slug: 'digital-marketing',
      title: 'إدارة حملات التسويق الرقمي والإعلانات الممولة',
      category: 'marketing',
      categoryName: 'التسويق والإعلانات',
      badge: '📈 مضاعفة المبيعات',
      delivery: '⚡ إطلاق فوري خلال 24 ساعة',
      rating: 4.96,
      reviewsCount: 59,
      image: '/assets/cobalt_marketing_cover_1787773021459.jpg',
      priceSAR: 750,
      oldPriceSAR: 1200,
      shortDesc: 'إطلاق وإدارة الحملات الإعلانية على سناب شات، تيك توك، انستقرام، وجوجل لتحقيق أعلى عائد مبيعات.',
      deliverables: [
        'تحديد واستهداف الجمهور والشرائح الأكثر شراءً بدقة',
        'إعداد وتجهيز الإعلانات والتتبع التحليلي المباشر',
        'تقارير أداء يومية وأسبوعية لتحسين تكلفة النتائج',
      ],
      sortOrder: 5,
      packages: [
        { id: 'campaign_single', name: 'إدارة حملة منصة واحدة (سناب أو تيك توك)', priceSAR: 750, description: 'استهداف دقيق + إطلاق الإعلانات + تحسين مستمر أسبوعين', sortOrder: 1 },
        { id: 'campaign_multi', name: 'إدارة حملات متكاملة متعددة المنصات', priceSAR: 1400, description: 'إدارة إعلانية متكاملة لـ 3 منصات لمدة شهر كامل', sortOrder: 2 },
      ],
      addons: [
        { id: 'addon_ad_creatives', title: 'تصميم 4 بنرات إعلانية احترافية للحملة', priceSAR: 220, desc: 'تصاميم موجهة لرفع نسبة النقر CTR', sortOrder: 1 },
        { id: 'addon_competitor_audit', title: 'تحليل المنافسين وسلوك السوق المتعمق', priceSAR: 180, desc: 'تقرير شامل عن إعلانات المنافسين وثغرات السوق', sortOrder: 2 },
      ],
    },
  ];

  for (const s of services) {
    const { packages, addons, deliverables, ...svc } = s;
    await prisma.service.upsert({
      where: { id: svc.id },
      update: { ...svc, deliverables: JSON.stringify(deliverables) },
      create: { ...svc, deliverables: JSON.stringify(deliverables) },
    });
    for (const p of packages) {
      await prisma.servicePackage.upsert({
        where: { id: p.id },
        update: { ...p, serviceId: svc.id },
        create: { ...p, serviceId: svc.id },
      });
    }
    for (const a of addons) {
      await prisma.serviceAddon.upsert({
        where: { id: a.id },
        update: { ...a, serviceId: svc.id },
        create: { ...a, serviceId: svc.id },
      });
    }
  }

  // FormDefinition v2 schemas extracted from frontend order components
  for (const [serviceId, schema] of Object.entries(FORM_DEFINITIONS)) {
    await prisma.serviceRequirementSchema.upsert({
      where: { serviceId },
      update: { schemaJson: JSON.stringify(schema), version: 2 },
      create: { serviceId, schemaJson: JSON.stringify(schema), version: 2 },
    });
  }

  const bundles = [
    {
      id: 'bundle-presence-360',
      title: 'موقع إلكتروني + 12 بوست سوشيال ميديا',
      badge: '🔥 باقة التواجد الرقمي 360',
      description: 'تضمن لك حضوراً قوياً وموثوقاً عبر الإنترنت من خلال موقع متكامل سريع وخطة نشر وتصاميم ممتازة على شبكات التواصل.',
      priceSAR: 1699,
      compareAtSAR: 2500,
      image: '/assets/cobalt_cards_cover_1787772953354.jpg',
      sortOrder: 1,
    },
    {
      id: 'bundle-sales-media',
      title: 'متجر إلكتروني + موشن جرافيك + إدارة إعلانات',
      badge: '⭐ باقة المبيعات والميديا المتكاملة',
      description: 'باقة إطلاق المبيعات الكاملة: متجر إلكتروني متكامل + فيديو إعلاني موشن جرافيك احترافي + إدارة حملة إعلانية ممولة للوصول لآلاف المشترين.',
      priceSAR: 3200,
      compareAtSAR: 4800,
      image: '/assets/cobalt_cards_cover_1787772953354.jpg',
      sortOrder: 2,
    },
  ];
  for (const b of bundles) {
    await prisma.bundle.upsert({ where: { id: b.id }, update: b, create: b });
  }

  const slides = [
    {
      id: 'slide-1',
      title: 'تصميم وتطوير المواقع والمتاجر الإلكترونية الفائقة',
      subtitle: 'مواقع ومتاجر عصرية فائقة السرعة مربوطة ببوابات الدفع (مدى، Apple Pay) والشحن ومتجاوبة 100% مع الجوال.',
      tag: '💻 الأكثر طلباً للنمو الرقمي',
      image: '/assets/cobalt_web_cover_1787772997952.jpg',
      link: '/services/website-design',
      ctaText: 'اطلب موقعك الآن',
      sortOrder: 1,
    },
    {
      id: 'slide-2',
      title: 'إدارة وتصاميم السوشيال ميديا والحملات الإعلانية',
      subtitle: 'تصاميم جرافيك مبتكرة وإدارة حملات ممولة موجهة بدقة على سناب شات، تيك توك، وانستقرام لزيادة المبيعات.',
      tag: '📈 مضاعفة التفاعل والوصول',
      image: '/assets/cobalt_social_cover_1787772934272.jpg',
      link: '/services/social-media-posts',
      ctaText: 'تصفح باقات السوشيال ميديا',
      sortOrder: 2,
    },
    {
      id: 'slide-3',
      title: 'إنتاج فيديوهات الموشن جرافيك والمونتاج الإعلاني',
      subtitle: 'فيديوهات بصرية مبهرة مع كتابة السيناريو الاحترافي والتعليق الصوتي الفخم لتحويل المشاهدين إلى عملاء.',
      tag: '🎬 فيديو إعلاني تفاعلي مبهر',
      image: '/assets/cobalt_marketing_cover_1787773021459.jpg',
      link: '/services/motion-graphics',
      ctaText: 'شاهد نماذج الفيديو',
      sortOrder: 3,
    },
  ];
  for (const s of slides) {
    await prisma.heroSlide.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // Live FAQs from FaqSection.tsx
  const faqs = [
    { id: 'faq-live-1', question: 'هل يمكنني طلب خدمة واحدة فقط دون الحاجة لشراء باقة كاملة؟', answer: 'نعم، نوفر مرونة كاملة لطلب الخدمات بشكل منفرد حسب احتياجك دون إلزامك بباقات كبيرة.', sortOrder: 1 },
    { id: 'faq-live-2', question: 'كيف يتم تحديد تكلفة الخدمة التي أريدها؟', answer: 'يمكنك استخدام حاسبة الأسعار في الموقع لاختيار الخدمة وسرعة التسليم والإضافات ومعرفة التكلفة التقديرية فوراً.', sortOrder: 2 },
    { id: 'faq-live-3', question: 'ما هي آلية العمل بعد إتمام الطلب والدفع؟', answer: 'بعد إتمام الطلب يتم فتح قناة تواصل مباشرة عبر الواتساب مع مدير الحساب لمتابعة التنفيذ خطوة بخطوة.', sortOrder: 3 },
    { id: 'faq-live-4', question: 'ماذا لو أردت تعديل التصميم أو المحتوى بعد استلامه؟', answer: 'نقدّم تعديلات حتى الوصول لرضاك التام ضمن نطاق الباقة المتفق عليها.', sortOrder: 4 },
    { id: 'faq-live-5', question: 'هل أحصل على الملفات المفتوحة والمصدرية للخدمة؟', answer: 'نعم، نسلّم الملفات المصدرية والمفتوحة حسب طبيعة الخدمة (مثل AI وPSD وPDF وFigma وSVG حيث ينطبق).', sortOrder: 5 },
    { id: 'faq-live-6', question: 'ما هي خيارات سرعة التسليم المتاحة لديكم؟', answer: 'يتوفر التسليم القياسي خلال 3-5 أيام، والتسليم العاجل، وخيار VIP خلال 24-48 ساعة حسب الخدمة.', sortOrder: 6 },
  ];
  for (const f of faqs) {
    await prisma.faq.upsert({ where: { id: f.id }, update: f, create: f });
  }

  // Live testimonials from ReviewsSection.tsx
  const testimonials = [
    {
      id: 't-live-1',
      author: 'سارة الشمري',
      company: 'شركة أفق للتطوير - الرياض',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      stars: '★★★★★',
      text: 'تجربة اقتياد الخدمة وتحديد المرفقات والملاحظات ممتازة جداً وواضحة! استلمت بروفايل الشركة قبل موعده بدقة عالية وبملفات طباعة جاهزة.',
      purchased: 'بروفايل الشركة الفاخر',
      sortOrder: 1,
    },
    {
      id: 't-live-2',
      author: 'م. خالد الغامدي',
      company: 'متجر سدير ستايل - جدة',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      stars: '★★★★★',
      text: 'الموقع فائق السلاسة والتصميم والأسعار في المتجر واضحة جداً. طلبت تصميم الهوية والموقع والنتيجة كانت خيالية وتجاوزت توقعاتي.',
      purchased: 'الهوية البصرية والموقع',
      sortOrder: 2,
    },
    {
      id: 't-live-3',
      author: 'د. ريم منصور',
      company: 'عيادات ريم - دبي',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop',
      stars: '★★★★★',
      text: 'تصاميم السوشيال ميديا وفيديوهات الموشن جرافيك التي نفذوها لحساباتنا زادت التفاعل والمبيعات لدينا بصورة ملحوظة جداً!',
      purchased: 'الموشن جرافيك والسوشيال',
      sortOrder: 3,
    },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.upsert({ where: { id: t.id }, update: t, create: t });
  }

  // Portfolio from portfolio.ts
  const portfolio = [
    {
      id: 'portfolio-1',
      title: 'تصميم موقع شركة متكامل - نماء للحلول الذكية',
      tag: 'web',
      categoryName: 'تصميم موقع إلكتروني',
      client: 'شركة نماء للحلول الذكية - الرياض',
      duration: '5 أيام عمل',
      serviceUrl: '/services/website-design',
      desc: 'موقع مؤسسي عصري سريع ومتجاوب مع ربط واتساب واستمارات تواصل احترافية.',
      image: '/assets/cobalt_web_cover_1787772997952.jpg',
      features: ['سرعة تحميل قياسية < 1.2 ثانية', 'تجاوب فائق مع جميع الشاشات', 'ربط فوري بنظام إشعارات الواتساب'],
      sortOrder: 1,
    },
    {
      id: 'portfolio-2',
      title: 'تصميم متجر إلكتروني متكامل - متجر سدير ستايل',
      tag: 'store',
      categoryName: 'المتجر الإلكتروني',
      client: 'متجر سدير ستايل للأزياء - الخبر',
      duration: '6 أيام عمل',
      serviceUrl: '/services/ecommerce-store',
      desc: 'متجر مبيعات مربوط ببوابات الدفع وشركات الشحن مع ضبط المنتجات والمخزون.',
      image: '/assets/cobalt_web_cover_1787772997952.jpg',
      features: ['بوابات دفع مدى وApple Pay', 'ربط شركات الشحن وسمسا وأرامكس', 'نظام إدارة المخزون الذكي'],
      sortOrder: 2,
    },
    {
      id: 'portfolio-3',
      title: 'تصاميم وإدارة السوشيال ميديا - عيادات دبي الطبية',
      tag: 'social',
      categoryName: 'السوشيال ميديا',
      client: 'مجموعة عيادات ريم الطبية - دبي',
      duration: '48 ساعة',
      serviceUrl: '/services/social-media-posts',
      desc: 'خطة محتوى وتصاميم موحدة الهوية لرفع التفاعل والحجوزات.',
      image: '/assets/cobalt_social_cover_1787772934272.jpg',
      features: ['هوية بصرية موحدة', 'كتابة محتوى إعلاني جذاب', 'تصاميم بأعلى دقة 4K'],
      sortOrder: 3,
    },
    {
      id: 'portfolio-4',
      title: 'فيديو موشن جرافيك 60 ثانية - تطبيق وصلني',
      tag: 'motion',
      categoryName: 'موشن جرافيك / فيديو',
      client: 'تطبيق وصلني للخدمات اللوجستية',
      duration: '4 أيام عمل',
      serviceUrl: '/services/motion-graphics',
      desc: 'فيديو إعلاني مع سيناريو وتعليق صوتي وتحريك احترافي.',
      image: '/assets/cobalt_marketing_cover_1787773021459.jpg',
      features: ['تعليق صوتي استوديو احترافي', 'مؤثرات صوتية مرخصة', 'إخراج وتسليم بجودة 4K UHD'],
      sortOrder: 4,
    },
    {
      id: 'portfolio-5',
      title: 'إدارة حملات إعلانية ممولة - براند نايس كير',
      tag: 'marketing',
      categoryName: 'التسويق والإعلانات',
      client: 'براند نايس لمنتجات العناية - جدة',
      duration: 'إطلاق فوري 24 ساعة',
      serviceUrl: '/services/digital-marketing',
      desc: 'حملات ممولة باستهداف دقيق وتقارير أداء لرفع المبيعات.',
      image: '/assets/cobalt_marketing_cover_1787773021459.jpg',
      features: ['عائد إعلاني ROAS 4.8x', 'استهداف دقيق للشريحة الشرائية', 'تقارير أداء وتتبع لحظي'],
      sortOrder: 5,
    },
  ];
  for (const p of portfolio) {
    const { features, ...rest } = p;
    await prisma.portfolioItem.upsert({
      where: { id: p.id },
      update: { ...rest, features: JSON.stringify(features) },
      create: { ...rest, features: JSON.stringify(features) },
    });
  }

  // —— Homepage / Nav / Footer CMS ——
  for (const s of CONTENT_SECTIONS) {
    await prisma.contentSection.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }
  for (const row of FEATURE_BADGES) {
    await prisma.featureBadge.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of TRUST_STATS) {
    await prisma.trustStat.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of VALUE_PROP_CARDS) {
    await prisma.valuePropCard.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of HOW_IT_WORKS) {
    await prisma.howItWorksStep.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of PROCESS_STEPS) {
    await prisma.processStep.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of GUARANTEES) {
    await prisma.guaranteeCard.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const col of COMPARISON_COLUMNS) {
    const { items, ...rest } = col;
    await prisma.comparisonColumn.upsert({
      where: { id: col.id },
      update: rest,
      create: rest,
    });
    for (const item of items) {
      await prisma.comparisonItem.upsert({
        where: { id: item.id },
        update: { ...item, columnId: col.id },
        create: { ...item, columnId: col.id },
      });
    }
  }
  await prisma.inquiriesCta.upsert({
    where: { id: 'default' },
    update: INQUIRIES_CTA,
    create: INQUIRIES_CTA,
  });
  await prisma.topBarPromo.upsert({
    where: { id: 'default' },
    update: TOP_BAR,
    create: TOP_BAR,
  });
  for (const row of NAV_ITEMS) {
    await prisma.navItem.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of FOOTER_LINKS) {
    await prisma.footerLink.upsert({ where: { id: row.id }, update: row, create: row });
  }
  for (const row of CATEGORIES) {
    await prisma.category.upsert({ where: { id: row.id }, update: row, create: row });
  }

  console.log('Seed completed successfully');
  console.log(`Admin: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
