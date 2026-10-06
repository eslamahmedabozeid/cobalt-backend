"use strict";
/**
 * Server-side FormDefinition v2 questionnaire validation.
 * Mirrors storefront rules in src/lib/form-schema.ts — do not trust client validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
function validateFieldType(field, value) {
    if (value === undefined || value === null)
        return null;
    switch (field.type) {
        case 'yesno':
            if (value !== 'yes' && value !== 'no') {
                return `Invalid yesno for ${field.id}`;
            }
            break;
        case 'select': {
            if (!field.options?.length)
                break;
            const allowed = new Set(field.options.map((o) => o.value));
            if (!allowed.has(String(value))) {
                return `Invalid select value for ${field.id}`;
            }
            break;
        }
        case 'multichip': {
            if (!Array.isArray(value))
                return `Expected array for ${field.id}`;
            if (field.options?.length) {
                const allowed = new Set(field.options.map((o) => o.value));
                for (const v of value) {
                    if (!allowed.has(String(v)))
                        return `Invalid multichip value for ${field.id}`;
                }
            }
            break;
        }
        case 'url_list':
            if (!Array.isArray(value))
                return `Expected array for ${field.id}`;
            break;
        case 'file':
            if (!Array.isArray(value))
                return `Expected array for ${field.id}`;
            for (const item of value) {
                // Allow legacy filename strings during transition; prefer uploaded refs
                if (typeof item === 'string')
                    continue;
                if (!isUploadedFileRef(item)) {
                    return `Invalid uploaded file for ${field.id}`;
                }
            }
            break;
        case 'text':
        case 'textarea':
            if (typeof value !== 'string' && typeof value !== 'number') {
                return `Expected string for ${field.id}`;
            }
            break;
        default:
            break;
    }
    return null;
}
function validateQuestionnaireAnswers(schemaJson, answers) {
    if (!isFormDefinitionV2(schemaJson)) {
        // No v2 schema → nothing to enforce beyond presence of an object
        return { valid: true };
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return { valid: false, message: 'Questionnaire answers required' };
    }
    const values = answers;
    for (const section of schemaJson.sections) {
        for (const field of section.fields) {
            if (!isFieldVisible(field, values))
                continue;
            const typeErr = validateFieldType(field, values[field.id]);
            if (typeErr)
                return { valid: false, message: typeErr };
            if (field.required && isEmpty(field, values[field.id])) {
                return {
                    valid: false,
                    message: `Missing required field: ${field.label} (${field.id})`,
                };
            }
        }
    }
    return { valid: true };
}
