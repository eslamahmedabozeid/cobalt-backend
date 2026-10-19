"use strict";
/**
 * Server-side FormDefinition v2 questionnaire validation.
 * Mirrors storefront rules in frontend/src/lib/form-schema.ts — do not trust client validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeTextInput = sanitizeTextInput;
exports.isMeaningfulText = isMeaningfulText;
exports.validateQuestionnaireAnswers = validateQuestionnaireAnswers;
function isUploadedFileRef(value) {
    return (!!value &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        !!value.id);
}
function isFormDefinitionV2(value) {
    return (!!value &&
        typeof value === 'object' &&
        value.version === 2 &&
        Array.isArray(value.sections));
}
function isFieldVisible(field, values) {
    if (!field.showIf)
        return true;
    const current = values[field.showIf.field];
    const equals = field.showIf.equals;
    if (Array.isArray(equals))
        return equals.includes(String(current));
    return String(current) === String(equals);
}
function isEmpty(field, value) {
    if (field.type === 'file') {
        return !Array.isArray(value) || value.filter(isUploadedFileRef).length === 0;
    }
    if (field.type === 'multichip') {
        return !Array.isArray(value) || value.length === 0;
    }
    if (field.type === 'url_list') {
        return !Array.isArray(value) || value.filter(Boolean).length === 0;
    }
    if (field.type === 'yesno')
        return value !== 'yes' && value !== 'no';
    return !String(value ?? '').trim();
}
/** Strip zero-width / control chars that look "filled" but are not real content. */
function sanitizeTextInput(raw) {
    return String(raw ?? '')
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
        .trim();
}
/** At least one Unicode letter or digit (Arabic + Latin + other scripts). */
function isMeaningfulText(raw) {
    const s = sanitizeTextInput(raw);
    if (!s)
        return false;
    return /[\p{L}\p{N}]/u.test(s);
}
function classifyTextField(field) {
    if (field.type === 'textarea')
        return 'text';
    const hay = `${field.id} ${field.label} ${field.placeholder || ''}`.toLowerCase();
    if (/email|e-mail|بريد|ايميل|إيميل/.test(hay))
        return 'email';
    if (/phone|mobile|whatsapp|\btel\b|جوال|هاتف|موبايل|واتس/.test(hay))
        return 'phone';
    if (/(^|[\s_-])url($|[\s_-])|website|web_?site|رابط|موقع/.test(hay))
        return 'url';
    if (/(^|[\s_-])(qty|quantity|amount|count|number|numeric)($|[\s_-])/i.test(hay)) {
        return 'numeric';
    }
    return 'text';
}
function normalizeDigits(value) {
    return sanitizeTextInput(value)
        .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}
function isValidEmail(value) {
    const s = sanitizeTextInput(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function isValidPhone(value) {
    const s = normalizeDigits(value);
    if (!/^[\d+\s().-]{8,}$/.test(s))
        return false;
    return s.replace(/\D/g, '').length >= 8;
}
function isValidHttpUrl(value) {
    const s = sanitizeTextInput(value);
    if (!s)
        return false;
    try {
        const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
        const u = new URL(withProto);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function isValidNumeric(value) {
    return /^\d+([.,]\d+)?$/.test(normalizeDigits(value));
}
const MSG = {
    required: 'هذا الحقل مطلوب',
    meaningful: 'يرجى إدخال نص ذي معنى يحتوي على حرف أو رقم على الأقل',
    email: 'يرجى إدخال بريد إلكتروني صحيح',
    phone: 'يرجى إدخال رقم جوال صحيح',
    url: 'يرجى إدخال رابط صحيح',
    numeric: 'يرجى إدخال رقم صحيح',
};
function validateTextLikeValue(field, raw) {
    const kind = classifyTextField(field);
    const cleaned = sanitizeTextInput(raw);
    if (!cleaned)
        return null;
    switch (kind) {
        case 'email':
            return isValidEmail(cleaned) ? null : MSG.email;
        case 'phone':
            return isValidPhone(cleaned) ? null : MSG.phone;
        case 'url':
            return isValidHttpUrl(cleaned) ? null : MSG.url;
        case 'numeric':
            return isValidNumeric(cleaned) ? null : MSG.numeric;
        default:
            return isMeaningfulText(cleaned) ? null : MSG.meaningful;
    }
}
function validateFieldType(field, value) {
    if (value === undefined || value === null)
        return null;
    switch (field.type) {
        case 'yesno':
            if (value !== 'yes' && value !== 'no') {
                return `قيمة غير صالحة للحقل: ${field.label}`;
            }
            break;
        case 'select': {
            if (!field.options?.length)
                break;
            const allowed = new Set(field.options.map((o) => o.value));
            if (!allowed.has(String(value))) {
                return `قيمة غير صالحة للحقل: ${field.label}`;
            }
            break;
        }
        case 'multichip': {
            if (!Array.isArray(value))
                return `قيمة غير صالحة للحقل: ${field.label}`;
            if (field.options?.length) {
                const allowed = new Set(field.options.map((o) => o.value));
                for (const v of value) {
                    if (!allowed.has(String(v)))
                        return `قيمة غير صالحة للحقل: ${field.label}`;
                }
            }
            break;
        }
        case 'url_list':
            if (!Array.isArray(value))
                return `قيمة غير صالحة للحقل: ${field.label}`;
            break;
        case 'file':
            if (!Array.isArray(value))
                return `قيمة غير صالحة للحقل: ${field.label}`;
            for (const item of value) {
                if (typeof item === 'string')
                    continue;
                if (!isUploadedFileRef(item)) {
                    return `ملف غير صالح للحقل: ${field.label}`;
                }
            }
            break;
        case 'text':
        case 'textarea':
            if (typeof value !== 'string' && typeof value !== 'number') {
                return `قيمة غير صالحة للحقل: ${field.label}`;
            }
            break;
        default:
            break;
    }
    return null;
}
function validateVisibleField(field, value) {
    const typeErr = validateFieldType(field, value);
    if (typeErr)
        return typeErr;
    const empty = isEmpty(field, value);
    if (empty) {
        return field.required ? `${MSG.required}: ${field.label}` : null;
    }
    if (field.type === 'text' || field.type === 'textarea') {
        const err = validateTextLikeValue(field, String(value ?? ''));
        return err ? `${err}: ${field.label}` : null;
    }
    if (field.type === 'url_list' && Array.isArray(value)) {
        for (const entry of value) {
            const s = String(entry ?? '').trim();
            if (!s)
                continue;
            if (!isValidHttpUrl(s))
                return `${MSG.url}: ${field.label}`;
        }
    }
    return null;
}
function validateQuestionnaireAnswers(schemaJson, answers) {
    if (!isFormDefinitionV2(schemaJson)) {
        // No v2 schema → nothing to enforce beyond presence of an object
        return { valid: true };
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return { valid: false, message: 'إجابات الاستبيان مطلوبة' };
    }
    const values = answers;
    for (const section of schemaJson.sections) {
        for (const field of section.fields) {
            if (!isFieldVisible(field, values))
                continue;
            const err = validateVisibleField(field, values[field.id]);
            if (err) {
                return { valid: false, message: err, fieldId: field.id };
            }
        }
    }
    return { valid: true };
}
