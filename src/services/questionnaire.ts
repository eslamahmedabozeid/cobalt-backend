/**
 * Server-side FormDefinition v2 questionnaire validation.
 * Mirrors storefront rules in frontend/src/lib/form-schema.ts — do not trust client validation.
 */

import {
  getActiveContentPreparation,
  getContentFlowKind,
  WRITE_PATH_REQUIRED_BRIEF_IDS,
} from './companyProfilePricing';

export type UploadedFileRef = {
  id: string;
  name: string;
  url?: string;
  size?: number;
  mimeType?: string;
};

export type FormValues = Record<
  string,
  string | string[] | 'yes' | 'no' | UploadedFileRef[]
>;

type FormFieldDef = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  showIf?: { field: string; equals: string | string[] };
};

function isUploadedFileRef(value: unknown): value is UploadedFileRef {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as UploadedFileRef).id === 'string' &&
    !!(value as UploadedFileRef).id
  );
}

type FormDefinition = {
  version: number;
  sections: Array<{ fields: FormFieldDef[] }>;
};

function isFormDefinitionV2(value: unknown): value is FormDefinition {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as FormDefinition).version === 2 &&
    Array.isArray((value as FormDefinition).sections)
  );
}

function resolveShowIfCurrent(fieldName: string, values: FormValues): string {
  if (fieldName === 'content_preparation') {
    return getActiveContentPreparation(values as Record<string, unknown>);
  }
  return String(values[fieldName] ?? '');
}

function isFieldVisible(field: FormFieldDef, values: FormValues): boolean {
  if (!field.showIf) return true;
  const current = resolveShowIfCurrent(field.showIf.field, values);
  const equals = field.showIf.equals;
  if (Array.isArray(equals)) return equals.includes(current);
  return current === String(equals);
}

function isEmpty(field: FormFieldDef, value: FormValues[string] | undefined): boolean {
  if (field.type === 'file') {
    return !Array.isArray(value) || value.filter(isUploadedFileRef).length === 0;
  }
  if (field.type === 'multichip') {
    return !Array.isArray(value) || value.length === 0;
  }
  if (field.type === 'url_list') {
    return !Array.isArray(value) || value.filter((v) => String(v ?? '').trim()).length === 0;
  }
  if (field.type === 'yesno' || field.type === 'checkbox') {
    return value !== 'yes' && value !== 'no';
  }
  if (field.type === 'radio') return !String(value ?? '').trim();
  return !String(value ?? '').trim();
}

/** Strip zero-width / control chars that look "filled" but are not real content. */
export function sanitizeTextInput(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    .trim();
}

/** At least one Unicode letter or digit (Arabic + Latin + other scripts). */
export function isMeaningfulText(raw: string): boolean {
  const s = sanitizeTextInput(raw);
  if (!s) return false;
  return /[\p{L}\p{N}]/u.test(s);
}

type TextInputKind = 'email' | 'phone' | 'url' | 'numeric' | 'text';

function classifyTextField(field: FormFieldDef): TextInputKind {
  if (field.type === 'textarea') return 'text';
  // Use id + label only — placeholders often mention unrelated examples (e.g. "بريد").
  const hay = `${field.id} ${field.label}`.toLowerCase();
  if (/(^|[\s_-])(email|e-mail)($|[\s_-])|بريد إلكتروني|ايميل|إيميل/.test(hay)) {
    return 'email';
  }
  if (/phone|mobile|whatsapp|\btel\b|جوال|هاتف|موبايل|واتس/.test(hay)) return 'phone';
  if (
    field.id === 'website_url' ||
    /(^|[\s_-])(url|website|web_?site)($|[\s_-])|رابط الموقع|موقع إلكتروني/.test(hay)
  ) {
    return 'url';
  }
  if (/(^|[\s_-])(qty|quantity|amount|count|number|numeric)($|[\s_-])/i.test(hay)) {
    return 'numeric';
  }
  return 'text';
}

function normalizeDigits(value: string): string {
  return sanitizeTextInput(value)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

function isValidEmail(value: string): boolean {
  const s = sanitizeTextInput(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidPhone(value: string): boolean {
  const s = normalizeDigits(value);
  if (!/^[\d+\s().-]{8,}$/.test(s)) return false;
  return s.replace(/\D/g, '').length >= 8;
}

function isValidHttpUrl(value: string): boolean {
  const s = sanitizeTextInput(value);
  if (!s) return false;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    if (!(u.protocol === 'http:' || u.protocol === 'https:')) return false;
    // Reject bare words like "not-a-url" that URL() still accepts as hostnames.
    return /\./.test(u.hostname) && u.hostname.length > 2;
  } catch {
    return false;
  }
}

function isValidNumeric(value: string): boolean {
  return /^\d+([.,]\d+)?$/.test(normalizeDigits(value));
}

const MSG = {
  required: 'هذا الحقل مطلوب',
  meaningful: 'يرجى إدخال نص ذي معنى يحتوي على حرف أو رقم على الأقل',
  email: 'يرجى إدخال بريد إلكتروني صحيح',
  phone: 'يرجى إدخال رقم جوال صحيح',
  contact: 'يرجى إدخال رقم جوال أو بريد إلكتروني صحيح',
  url: 'يرجى إدخال رابط صحيح',
  numeric: 'يرجى إدخال رقم صحيح',
} as const;

function isContactDetailsField(field: FormFieldDef): boolean {
  return (
    field.id === 'contact_details' ||
    /بيانات التواصل|طريقة التواصل المختارة/.test(field.label || '')
  );
}

function isValidPhoneOrEmail(value: string): boolean {
  const s = sanitizeTextInput(value);
  return isValidEmail(s) || isValidPhone(s);
}

function validateTextLikeValue(field: FormFieldDef, raw: string): string | null {
  const kind = classifyTextField(field);
  const cleaned = sanitizeTextInput(raw);
  if (!cleaned) return null;

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

function validateFieldType(field: FormFieldDef, value: FormValues[string] | undefined): string | null {
  if (value === undefined || value === null) return null;
  switch (field.type) {
    case 'yesno':
      if (value !== 'yes' && value !== 'no') {
        return `قيمة غير صالحة للحقل: ${field.label}`;
      }
      break;
    case 'select':
    case 'radio': {
      if (!field.options?.length) break;
      const allowed = new Set(field.options.map((o) => o.value));
      if (!allowed.has(String(value))) {
        return `قيمة غير صالحة للحقل: ${field.label}`;
      }
      break;
    }
    case 'checkbox':
      if (value !== 'yes' && value !== 'no') {
        return `قيمة غير صالحة للحقل: ${field.label}`;
      }
      break;
    case 'multichip': {
      if (!Array.isArray(value)) return `قيمة غير صالحة للحقل: ${field.label}`;
      if (field.options?.length) {
        const allowed = new Set(field.options.map((o) => o.value));
        for (const v of value) {
          if (!allowed.has(String(v))) return `قيمة غير صالحة للحقل: ${field.label}`;
        }
      }
      break;
    }
    case 'url_list':
      if (!Array.isArray(value)) return `قيمة غير صالحة للحقل: ${field.label}`;
      break;
    case 'file':
      if (!Array.isArray(value)) return `قيمة غير صالحة للحقل: ${field.label}`;
      for (const item of value) {
        if (typeof item === 'string') continue;
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

function validateVisibleField(
  field: FormFieldDef,
  value: FormValues[string] | undefined,
  values: FormValues
): string | null {
  const typeErr = validateFieldType(field, value);
  if (typeErr) return typeErr;

  const empty = isEmpty(field, value);
  const contentFlow = getContentFlowKind(values as Record<string, unknown>);

  if (field.id === 'website_url') {
    const later = String(values.website_link_later || '') === 'yes';
    if (empty) return later ? null : `${MSG.required}: ${field.label}`;
    return isValidHttpUrl(String(value ?? '')) ? null : `${MSG.url}: ${field.label}`;
  }
  if (field.id === 'social_media_urls') {
    const later = String(values.social_links_later || '') === 'yes';
    if (empty) return later ? null : `${MSG.required}: ${field.label}`;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const s = String(entry ?? '').trim();
        if (!s) continue;
        if (!isValidHttpUrl(s)) return `${MSG.url}: ${field.label}`;
      }
    }
    return null;
  }

  if (field.id === 'final_copy_file') {
    if (contentFlow === 'ready' || contentFlow === 'rewrite') {
      const later = String(values.content_file_later || '') === 'yes';
      if (empty) return later ? null : `${MSG.required}: ${field.label}`;
      return null;
    }
    return null;
  }
  if (field.id === 'content_file_later') {
    return null;
  }

  if (isContactDetailsField(field)) {
    if (empty) return field.required ? `${MSG.required}: ${field.label}` : null;
    return isValidPhoneOrEmail(String(value ?? ''))
      ? null
      : `${MSG.contact}: ${field.label}`;
  }

  const writeRequired = (WRITE_PATH_REQUIRED_BRIEF_IDS as readonly string[]).includes(
    field.id
  );
  if (contentFlow === 'write' && writeRequired && empty) {
    return `${MSG.required}: ${field.label}`;
  }
  if (
    (contentFlow === 'ready' || contentFlow === 'rewrite') &&
    (WRITE_PATH_REQUIRED_BRIEF_IDS as readonly string[]).includes(field.id)
  ) {
    if (empty) return null;
  }

  if (empty) {
    return field.required ? `${MSG.required}: ${field.label}` : null;
  }

  if (field.type === 'text' || field.type === 'textarea') {
    const err = validateTextLikeValue(field, String(value ?? ''));
    return err ? `${err}: ${field.label}` : null;
  }

  if ((field.type === 'radio' || field.type === 'select') && field.options?.length) {
    const allowed = new Set(field.options.map((o) => o.value));
    if (!allowed.has(String(value))) {
      return `${MSG.required}: ${field.label}`;
    }
  }

  if (field.type === 'url_list' && Array.isArray(value)) {
    for (const entry of value) {
      const s = String(entry ?? '').trim();
      if (!s) continue;
      if (!isValidHttpUrl(s)) return `${MSG.url}: ${field.label}`;
    }
  }

  return null;
}

export function validateQuestionnaireAnswers(
  schemaJson: unknown,
  answers: unknown
): { valid: true } | { valid: false; message: string; fieldId?: string } {
  if (!isFormDefinitionV2(schemaJson)) {
    // No v2 schema → nothing to enforce beyond presence of an object
    return { valid: true };
  }

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { valid: false, message: 'إجابات الاستبيان مطلوبة' };
  }

  const values = answers as FormValues;

  for (const section of schemaJson.sections) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, values)) continue;

      const err = validateVisibleField(field, values[field.id], values);
      if (err) {
        return { valid: false, message: err, fieldId: field.id };
      }
    }
  }

  return { valid: true };
}
