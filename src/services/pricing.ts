import { prisma } from '../lib/prisma';
import {
  COMPANY_PROFILE_SERVICE_ID,
  computeCompanyProfileQuote,
  normalizeCompanyProfileAnswers,
  parsePricingConfig,
  type CompanyProfileQuote,
} from './companyProfilePricing';
import {
  BUSINESS_CARDS_SERVICE_ID,
  computeBusinessCardsQuote,
  normalizeBusinessCardsAnswers,
  type BusinessCardsQuote,
} from './businessCardsPricing';

export type LineType = 'service' | 'calculator' | 'bundle';

export interface OrderLineInput {
  serviceId?: string | null;
  packageId?: string | null;
  addonIds?: string[];
  bundleId?: string | null;
  quantity?: number;
  details?: Record<string, unknown>;
  /** Raw FormDefinition field-id → value map for server validation */
  answers?: Record<string, unknown>;
  calculator?: { speed?: 'normal' | 'express' | 'vip'; hasMultilingual?: boolean };
  // display / legacy
  serviceTitle?: string;
  selectedOption?: string;
  selectedAddons?: string[];
  unitPriceSAR?: number;
  notes?: string;
  image?: string;
  uploadedFiles?: string[];
}

export type PricedLine = {
  lineType: LineType;
  serviceId: string | null;
  packageId: string | null;
  bundleId: string | null;
  addonIds: string[];
  quantity: number;
  serverUnitPriceSAR: number;
  lineTotalSAR: number;
  calculator: { speed: 'normal' | 'express' | 'vip'; hasMultilingual: boolean } | null;
  serviceTitle: string;
  image: string;
  pricingBreakdown?: CompanyProfileQuote | BusinessCardsQuote | null;
  blockCheckout?: string;
};

/** Strip forged express keys and incompatible hidden content fields before pricing. */
function sanitizeCompanyProfileAnswers(raw: Record<string, unknown>): Record<string, unknown> {
  return normalizeCompanyProfileAnswers(raw);
}

function answersFromInput(input: OrderLineInput): Record<string, unknown> {
  let raw: Record<string, unknown> = {};
  if (input.answers && typeof input.answers === 'object') {
    raw = input.answers as Record<string, unknown>;
  } else {
    const details = input.details;
    if (details && typeof details === 'object') {
      const nested = details.__answers;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        raw = nested as Record<string, unknown>;
      }
    }
  }
  if (input.serviceId === COMPANY_PROFILE_SERVICE_ID) {
    return sanitizeCompanyProfileAnswers(raw);
  }
  if (input.serviceId === BUSINESS_CARDS_SERVICE_ID) {
    return normalizeBusinessCardsAnswers(raw);
  }
  return raw;
}

export async function priceServiceLine(input: OrderLineInput): Promise<PricedLine> {
  const qty = Math.max(1, input.quantity || 1);
  const serviceId = input.serviceId;
  if (!serviceId) throw new Error('serviceId required');

  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true },
    include: { packages: true, addons: true },
  });
  if (!service) throw new Error(`Service not found: ${serviceId}`);

  // Calculator line
  if (input.calculator || input.selectedOption === 'طلب مخصص من حاسبة الأسعار') {
    const calc = await prisma.calculatorConfig.findUnique({ where: { id: 'default' } });
    if (!calc) throw new Error('Calculator config missing');

    let speed: 'normal' | 'express' | 'vip' = input.calculator?.speed || 'normal';
    let hasMultilingual = !!input.calculator?.hasMultilingual;

    // Fallback parse from legacy selectedAddons labels if structured data missing
    if (!input.calculator) {
      const labels = input.selectedAddons || [];
      if (labels.some((l) => l.includes('VIP') || l.includes('+250'))) speed = 'vip';
      else if (labels.some((l) => l.includes('عاجل') || l.includes('+150'))) speed = 'express';
      if (labels.some((l) => l.includes('متعدد اللغات') || l.includes('+200'))) hasMultilingual = true;
    }

    let unit = service.priceSAR;
    if (speed === 'express') unit += calc.expressFeeSAR;
    if (speed === 'vip') unit += calc.vipFeeSAR;
    if (hasMultilingual) unit += calc.multilingualFeeSAR;

    return {
      lineType: 'calculator' as LineType,
      serviceId: service.id,
      packageId: null,
      bundleId: null,
      addonIds: [] as string[],
      quantity: qty,
      serverUnitPriceSAR: unit,
      lineTotalSAR: unit * qty,
      calculator: { speed, hasMultilingual },
      serviceTitle: service.title,
      image: service.image,
    };
  }

  // Company Profile — server-side dynamic quote (v1.1)
  if (service.id === COMPANY_PROFILE_SERVICE_ID) {
    let configRaw: unknown = undefined;
    if (service.pricingConfigJson) {
      try {
        configRaw = JSON.parse(service.pricingConfigJson);
      } catch {
        configRaw = undefined;
      }
    }
    const quote = computeCompanyProfileQuote(answersFromInput(input), configRaw);
    if (!quote.ok) throw new Error(quote.message);

    const packageId = input.packageId;
    let pkg = packageId
      ? service.packages.find((p) => p.id === packageId && p.active)
      : null;
    if (!pkg && input.selectedOption) {
      pkg = service.packages.find((p) => p.name === input.selectedOption && p.active) || null;
    }
    if (!pkg) {
      pkg = service.packages.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder)[0] || null;
    }
    if (!pkg) throw new Error(`No package for service ${serviceId}`);

    const unit = quote.pretaxTotalSAR;
    return {
      lineType: 'service' as LineType,
      serviceId: service.id,
      packageId: pkg.id,
      bundleId: null,
      addonIds: [],
      quantity: qty,
      serverUnitPriceSAR: unit,
      lineTotalSAR: unit * qty,
      calculator: null,
      serviceTitle: service.title,
      image: service.image,
      pricingBreakdown: quote,
      blockCheckout: quote.blockCheckout,
    };
  }

  // Business Cards — server-side dynamic quote (v1.0)
  if (service.id === BUSINESS_CARDS_SERVICE_ID) {
    let configRaw: unknown = undefined;
    if (service.pricingConfigJson) {
      try {
        configRaw = JSON.parse(service.pricingConfigJson);
      } catch {
        configRaw = undefined;
      }
    }
    const quote = computeBusinessCardsQuote(answersFromInput(input), configRaw);
    if (!quote.ok) throw new Error(quote.message);

    const packageId = input.packageId;
    let pkg = packageId
      ? service.packages.find((p) => p.id === packageId && p.active)
      : null;
    if (!pkg && input.selectedOption) {
      pkg = service.packages.find((p) => p.name === input.selectedOption && p.active) || null;
    }
    if (!pkg) {
      pkg = service.packages.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder)[0] || null;
    }
    if (!pkg) throw new Error(`No package for service ${serviceId}`);

    const unit = quote.pretaxTotalSAR;
    return {
      lineType: 'service' as LineType,
      serviceId: service.id,
      packageId: pkg.id,
      bundleId: null,
      addonIds: [],
      quantity: qty,
      serverUnitPriceSAR: unit,
      lineTotalSAR: unit * qty,
      calculator: null,
      serviceTitle: service.title,
      image: service.image,
      pricingBreakdown: quote,
      blockCheckout: quote.blockCheckout,
    };
  }

  // Normal service package line
  const packageId = input.packageId;
  let pkg = packageId
    ? service.packages.find((p) => p.id === packageId && p.active)
    : null;

  // Resolve package by name (legacy selectedOption)
  if (!pkg && input.selectedOption) {
    pkg = service.packages.find((p) => p.name === input.selectedOption && p.active) || null;
  }
  if (!pkg) {
    pkg = service.packages.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder)[0] || null;
  }
  if (!pkg) throw new Error(`No package for service ${serviceId}`);

  const addonIds = new Set<string>(input.addonIds || []);
  // Resolve addon titles → ids
  for (const title of input.selectedAddons || []) {
    const found = service.addons.find((a) => a.title === title && a.active);
    if (found) addonIds.add(found.id);
  }

  let addonsTotal = 0;
  const resolvedAddonIds: string[] = [];
  for (const id of addonIds) {
    const addon = service.addons.find((a) => a.id === id && a.active);
    if (!addon) throw new Error(`Invalid addon ${id} for service ${serviceId}`);
    if (addon.serviceId !== service.id) throw new Error(`Addon ${id} does not belong to service`);
    addonsTotal += addon.priceSAR;
    resolvedAddonIds.push(id);
  }

  const unit = pkg.priceSAR + addonsTotal;
  return {
    lineType: 'service' as LineType,
    serviceId: service.id,
    packageId: pkg.id,
    bundleId: null,
    addonIds: resolvedAddonIds,
    quantity: qty,
    serverUnitPriceSAR: unit,
    lineTotalSAR: unit * qty,
    calculator: null,
    serviceTitle: service.title,
    image: service.image,
  };
}

export async function priceBundleLine(input: OrderLineInput): Promise<PricedLine> {
  const qty = Math.max(1, input.quantity || 1);
  let bundle = input.bundleId
    ? await prisma.bundle.findFirst({ where: { id: input.bundleId, active: true } })
    : null;

  // Legacy: serviceId like bundle_${title}
  if (!bundle && input.serviceId?.startsWith('bundle_')) {
    const title = input.serviceId.replace(/^bundle_/, '');
    bundle = await prisma.bundle.findFirst({ where: { title, active: true } });
  }
  if (!bundle && input.serviceTitle) {
    bundle = await prisma.bundle.findFirst({ where: { title: input.serviceTitle, active: true } });
  }
  if (!bundle) throw new Error('Bundle not found');

  return {
    lineType: 'bundle' as LineType,
    serviceId: null,
    packageId: null,
    bundleId: bundle.id,
    addonIds: [] as string[],
    quantity: qty,
    serverUnitPriceSAR: bundle.priceSAR,
    lineTotalSAR: bundle.priceSAR * qty,
    calculator: null,
    serviceTitle: bundle.title,
    image: bundle.image,
  };
}

export async function priceLine(input: OrderLineInput): Promise<PricedLine> {
  const isBundle =
    !!input.bundleId ||
    input.serviceId?.startsWith('bundle_') ||
    input.selectedOption === 'باقة مجمعة شاملة';

  if (isBundle) return priceBundleLine(input);
  return priceServiceLine(input);
}

export async function applyCoupon(code: string | null | undefined, subtotalSAR: number) {
  if (!code) {
    return { couponCode: null as string | null, discountPercentage: 0, discountSAR: 0, totalSAR: subtotalSAR };
  }
  const coupon = await prisma.coupon.findFirst({
    where: { code: code.trim().toUpperCase(), active: true },
  });
  if (!coupon) throw new Error('Invalid coupon');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error('Coupon expired');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }
  const discountSAR = Math.round((subtotalSAR * coupon.discountPercentage) / 100);
  return {
    couponCode: coupon.code,
    discountPercentage: coupon.discountPercentage,
    discountSAR,
    totalSAR: Math.max(0, subtotalSAR - discountSAR),
  };
}

export { parsePricingConfig };
