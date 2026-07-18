// ==================== PAZARYERİ MUTABAKAT MOTORU V1.0 ====================
// Tüm pazaryerleri için otomatik mutabakat
// Beklenen ödeme ile gerçek ödemeyi karşılaştırır
// =====================================================================

import { prisma } from '../db/prisma.ts';
const p = prisma as any;

export interface ReconciliationItem {
  id: string;
  orderNo: string;
  marketplace: string;
  orderAmount: number;
  commission: number;
  shipping: number;
  returns: number;
  deductions: number;
  expectedPayment: number;
  actualPayment: number;
  difference: number;
  status: string;
  paymentDate: string | null;
  createdAt: string;
}

export interface BatchReconciliationResult {
  totalOrders: number;
  totalExpected: number;
  totalActual: number;
  totalDifference: number;
  matchedCount: number;
  mismatchCount: number;
  items: ReconciliationItem[];
}

// ==================== OTOMATİK MUTABAKAT ====================

export async function runReconciliation(
  marketplaceId: string,
  startDate: string,
  endDate: string
): Promise<BatchReconciliationResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // İlgili pazaryerindeki siparişleri getir
  const orders = await p.order.findMany({
    where: {
      marketplaceId,
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'asc' },
  });

  const items: ReconciliationItem[] = [];
  let totalExpected = 0;
  let totalActual = 0;

  for (const order of orders) {
    const orderAmount = order.total || 0;
    const commission = order.commission || orderAmount * 0.15;
    const shipping = order.cargoPrice || 0;
    const returns = order.status === 'cancelled' ? orderAmount : 0;
    const deductions = commission + shipping + returns;
    const expectedPayment = orderAmount - deductions;

    // Varsayılan: henüz ödeme gelmedi
    const actualPayment = 0;
    const difference = expectedPayment - actualPayment;

    let status = 'BEKLIYOR';
    if (actualPayment === 0) status = 'BEKLIYOR';
    else if (Math.abs(difference) < 1) status = 'TAMAMLANDI';
    else if (difference > 0) status = 'EKSIK_ODEME';
    else if (difference < 0) status = 'FAZLA_KESINTI';

    const rec = await p.reconciliation.upsert({
      where: { id: `rec_${order.id}` },
      update: {
        orderAmount, commission, shipping, returns, deductions,
        expectedPayment, actualPayment, difference, status,
      },
      create: {
        id: `rec_${order.id}`,
        marketplaceId,
        orderNo: order.orderNo,
        orderId: order.id,
        orderAmount, commission, shipping, returns, deductions,
        expectedPayment, actualPayment, difference, status,
      },
    });

    totalExpected += expectedPayment;
    totalActual += actualPayment;

    items.push({
      id: rec.id,
      orderNo: order.orderNo,
      marketplace: order.channel || 'Bilinmeyen',
      orderAmount, commission, shipping, returns, deductions,
      expectedPayment, actualPayment, difference, status,
      paymentDate: null,
      createdAt: order.createdAt.toISOString(),
    });
  }

  // Batch kaydı oluştur
  await p.reconciliationBatch.create({
    data: {
      marketplaceId,
      startDate: start,
      endDate: end,
      totalOrders: orders.length,
      totalAmount: totalExpected,
      totalPaid: totalActual,
      totalDiff: totalExpected - totalActual,
      status: totalExpected === totalActual ? 'TAMAMLANDI' : 'INCELENEN',
    },
  });

  const matchedCount = items.filter(i => i.status === 'TAMAMLANDI').length;
  const mismatchCount = items.filter(i => i.status !== 'TAMAMLANDI').length;

  return {
    totalOrders: orders.length,
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalDifference: Math.round((totalExpected - totalActual) * 100) / 100,
    matchedCount,
    mismatchCount,
    items,
  };
}

// ==================== MUTABAKAT RAPORU ====================

export async function getReconciliationReport(
  marketplaceId?: string,
  status?: string,
  page = 1,
  limit = 50
) {
  const where: any = {};
  if (marketplaceId) where.marketplaceId = marketplaceId;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    p.reconciliation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    p.reconciliation.count({ where }),
  ]);

  return { items, total };
}

// ==================== MUTABAKAT ÖZETİ ====================

export async function getReconciliationSummary(marketplaceId?: string) {
  const where: any = {};
  if (marketplaceId) where.marketplaceId = marketplaceId;

  const items = await p.reconciliation.findMany({ where });
  const totalExpected = items.reduce((s: number, i: any) => s + i.expectedPayment, 0);
  const totalActual = items.reduce((s: number, i: any) => s + i.actualPayment, 0);
  const statusCounts: Record<string, number> = {};

  for (const i of items) {
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
  }

  return {
    totalOrders: items.length,
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalDifference: Math.round((totalExpected - totalActual) * 100) / 100,
    statusCounts,
    matchRate: items.length > 0
      ? Math.round(((statusCounts['TAMAMLANDI'] || 0) / items.length) * 10000) / 100
      : 0,
  };
}

// ==================== ÖDEME GİRİŞİ ====================

export async function recordPayment(
  reconciliationId: string,
  actualPayment: number,
  paymentDate: string,
  bankAccountId?: string,
  notes?: string
) {
  const rec = await p.reconciliation.findUnique({ where: { id: reconciliationId } });
  if (!rec) throw new Error('Mutabakat kaydı bulunamadı');

  const difference = rec.expectedPayment - actualPayment;
  let status = 'INCELENEN';
  if (Math.abs(difference) < 1) status = 'TAMAMLANDI';
  else if (difference > 0) status = 'EKSIK_ODEME';
  else status = 'FAZLA_KESINTI';

  return p.reconciliation.update({
    where: { id: reconciliationId },
    data: {
      actualPayment,
      difference,
      status,
      paymentDate: new Date(paymentDate),
      bankAccountId,
      notes,
    },
  });
}

// ==================== BATCH RAPORLARI ====================

export async function getReconciliationBatches(marketplaceId?: string) {
  const where: any = {};
  if (marketplaceId) where.marketplaceId = marketplaceId;

  return p.reconciliationBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
