"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVED_ROLE_SLUGS = exports.VIEWER_ROLE_ID = exports.EDITOR_ROLE_ID = exports.SUPER_ADMIN_ROLE_ID = exports.SUPER_ADMIN_SLUG = exports.RESOURCES = exports.ACTIONS = void 0;
exports.allActions = allActions;
exports.resourceKeys = resourceKeys;
exports.editorPermissions = editorPermissions;
exports.viewerPermissions = viewerPermissions;
exports.parsePermissions = parsePermissions;
exports.hasPermission = hasPermission;
exports.fullPermissionsMap = fullPermissionsMap;
exports.sanitizePermissions = sanitizePermissions;
exports.ACTIONS = ['read', 'create', 'update', 'delete'];
exports.RESOURCES = [
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
];
exports.SUPER_ADMIN_SLUG = 'super-admin';
exports.SUPER_ADMIN_ROLE_ID = 'role-super-admin';
exports.EDITOR_ROLE_ID = 'role-editor';
exports.VIEWER_ROLE_ID = 'role-viewer';
function allActions() {
    return [...exports.ACTIONS];
}
function resourceKeys() {
    return exports.RESOURCES.map((r) => r.key);
}
function editorPermissions() {
    const map = {};
    for (const r of exports.RESOURCES) {
        if (r.key === 'users' || r.key === 'roles')
            continue;
        map[r.key] = allActions();
    }
    return map;
}
function viewerPermissions() {
    const map = {};
    for (const r of exports.RESOURCES) {
        if (r.key === 'users' || r.key === 'roles')
            continue;
        map[r.key] = ['read'];
    }
    return map;
}
function parsePermissions(raw) {
    if (raw === '*')
        return '*';
    try {
        const value = JSON.parse(raw);
        if (value === '*')
            return '*';
        if (value && typeof value === 'object')
            return value;
        return {};
    }
    catch {
        return {};
    }
}
function hasPermission(map, resource, action, isSuperAdmin = false) {
    if (isSuperAdmin)
        return true;
    // Legacy/system full-access marker. Custom roles must never persist this (see sanitizePermissions).
    if (map === '*')
        return true;
    const allowed = map[resource];
    if (allowed === '*')
        return true;
    return Array.isArray(allowed) && allowed.includes(action);
}
/** Expand full access into an explicit map. Never persist "*" from API input. */
function fullPermissionsMap(includePrivileged = true) {
    const map = {};
    for (const key of resourceKeys()) {
        if (!includePrivileged && (key === 'users' || key === 'roles'))
            continue;
        map[key] = allActions();
    }
    return map;
}
function sanitizePermissions(input) {
    // Wildcard via API must not become role.permissions="*" (escalation).
    // Expand without users/roles so those require explicit checkboxes.
    if (input === '*' || input === 'all') {
        return JSON.stringify(fullPermissionsMap(false));
    }
    if (!input || typeof input !== 'object')
        return JSON.stringify({});
    const allowed = new Set(resourceKeys());
    const out = {};
    for (const [key, value] of Object.entries(input)) {
        if (!allowed.has(key))
            continue;
        if (value === '*') {
            out[key] = allActions();
            continue;
        }
        if (!Array.isArray(value))
            continue;
        out[key] = exports.ACTIONS.filter((a) => value.includes(a));
    }
    return JSON.stringify(out);
}
exports.RESERVED_ROLE_SLUGS = new Set([exports.SUPER_ADMIN_SLUG, 'editor', 'viewer']);
