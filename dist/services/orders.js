"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderPricingError = void 0;
exports.createOrder = createOrder;
exports.estimateOrder = estimateOrder;
const prisma_1 = require("../lib/prisma");
const pricing_1 = require("./pricing");
const questionnaire_1 = require("./questionnaire");
const orderFiles_1 = require("../lib/orderFiles");
function orderNumber() {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CB-${y}${m}${day}-${rand}`;
}
class OrderPricingError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}
exports.OrderPricingError = OrderPricingError;
async function createOrder(body) {
    if (!body.customer?.fullName?.trim())
        throw new Error('اسم العميل مطلوب');
    if (!(0, questionnaire_1.isMeaningfulText)(body.customer.fullName)) {
        throw new Error('يرجى إدخال اسم ذي معنى يحتوي على حرف أو رقم على الأقل');
    }
    if (!body.customer?.phone?.trim())
        throw new Error('رقم الجوال مطلوب');
    {
        const phoneDigits = String(body.customer.phone)
            .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
            .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
            .replace(/\D/g, '');
        if (phoneDigits.length < 8)
            throw new Error('يرجى إدخال رقم جوال صحيح');
    }
    if (body.customer.email?.trim()) {
        const email = body.customer.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('يرجى إدخال بريد إلكتروني صحيح');
        }
    }
    if (body.customer.notes?.trim() && !(0, questionnaire_1.isMeaningfulText)(body.customer.notes)) {
        throw new Error('يرجى إدخال ملاحظات ذات معنى أو اترك الحقل فارغاً');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new Error('items required');
    }
    const priced = [];
    for (const item of body.items) {
        priced.push(await (0, pricing_1.priceLine)(item));
    }
    for (let i = 0; i < priced.length; i++) {
        const line = priced[i];
        if (line.blockCheckout) {
            throw new OrderPricingError(line.blockCheckout, 'CHECKOUT_BLOCKED');
        }
    }
    // Validate questionnaires for normal service package lines (not bundles / calculator)
    for (let i = 0; i < body.items.length; i++) {
        const raw = body.items[i];
        const line = priced[i];
        if (line.lineType !== 'service' || !line.serviceId)
            continue;
        const schema = await prisma_1.prisma.serviceRequirementSchema.findUnique({
            where: { serviceId: line.serviceId },
        });
        if (!schema)
            continue;
        let parsed = {};
        try {
            parsed = JSON.parse(schema.schemaJson);
        }
        catch {
            parsed = {};
        }
        const result = (0, questionnaire_1.validateQuestionnaireAnswers)(parsed, raw.answers);
        if (!result.valid) {
            throw new Error(result.message);
        }
    }
    const subtotalSAR = priced.reduce((s, l) => s + l.lineTotalSAR, 0);
    const coupon = await (0, pricing_1.applyCoupon)(body.couponCode, subtotalSAR);
    const clientTotal = body.clientPricing?.grandTotalSAR;
    if (typeof clientTotal === 'number' &&
        Number.isFinite(clientTotal) &&
        clientTotal !== coupon.totalSAR &&
        !body.acceptPriceChange) {
        throw new OrderPricingError(`تغيّر المبلغ المعروض إلى ${coupon.totalSAR} ر.س (كان ${clientTotal} ر.س). يرجى تأكيد الاطلاع قبل إرسال الطلب.`, 'PRICE_CHANGED', {
            previousTotalSAR: clientTotal,
            newTotalSAR: coupon.totalSAR,
            subtotalSAR,
            discountSAR: coupon.discountSAR,
            items: priced.map((l) => ({
                serviceId: l.serviceId,
                serverUnitPriceSAR: l.serverUnitPriceSAR,
                lineTotalSAR: l.lineTotalSAR,
                pricingBreakdown: l.pricingBreakdown || null,
            })),
        });
    }
    const order = await prisma_1.prisma.$transaction(async (tx) => {
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
                        const isPrelim = Boolean(line.pricingBreakdown?.isPreliminary);
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
                                ...(line.pricingBreakdown
                                    ? {
                                        __pricing: {
                                            version: line.pricingBreakdown.pricingRuleVersion,
                                            promotionEnabled: line.pricingBreakdown.promotionEnabled,
                                            isPreliminary: true,
                                            estimateOnly: true,
                                            finalPriceAccepted: false,
                                            preliminaryPages: line.pricingBreakdown.preliminaryPages,
                                            exactPages: line.pricingBreakdown.preliminaryPages,
                                            pageTierId: line.pricingBreakdown.pageTierId,
                                            pageTierLabel: line.pricingBreakdown.pageTierLabel,
                                            pretaxTotalSAR: line.pricingBreakdown.pretaxTotalSAR,
                                            note: isPrelim ? 'يبدأ من' : undefined,
                                            lines: line.pricingBreakdown.lines,
                                        },
                                    }
                                    : {}),
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
            include: { items: true, files: true },
        });
    });
    // Link pre-uploaded questionnaire files to this order / line items
    const itemFileMap = order.items.map((item, idx) => {
        const refs = (0, orderFiles_1.collectFileRefsFromAnswers)(body.items[idx]?.answers);
        return {
            orderItemId: item.id,
            fileIds: refs.map((r) => r.id),
        };
    });
    await (0, orderFiles_1.linkOrderFiles)({ orderId: order.id, itemFileMap });
    return prisma_1.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, files: true },
    });
}
async function estimateOrder(body) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new Error('items required');
    }
    const priced = [];
    for (const item of body.items) {
        priced.push(await (0, pricing_1.priceLine)(item));
    }
    for (const line of priced) {
        if (line.blockCheckout) {
            throw new OrderPricingError(line.blockCheckout, 'CHECKOUT_BLOCKED');
        }
    }
    const subtotalSAR = priced.reduce((s, l) => s + l.lineTotalSAR, 0);
    const coupon = await (0, pricing_1.applyCoupon)(body.couponCode, subtotalSAR);
    return {
        items: priced,
        subtotalSAR,
        discountPercentage: coupon.discountPercentage,
        discountSAR: coupon.discountSAR,
        totalSAR: coupon.totalSAR,
        couponCode: coupon.couponCode,
    };
}
