export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  { key: 'dashboard', label: 'لوحة التحكم', group: 'نظرة عامة' },
  { key: 'orders', label: 'الطلبات', group: 'المتجر والكتالوج' },
  { key: 'services', label: 'الخدمات', group: 'المتجر والكتالوج' },
  { key: 'categories', label: 'التصنيفات', group: 'المتجر والكتالوج' },
  { key: 'bundles', label: 'الباقات', group: 'المتجر والكتالوج' },
  { key: 'coupons', label: 'الكوبونات', group: 'المتجر والكتالوج' },
  { key: 'calculator', label: 'حاسبة الأسعار', group: 'المتجر والكتالوج' },
  { key: 'homepage', label: 'أقسام الرئيسية', group: 'المحتوى والتسويق' },
  { key: 'hero-slides', label: 'سلايدر الرئيسية', group: 'المحتوى والتسويق' },
  { key: 'portfolio', label: 'معرض الأعمال', group: 'المحتوى والتسويق' },
  { key: 'testimonials', label: 'آراء العملاء', group: 'المحتوى والتسويق' },
  { key: 'faqs', label: 'الأسئلة الشائعة', group: 'المحتوى والتسويق' },
  { key: 'media', label: 'مكتبة الوسائط', group: 'المحتوى والتسويق' },
  { key: 'navigation', label: 'قائمة التنقل', group: 'النظام والتهيئة' },
  { key: 'footer-links', label: 'روابط الفوتر', group: 'النظام والتهيئة' },
  { key: 'top-bar', label: 'الشريط العلوي', group: 'النظام والتهيئة' },
  { key: 'currencies', label: 'العملات', group: 'النظام والتهيئة' },
  { key: 'settings', label: 'إعدادات الموقع', group: 'النظام والتهيئة' },
  { key: 'users', label: 'المستخدمون', group: 'المستخدمون والصلاحيات' },
  { key: 'roles', label: 'الأدوار والصلاحيات', group: 'المستخدمون والصلاحيات' },
] as const;

export type ResourceKey = (typeof RESOURCES)[number]['key'];

export type PermissionMap = '*' | Record<string, Action[] | '*'>;

export const SUPER_ADMIN_SLUG = 'super-admin';
export const SUPER_ADMIN_ROLE_ID = 'role-super-admin';
export const EDITOR_ROLE_ID = 'role-editor';
export const VIEWER_ROLE_ID = 'role-viewer';

export function allActions(): Action[] {
  return [...ACTIONS];
}

export function resourceKeys(): ResourceKey[] {
  return RESOURCES.map((r) => r.key);
}

export function editorPermissions(): Record<string, Action[]> {
  const map: Record<string, Action[]> = {};
  for (const r of RESOURCES) {
    if (r.key === 'users' || r.key === 'roles') continue;
    map[r.key] = allActions();
  }
  return map;
}

export function viewerPermissions(): Record<string, Action[]> {
  const map: Record<string, Action[]> = {};
  for (const r of RESOURCES) {
    if (r.key === 'users' || r.key === 'roles') continue;
    map[r.key] = ['read'];
  }
  return map;
}

export function parsePermissions(raw: string): PermissionMap {
  if (raw === '*') return '*';
  try {
    const value = JSON.parse(raw);
    if (value === '*') return '*';
    if (value && typeof value === 'object') return value as PermissionMap;
    return {};
  } catch {
    return {};
  }
}

export function hasPermission(
  map: PermissionMap,
  resource: string,
  action: Action,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true;
  // Legacy/system full-access marker. Custom roles must never persist this (see sanitizePermissions).
  if (map === '*') return true;
  const allowed = map[resource];
  if (allowed === '*') return true;
  return Array.isArray(allowed) && allowed.includes(action);
}

/** Expand full access into an explicit map. Never persist "*" from API input. */
export function fullPermissionsMap(includePrivileged = true): Record<string, Action[]> {
  const map: Record<string, Action[]> = {};
  for (const key of resourceKeys()) {
    if (!includePrivileged && (key === 'users' || key === 'roles')) continue;
    map[key] = allActions();
  }
  return map;
}

export function sanitizePermissions(input: unknown): string {
  // Wildcard via API must not become role.permissions="*" (escalation).
  // Expand without users/roles so those require explicit checkboxes.
  if (input === '*' || input === 'all') {
    return JSON.stringify(fullPermissionsMap(false));
  }
  if (!input || typeof input !== 'object') return JSON.stringify({});
  const allowed = new Set(resourceKeys());
  const out: Record<string, Action[]> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.has(key as ResourceKey)) continue;
    if (value === '*') {
      out[key] = allActions();
      continue;
    }
    if (!Array.isArray(value)) continue;
    out[key] = ACTIONS.filter((a) => value.includes(a));
  }
  return JSON.stringify(out);
}

export const RESERVED_ROLE_SLUGS = new Set([SUPER_ADMIN_SLUG, 'editor', 'viewer']);
