import { prisma } from '../lib/prisma';
import { applyCoupon, priceLine, OrderLineInput } from './pricing';
import { validateQuestionnaireAnswers } from './questionnaire';

function orderNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CB-${y}${m}${day}-${rand}`;
}

export interface CreateOrderBody {
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    notes?: string;
  };
  paymentMethod?: string;
  currency?: string;
  couponCode?: string | null;
  items: OrderLineInput[];
  clientPricing?: {
    subtotalSAR?: number;
    discountPercentage?: number;
    discountSAR?: number;
    grandTotalSAR?: number;
  };
  source?: string;
}

export async function createOrder(body: CreateOrderBody) {
  if (!body.customer?.fullName?.trim()) throw new Error('customer.fullName required');
  if (!body.customer?.phone?.trim()) throw new Error('customer.phone required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('items required');
  }

  const priced: Awaited<ReturnType<typeof priceLine>>[] = [];
  for (const item of body.items) {
    priced.push(await priceLine(item));
  }

  // Validate questionnaires for normal service package lines (not bundles / calculator)
  for (let i = 0; i < body.items.length; i++) {
    const raw = body.items[i];
    const line = priced[i];
    if (line.lineType !== 'service' || !line.serviceId) continue;

    const schema = await prisma.serviceRequirementSchema.findUnique({
      where: { serviceId: line.serviceId },
    });
    if (!schema) continue;

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(schema.schemaJson);
    } catch {
      parsed = {};
    }

    const result = validateQuestionnaireAnswers(parsed, raw.answers);
    if (!result.valid) {
      throw new Error(result.message);
    }
  }

  const subtotalSAR = priced.reduce((s, l) => s + l.lineTotalSAR, 0);
  const coupon = await applyCoupon(body.couponCode, subtotalSAR);

  const order = await prisma.$transaction(async (tx) => {
    if (coupon.couponCode) {
      await tx.coupon.update({
        where: { code: coupon.couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    return tx.order.create({
      data: {
        orderNumber: orderNumber(),
        status: 'submitted',
        paymentStatus: 'unpaid',
        paymentMethod: body.paymentMethod || 'mada',
        currency: body.currency || 'SAR',
        couponCode: coupon.couponCode,
        discountPercentage: coupon.discountPercentage,
        subtotalSAR,
        discountSAR: coupon.discountSAR,
        totalSAR: coupon.totalSAR,
        clientSubtotalSAR: body.clientPricing?.subtotalSAR ?? null,
        clientDiscountSAR: body.clientPricing?.discountSAR ?? null,
        clientTotalSAR: body.clientPricing?.grandTotalSAR ?? null,
        customerFullName: body.customer.fullName.trim(),
        customerPhone: body.customer.phone.trim(),
        customerEmail: body.customer.email?.trim() || null,
        customerNotes: body.customer.notes?.trim() || null,
        source: body.source || 'web_checkout',
        items: {
          create: priced.map((line, idx) => {
            const raw = body.items[idx];
            return {
              lineType: line.lineType,
              serviceId: line.serviceId,
              packageId: line.packageId,
              bundleId: line.bundleId,
              addonIdsJson: JSON.stringify(line.addonIds),
              quantity: line.quantity,
              detailsJson: JSON.stringify({
                ...(raw.details || {}),
                ...(raw.answers ? { __answers: raw.answers } : {}),
              }),
              calculatorJson: line.calculator ? JSON.stringify(line.calculator) : null,
              serviceTitle: line.serviceTitle || raw.serviceTitle || null,
              selectedOption: raw.selectedOption || null,
              selectedAddonsJson: JSON.stringify(raw.selectedAddons || []),
              clientUnitPriceSAR: raw.unitPriceSAR ?? null,
              serverUnitPriceSAR: line.serverUnitPriceSAR,
              lineTotalSAR: line.lineTotalSAR,
              notes: raw.notes || null,
              image: line.image || raw.image || null,
            };
          }),
        },
      },
      include: { items: true },
    });
  });

  return order;
}

export async function estimateOrder(body: CreateOrderBody) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('items required');
  }
  const priced: Awaited<ReturnType<typeof priceLine>>[] = [];
  for (const item of body.items) {
    priced.push(await priceLine(item));
  }
  const subtotalSAR = priced.reduce((s, l) => s + l.lineTotalSAR, 0);
  const coupon = await applyCoupon(body.couponCode, subtotalSAR);
  return {
    items: priced,
    subtotalSAR,
    discountPercentage: coupon.discountPercentage,
    discountSAR: coupon.discountSAR,
    totalSAR: coupon.totalSAR,
    couponCode: coupon.couponCode,
  };
}
