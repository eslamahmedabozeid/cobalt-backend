/**
 * Five branding services from Cobalt_Digital_Services_Order_Forms_Specification_AR.doc
 * الشعار / الهوية / الكروت / المطبوعات are separate services (not combined).
 */

const BRANDING_IMAGE = '/assets/cobalt_branding_cover_1787772916470.jpg';
const PRICE = 100;

type Field = {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'yesno' | 'multichip' | 'url_list' | 'file';
  label: string;
  outputKey: string;
  icon?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  multiple?: boolean;
  defaultValue?: string | string[];
  options?: Array<{ value: string; label: string }>;
  showIf?: { field: string; equals: string | string[] };
};

function section(
  id: string,
  step: string,
  icon: string,
  title: string,
  desc: string,
  fields: Field[]
) {
  return { id, step, icon, title, desc, fields };
}

/** Shared client context fields from the Arabic specification (beyond checkout name/phone/email). */
const SHARED_CLIENT_FIELDS: Field[] = [
  {
    id: 'companyOrBrand',
    type: 'text',
    label: 'اسم الشركة / البراند',
    outputKey: 'اسم الشركة / البراند',
    icon: '🏢',
    required: true,
    placeholder: 'اكتب اسم الشركة أو البراند...',
  },
  {
    id: 'country',
    type: 'text',
    label: 'الدولة',
    outputKey: 'الدولة',
    icon: '🌍',
    required: true,
    placeholder: 'مثال: السعودية',
  },
  {
    id: 'websiteUrl',
    type: 'text',
    label: 'الموقع الإلكتروني',
    outputKey: 'الموقع الإلكتروني',
    icon: '🔗',
    required: false,
    placeholder: 'https://...',
  },
  {
    id: 'socialAccounts',
    type: 'url_list',
    label: 'حسابات السوشيال ميديا',
    outputKey: 'حسابات السوشيال ميديا',
    placeholder: 'https://instagram.com/...',
    required: false,
  },
  {
    id: 'preferredContact',
    type: 'select',
    label: 'طريقة التواصل المفضلة',
    outputKey: 'طريقة التواصل المفضلة',
    icon: '📞',
    required: true,
    defaultValue: 'واتساب',
    options: [
      { value: 'واتساب', label: 'واتساب' },
      { value: 'إيميل', label: 'إيميل' },
      { value: 'اتصال', label: 'اتصال' },
    ],
  },
];

function form(stepLabels: string[], sections: ReturnType<typeof section>[]) {
  return {
    version: 2 as const,
    stepLabels,
    sections,
  };
}

const COMPANY_PROFILE_FORM = form(
  ['بيانات العميل', 'محتوى البروفايل', 'الملفات والملاحظات'],
  [
    section('client', '01', '👤', 'بيانات العميل والسياق', 'معلومات التواصل والسياق العام للطلب', SHARED_CLIENT_FIELDS),
    section('profile-content', '02', '📄', 'محتوى بروفايل الشركة', 'بيانات الشركة والمحتوى المطلوب في البروفايل', [
      {
        id: 'companyNameAr',
        type: 'text',
        label: 'اسم الشركة بالعربي',
        outputKey: 'اسم الشركة بالعربي',
        icon: '🏷️',
        required: true,
      },
      {
        id: 'companyNameEn',
        type: 'text',
        label: 'اسم الشركة بالإنجليزي',
        outputKey: 'اسم الشركة بالإنجليزي',
        required: false,
      },
      {
        id: 'businessField',
        type: 'text',
        label: 'مجال عمل الشركة',
        outputKey: 'مجال عمل الشركة',
        icon: '💼',
        required: true,
      },
      {
        id: 'companySummary',
        type: 'textarea',
        label: 'نبذة مختصرة عن الشركة',
        outputKey: 'نبذة مختصرة عن الشركة',
        icon: '📝',
        required: true,
        rows: 4,
      },
      {
        id: 'foundedYear',
        type: 'text',
        label: 'سنة التأسيس',
        outputKey: 'سنة التأسيس',
        required: false,
        placeholder: 'مثال: 2018',
      },
      {
        id: 'cityCountry',
        type: 'text',
        label: 'الدولة / المدينة',
        outputKey: 'الدولة / المدينة',
        required: false,
      },
      {
        id: 'contentReady',
        type: 'select',
        label: 'هل محتوى البروفايل جاهز؟',
        outputKey: 'هل محتوى البروفايل جاهز؟',
        icon: '✅',
        required: true,
        options: [
          { value: 'نعم', label: 'نعم' },
          { value: 'جزئي', label: 'جزئي' },
          { value: 'لا', label: 'لا' },
        ],
      },
      {
        id: 'readyContentFiles',
        type: 'file',
        label: 'رفع المحتوى الجاهز',
        outputKey: 'رفع المحتوى الجاهز',
        icon: '📁',
        multiple: true,
        showIf: { field: 'contentReady', equals: ['نعم', 'جزئي'] },
      },
      {
        id: 'wantContentWriting',
        type: 'yesno',
        label: 'هل تريد منا كتابة وصياغة المحتوى؟',
        outputKey: 'هل تريد منا كتابة وصياغة المحتوى؟',
        required: true,
      },
      {
        id: 'servicesProducts',
        type: 'textarea',
        label: 'الخدمات / المنتجات',
        outputKey: 'الخدمات / المنتجات',
        required: true,
        rows: 3,
      },
      {
        id: 'vision',
        type: 'textarea',
        label: 'الرؤية',
        outputKey: 'الرؤية',
        required: false,
        rows: 2,
      },
      {
        id: 'mission',
        type: 'textarea',
        label: 'الرسالة',
        outputKey: 'الرسالة',
        required: false,
        rows: 2,
      },
      {
        id: 'values',
        type: 'textarea',
        label: 'القيم',
        outputKey: 'القيم',
        required: false,
        rows: 2,
      },
      {
        id: 'whyChooseUs',
        type: 'textarea',
        label: 'لماذا يختاركم العميل؟',
        outputKey: 'لماذا يختاركم العميل؟',
        required: false,
        rows: 3,
      },
      {
        id: 'keyProjects',
        type: 'textarea',
        label: 'أهم المشاريع / سابقة الأعمال',
        outputKey: 'أهم المشاريع / سابقة الأعمال',
        required: false,
        rows: 3,
      },
      {
        id: 'keyProjectFiles',
        type: 'file',
        label: 'ملفات سابقة الأعمال',
        outputKey: 'ملفات سابقة الأعمال',
        multiple: true,
        required: false,
      },
      {
        id: 'clientsPartners',
        type: 'text',
        label: 'العملاء / الشركاء',
        outputKey: 'العملاء / الشركاء',
        required: false,
      },
      {
        id: 'clientLogoFiles',
        type: 'file',
        label: 'شعارات العملاء / الشركاء',
        outputKey: 'شعارات العملاء / الشركاء',
        multiple: true,
        required: false,
      },
      {
        id: 'certificatesFiles',
        type: 'file',
        label: 'الشهادات والاعتمادات',
        outputKey: 'الشهادات والاعتمادات',
        multiple: true,
        required: false,
      },
    ]),
    section('profile-files', '03', '🎨', 'الملفات وملاحظات التصميم', 'الشعار والهوية والصور والمراجع', [
      {
        id: 'logoFiles',
        type: 'file',
        label: 'الشعار',
        outputKey: 'الشعار',
        icon: '🖼️',
        multiple: true,
        required: true,
      },
      {
        id: 'brandIdentityFiles',
        type: 'file',
        label: 'الهوية البصرية',
        outputKey: 'الهوية البصرية',
        multiple: true,
        required: false,
      },
      {
        id: 'companyImages',
        type: 'file',
        label: 'صور الشركة / المشاريع / المنتجات',
        outputKey: 'صور الشركة / المشاريع / المنتجات',
        multiple: true,
        required: false,
      },
      {
        id: 'language',
        type: 'select',
        label: 'اللغة',
        outputKey: 'اللغة',
        required: true,
        options: [
          { value: 'عربي', label: 'عربي' },
          { value: 'English', label: 'English' },
          { value: 'الاثنين', label: 'الاثنين' },
        ],
      },
      {
        id: 'approxPages',
        type: 'text',
        label: 'عدد الصفحات التقريبي',
        outputKey: 'عدد الصفحات التقريبي',
        required: false,
        placeholder: 'مثال: 8',
      },
      {
        id: 'referenceUrls',
        type: 'url_list',
        label: 'روابط لتصاميم مرجعية',
        outputKey: 'روابط لتصاميم مرجعية',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'designNotes',
        type: 'textarea',
        label: 'ملاحظات التصميم',
        outputKey: 'ملاحظات التصميم',
        required: false,
        rows: 3,
      },
    ]),
  ]
);

const LOGO_DESIGN_FORM = form(
  ['بيانات العميل', 'بيانات البراند', 'تفضيلات الشعار'],
  [
    section('client', '01', '👤', 'بيانات العميل والسياق', 'معلومات التواصل والسياق العام للطلب', SHARED_CLIENT_FIELDS),
    section('brand', '02', '✨', 'بيانات البراند', 'معلومات البراند والجمهور', [
      {
        id: 'brandNameAr',
        type: 'text',
        label: 'اسم البراند بالعربي',
        outputKey: 'اسم البراند بالعربي',
        required: true,
      },
      {
        id: 'brandNameEn',
        type: 'text',
        label: 'اسم البراند بالإنجليزي',
        outputKey: 'اسم البراند بالإنجليزي',
        required: false,
      },
      {
        id: 'nameMeaning',
        type: 'textarea',
        label: 'معنى الاسم',
        outputKey: 'معنى الاسم',
        required: false,
        rows: 2,
      },
      {
        id: 'activityField',
        type: 'text',
        label: 'مجال النشاط',
        outputKey: 'مجال النشاط',
        required: true,
      },
      {
        id: 'brandOffers',
        type: 'textarea',
        label: 'ماذا يقدم البراند؟',
        outputKey: 'ماذا يقدم البراند؟',
        required: true,
        rows: 3,
      },
      {
        id: 'targetAudience',
        type: 'textarea',
        label: 'الجمهور المستهدف',
        outputKey: 'الجمهور المستهدف',
        required: true,
        rows: 3,
      },
      {
        id: 'slogan',
        type: 'text',
        label: 'Slogan',
        outputKey: 'Slogan',
        required: false,
      },
      {
        id: 'hasExistingLogo',
        type: 'yesno',
        label: 'هل يوجد شعار حالي؟',
        outputKey: 'هل يوجد شعار حالي؟',
        required: true,
      },
      {
        id: 'existingLogoFiles',
        type: 'file',
        label: 'رفع الشعار الحالي',
        outputKey: 'رفع الشعار الحالي',
        multiple: true,
        showIf: { field: 'hasExistingLogo', equals: 'yes' },
      },
      {
        id: 'newOrRefine',
        type: 'select',
        label: 'جديد أم تطوير الحالي؟',
        outputKey: 'جديد أم تطوير الحالي؟',
        showIf: { field: 'hasExistingLogo', equals: 'yes' },
        options: [
          { value: 'شعار جديد بالكامل', label: 'شعار جديد بالكامل' },
          { value: 'تطوير الشعار الحالي', label: 'تطوير الشعار الحالي' },
        ],
      },
    ]),
    section('logo-prefs', '03', '🖋️', 'تفضيلات تصميم الشعار', 'الأسلوب والمراجع', [
      {
        id: 'logoType',
        type: 'select',
        label: 'نوع الشعار المفضل',
        outputKey: 'نوع الشعار المفضل',
        required: true,
        options: [
          { value: 'كتابي', label: 'كتابي' },
          { value: 'رمزي', label: 'رمزي' },
          { value: 'أحرف', label: 'أحرف' },
          { value: 'مزيج', label: 'مزيج' },
          { value: 'اترك الاختيار للمصمم', label: 'اترك الاختيار للمصمم' },
        ],
      },
      {
        id: 'preferredColors',
        type: 'text',
        label: 'الألوان المفضلة',
        outputKey: 'الألوان المفضلة',
        required: false,
        placeholder: 'مثال: أزرق كحلي وذهبي',
      },
      {
        id: 'avoidColors',
        type: 'text',
        label: 'ألوان لا تريد استخدامها',
        outputKey: 'ألوان لا تريد استخدامها',
        required: false,
      },
      {
        id: 'competitors',
        type: 'textarea',
        label: 'المنافسون',
        outputKey: 'المنافسون',
        required: false,
        rows: 2,
      },
      {
        id: 'likedLogos',
        type: 'url_list',
        label: 'شعارات تعجبك',
        outputKey: 'شعارات تعجبك',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'likedLogoFiles',
        type: 'file',
        label: 'رفع أمثلة شعارات تعجبك',
        outputKey: 'رفع أمثلة شعارات تعجبك',
        multiple: true,
        required: false,
      },
      {
        id: 'dislikedStyles',
        type: 'textarea',
        label: 'أساليب لا تعجبك',
        outputKey: 'أساليب لا تعجبك',
        required: false,
        rows: 2,
      },
      {
        id: 'designNotes',
        type: 'textarea',
        label: 'ملاحظات التصميم',
        outputKey: 'ملاحظات التصميم',
        required: false,
        rows: 3,
      },
    ]),
  ]
);

const VISUAL_IDENTITY_FORM = form(
  ['بيانات العميل', 'بيانات البراند', 'أسلوب الهوية'],
  [
    section('client', '01', '👤', 'بيانات العميل والسياق', 'معلومات التواصل والسياق العام للطلب', SHARED_CLIENT_FIELDS),
    section('brand', '02', '✨', 'بيانات البراند', 'أساس الهوية البصرية', [
      {
        id: 'brandNameAr',
        type: 'text',
        label: 'اسم البراند بالعربي',
        outputKey: 'اسم البراند بالعربي',
        required: true,
      },
      {
        id: 'brandNameEn',
        type: 'text',
        label: 'اسم البراند بالإنجليزي',
        outputKey: 'اسم البراند بالإنجليزي',
        required: false,
      },
      {
        id: 'activityField',
        type: 'text',
        label: 'مجال النشاط',
        outputKey: 'مجال النشاط',
        required: true,
      },
      {
        id: 'brandOffers',
        type: 'textarea',
        label: 'ماذا يقدم البراند؟',
        outputKey: 'ماذا يقدم البراند؟',
        required: true,
        rows: 3,
      },
      {
        id: 'targetAudience',
        type: 'textarea',
        label: 'الجمهور المستهدف',
        outputKey: 'الجمهور المستهدف',
        required: true,
        rows: 3,
      },
      {
        id: 'logoFiles',
        type: 'file',
        label: 'الشعار المعتمد',
        outputKey: 'الشعار المعتمد',
        multiple: true,
        required: true,
      },
    ]),
    section('identity-style', '03', '🎨', 'أسلوب الهوية واستخداماتها', 'الألوان والأسلوب وقنوات الاستخدام', [
      {
        id: 'identityStyle',
        type: 'multichip',
        label: 'أسلوب الهوية',
        outputKey: 'أسلوب الهوية',
        required: true,
        options: [
          { value: 'فاخر', label: 'فاخر' },
          { value: 'عصري', label: 'عصري' },
          { value: 'بسيط', label: 'بسيط' },
          { value: 'رسمي', label: 'رسمي' },
          { value: 'شبابي', label: 'شبابي' },
          { value: 'تقني', label: 'تقني' },
          { value: 'مرح', label: 'مرح' },
        ],
      },
      {
        id: 'preferredColors',
        type: 'text',
        label: 'الألوان المفضلة',
        outputKey: 'الألوان المفضلة',
        required: false,
        placeholder: 'مثال: #0F172A وذهبي',
      },
      {
        id: 'avoidColors',
        type: 'text',
        label: 'ألوان لا تريد استخدامها',
        outputKey: 'ألوان لا تريد استخدامها',
        required: false,
      },
      {
        id: 'identityUses',
        type: 'multichip',
        label: 'استخدامات الهوية',
        outputKey: 'استخدامات الهوية',
        required: true,
        options: [
          { value: 'سوشيال', label: 'سوشيال' },
          { value: 'موقع', label: 'موقع' },
          { value: 'متجر', label: 'متجر' },
          { value: 'مطبوعات', label: 'مطبوعات' },
          { value: 'تغليف', label: 'تغليف' },
          { value: 'لوحات', label: 'لوحات' },
          { value: 'تطبيق', label: 'تطبيق' },
          { value: 'أخرى', label: 'أخرى' },
        ],
      },
      {
        id: 'likedReferences',
        type: 'url_list',
        label: 'مراجع بصرية تعجبك',
        outputKey: 'مراجع بصرية تعجبك',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'designNotes',
        type: 'textarea',
        label: 'ملاحظات التصميم',
        outputKey: 'ملاحظات التصميم',
        required: false,
        rows: 3,
      },
    ]),
  ]
);

const BUSINESS_CARDS_FORM = form(
  ['بيانات العميل', 'بيانات الكرت', 'الملفات والملاحظات'],
  [
    section('client', '01', '👤', 'بيانات العميل والسياق', 'معلومات التواصل والسياق العام للطلب', SHARED_CLIENT_FIELDS),
    section('card-data', '02', '💳', 'بيانات الكرت', 'المعلومات التي تظهر على كرت العمل', [
      {
        id: 'cardName',
        type: 'text',
        label: 'الاسم',
        outputKey: 'الاسم',
        required: true,
      },
      {
        id: 'jobTitle',
        type: 'text',
        label: 'المسمى الوظيفي',
        outputKey: 'المسمى الوظيفي',
        required: true,
      },
      {
        id: 'cardPhone',
        type: 'text',
        label: 'الهاتف',
        outputKey: 'الهاتف',
        required: true,
        placeholder: '+9665...',
      },
      {
        id: 'cardEmail',
        type: 'text',
        label: 'البريد',
        outputKey: 'البريد',
        required: true,
      },
      {
        id: 'cardWebsite',
        type: 'text',
        label: 'الموقع',
        outputKey: 'الموقع',
        required: false,
      },
      {
        id: 'cardAddress',
        type: 'textarea',
        label: 'العنوان',
        outputKey: 'العنوان',
        required: false,
        rows: 2,
      },
      {
        id: 'cardSocial',
        type: 'url_list',
        label: 'روابط السوشيال',
        outputKey: 'روابط السوشيال',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'qrCodeLink',
        type: 'text',
        label: 'رابط QR Code',
        outputKey: 'رابط QR Code',
        required: false,
        placeholder: 'https://...',
      },
    ]),
    section('card-files', '03', '📁', 'الهوية والملفات', 'رفع الهوية والصور والملاحظات', [
      {
        id: 'identityFiles',
        type: 'file',
        label: 'الهوية / الشعار',
        outputKey: 'الهوية / الشعار',
        multiple: true,
        required: true,
      },
      {
        id: 'images',
        type: 'file',
        label: 'الصور',
        outputKey: 'الصور',
        multiple: true,
        required: false,
      },
      {
        id: 'forPrint',
        type: 'yesno',
        label: 'هل التصميم للطباعة؟',
        outputKey: 'هل التصميم للطباعة؟',
        required: true,
      },
      {
        id: 'printSpecs',
        type: 'textarea',
        label: 'مواصفات المطبعة',
        outputKey: 'مواصفات المطبعة',
        required: false,
        rows: 2,
        showIf: { field: 'forPrint', equals: 'yes' },
      },
      {
        id: 'referenceUrls',
        type: 'url_list',
        label: 'أمثلة مرجعية',
        outputKey: 'أمثلة مرجعية',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'notes',
        type: 'textarea',
        label: 'ملاحظات',
        outputKey: 'ملاحظات',
        required: false,
        rows: 3,
      },
    ]),
  ]
);

const PRINT_DESIGN_FORM = form(
  ['بيانات العميل', 'نوع المطبوع', 'المحتوى والملفات'],
  [
    section('client', '01', '👤', 'بيانات العميل والسياق', 'معلومات التواصل والسياق العام للطلب', SHARED_CLIENT_FIELDS),
    section('print-type', '02', '🖨️', 'نوع التصميم والمقاس', 'حدد نوع المطبوع والمقاسات المطلوبة', [
      {
        id: 'designTypes',
        type: 'multichip',
        label: 'نوع التصميم',
        outputKey: 'نوع التصميم',
        required: true,
        options: [
          { value: 'Flyer', label: 'Flyer' },
          { value: 'Brochure', label: 'Brochure' },
          { value: 'Roll Up', label: 'Roll Up' },
          { value: 'Letterhead', label: 'Letterhead' },
          { value: 'Envelope', label: 'Envelope' },
          { value: 'Menu', label: 'Menu' },
          { value: 'Price List', label: 'Price List' },
          { value: 'Folder', label: 'Folder' },
          { value: 'Packaging', label: 'Packaging' },
          { value: 'أخرى', label: 'أخرى' },
        ],
      },
      {
        id: 'size',
        type: 'text',
        label: 'المقاس',
        outputKey: 'المقاس',
        required: true,
        placeholder: 'مثال: A4 / 85×55 مم / حسب طلب المطبعة',
      },
      {
        id: 'forPrint',
        type: 'yesno',
        label: 'هل التصميم للطباعة؟',
        outputKey: 'هل التصميم للطباعة؟',
        required: true,
      },
      {
        id: 'printSpecs',
        type: 'textarea',
        label: 'مواصفات المطبعة',
        outputKey: 'مواصفات المطبعة',
        required: false,
        rows: 3,
        showIf: { field: 'forPrint', equals: 'yes' },
      },
      {
        id: 'printSpecFiles',
        type: 'file',
        label: 'رفع مواصفات المطبعة',
        outputKey: 'رفع مواصفات المطبعة',
        multiple: true,
        required: false,
        showIf: { field: 'forPrint', equals: 'yes' },
      },
    ]),
    section('print-content', '03', '📝', 'المحتوى والملفات', 'النص والهوية والصور والمراجع', [
      {
        id: 'identityFiles',
        type: 'file',
        label: 'الهوية',
        outputKey: 'الهوية',
        multiple: true,
        required: true,
      },
      {
        id: 'requiredText',
        type: 'textarea',
        label: 'النص المطلوب',
        outputKey: 'النص المطلوب',
        required: true,
        rows: 4,
      },
      {
        id: 'images',
        type: 'file',
        label: 'الصور',
        outputKey: 'الصور',
        multiple: true,
        required: false,
      },
      {
        id: 'referenceUrls',
        type: 'url_list',
        label: 'أمثلة مرجعية',
        outputKey: 'أمثلة مرجعية',
        placeholder: 'https://...',
        required: false,
      },
      {
        id: 'referenceFiles',
        type: 'file',
        label: 'رفع أمثلة مرجعية',
        outputKey: 'رفع أمثلة مرجعية',
        multiple: true,
        required: false,
      },
      {
        id: 'notes',
        type: 'textarea',
        label: 'ملاحظات',
        outputKey: 'ملاحظات',
        required: false,
        rows: 3,
      },
    ]),
  ]
);

export type BrandingServiceDef = {
  id: string;
  slug: string;
  title: string;
  category: string;
  categoryName: string;
  badge: string;
  delivery: string;
  rating: number;
  reviewsCount: number;
  image: string;
  priceSAR: number;
  oldPriceSAR: number;
  shortDesc: string;
  deliverables: string[];
  sortOrder: number;
  active: boolean;
  packages: Array<{
    id: string;
    name: string;
    priceSAR: number;
    description: string;
    sortOrder: number;
    active: boolean;
  }>;
  form: object;
};

export const BRANDING_SERVICES: BrandingServiceDef[] = [
  {
    id: 'company-profile',
    slug: 'company-profile',
    title: 'تصميم بروفايل الشركة',
    category: 'branding',
    categoryName: 'الهوية البصرية',
    badge: '📁 بروفايل احترافي',
    delivery: '⚡ تسليم حسب الباقة',
    rating: 5,
    reviewsCount: 0,
    image: BRANDING_IMAGE,
    priceSAR: PRICE,
    oldPriceSAR: PRICE,
    shortDesc: 'تصميم بروفايل شركة احترافي يعرض خدماتك ومشاريعك وهويتك بأسلوب مقنع.',
    deliverables: ['تصميم صفحات البروفايل', 'تسليم ملفات جاهزة للعرض والطباعة', 'تعديلات حتى الاعتماد'],
    sortOrder: 10,
    active: true,
    packages: [
      {
        id: 'company_profile_basic',
        name: 'باقة بروفايل الشركة',
        priceSAR: PRICE,
        description: 'تصميم بروفايل شركة أساسي قابل للتعديل من لوحة التحكم',
        sortOrder: 1,
        active: true,
      },
    ],
    form: COMPANY_PROFILE_FORM,
  },
  {
    id: 'logo-design',
    slug: 'logo-design',
    title: 'تصميم الشعار',
    category: 'branding',
    categoryName: 'الهوية البصرية',
    badge: '🖋️ شعار مميز',
    delivery: '⚡ تسليم حسب الباقة',
    rating: 5,
    reviewsCount: 0,
    image: BRANDING_IMAGE,
    priceSAR: PRICE,
    oldPriceSAR: PRICE,
    shortDesc: 'تصميم شعار احترافي يعكس شخصية البراند ويميزه عن المنافسين.',
    deliverables: ['مقترحات شعار', 'تسليم ملفات المصدر والصيغ النهائية', 'تعديلات حتى الاعتماد'],
    sortOrder: 11,
    active: true,
    packages: [
      {
        id: 'logo_design_basic',
        name: 'باقة تصميم الشعار',
        priceSAR: PRICE,
        description: 'تصميم شعار أساسي قابل للتعديل من لوحة التحكم',
        sortOrder: 1,
        active: true,
      },
    ],
    form: LOGO_DESIGN_FORM,
  },
  {
    id: 'visual-identity',
    slug: 'visual-identity',
    title: 'تصميم الهوية البصرية',
    category: 'branding',
    categoryName: 'الهوية البصرية',
    badge: '🎨 هوية متكاملة',
    delivery: '⚡ تسليم حسب الباقة',
    rating: 5,
    reviewsCount: 0,
    image: BRANDING_IMAGE,
    priceSAR: PRICE,
    oldPriceSAR: PRICE,
    shortDesc: 'بناء هوية بصرية متناسقة للألوان والأسلوب وقنوات الاستخدام.',
    deliverables: ['دليل ألوان وأسلوب بصري', 'تطبيقات الهوية الأساسية', 'تعديلات حتى الاعتماد'],
    sortOrder: 12,
    active: true,
    packages: [
      {
        id: 'visual_identity_basic',
        name: 'باقة الهوية البصرية',
        priceSAR: PRICE,
        description: 'تصميم هوية بصرية أساسي قابل للتعديل من لوحة التحكم',
        sortOrder: 1,
        active: true,
      },
    ],
    form: VISUAL_IDENTITY_FORM,
  },
  {
    id: 'business-cards',
    slug: 'business-cards',
    title: 'تصميم الكروت',
    category: 'branding',
    categoryName: 'الهوية البصرية',
    badge: '💳 كروت أعمال',
    delivery: '⚡ تسليم حسب الباقة',
    rating: 5,
    reviewsCount: 0,
    image: BRANDING_IMAGE,
    priceSAR: PRICE,
    oldPriceSAR: PRICE,
    shortDesc: 'تصميم كروت أعمال أنيقة ومتوافقة مع هوية البراند.',
    deliverables: ['وجه وظهر للكرت', 'ملفات جاهزة للطباعة', 'تعديلات حتى الاعتماد'],
    sortOrder: 13,
    active: true,
    packages: [
      {
        id: 'business_cards_basic',
        name: 'باقة تصميم الكروت',
        priceSAR: PRICE,
        description: 'تصميم كرت أعمال أساسي قابل للتعديل من لوحة التحكم',
        sortOrder: 1,
        active: true,
      },
    ],
    form: BUSINESS_CARDS_FORM,
  },
  {
    id: 'print-design',
    slug: 'print-design',
    title: 'تصميم المطبوعات',
    category: 'branding',
    categoryName: 'الهوية البصرية',
    badge: '🖨️ مطبوعات',
    delivery: '⚡ تسليم حسب الباقة',
    rating: 5,
    reviewsCount: 0,
    image: BRANDING_IMAGE,
    priceSAR: PRICE,
    oldPriceSAR: PRICE,
    shortDesc: 'تصميم مطبوعات تسويقية ومواد مطبوعة حسب نوع المنتج والمقاس.',
    deliverables: ['تصميم المطبوع حسب النوع', 'ملفات جاهزة للطباعة', 'تعديلات حتى الاعتماد'],
    sortOrder: 14,
    active: true,
    packages: [
      {
        id: 'print_design_basic',
        name: 'باقة تصميم المطبوعات',
        priceSAR: PRICE,
        description: 'تصميم مطبوعات أساسي قابل للتعديل من لوحة التحكم',
        sortOrder: 1,
        active: true,
      },
    ],
    form: PRINT_DESIGN_FORM,
  },
];
