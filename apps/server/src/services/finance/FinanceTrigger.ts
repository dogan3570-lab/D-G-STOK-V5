import { prisma } from '../../db/prisma.ts';

export type FinanceEventType =
  | 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'RETURN_CREATED'
  | 'SHIPMENT_SENT' | 'PAYMENT_RECEIVED' | 'COMMISSION_RECEIVED';

export class FinanceTrigger {
  async emit(event: FinanceEventType, data: { orderId?: string; amount?: number; marketplaceKey?: string }): Promise<void> {
    try {
      // Finans modulune event gonder (simdilik log)
      console.log(`[FinanceTrigger] Event: ${event}`, JSON.stringify(data));

      // FinanceRecord olustur
      if (data.amount && data.orderId) {
        await prisma.financeRecord.create({
          data: {
            type: event === 'ORDER_CANCELLED' || event === 'RETURN_CREATED' ? 'refund' : 'sale',
            amount: data.amount,
            orderId: data.orderId,
            marketplaceId: data.marketplaceKey ? (await prisma.marketplace.findFirst({ where: { key: data.marketplaceKey } }))?.id : undefined,
            description: `Event: ${event}`,
          },
        });
      }
    } catch (error) {
      console.error('[FinanceTrigger] Error:', error);
    }
  }
}
