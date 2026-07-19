// ==================== COPILOT PERMISSIONS V1 ====================
// Hangi işlemlerin onay gerektirdiğini belirler
// ================================================================

import type { ModuleName } from './types.ts';

interface PermissionRule {
  module: ModuleName;
  actions: string[];
  requiresApproval: boolean;
  allowedRoles: string[];
}

const PERMISSION_RULES: PermissionRule[] = [
  { module: 'category', actions: ['fixCategory'], requiresApproval: true, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'brand', actions: ['fixBrand'], requiresApproval: true, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'variant', actions: ['fixVariant'], requiresApproval: true, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'pricing', actions: ['updatePrice'], requiresApproval: true, allowedRoles: ['ADMIN'] },
  { module: 'workflow', actions: ['retry', 'unblock'], requiresApproval: true, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'marketplace', actions: ['sync', 'optimize'], requiresApproval: true, allowedRoles: ['ADMIN'] },
  { module: 'aiSales', actions: ['approvePriceUp', 'approvePriceDown'], requiresApproval: true, allowedRoles: ['ADMIN', 'OPERATOR'] },
  // ANALİZ ve RAPOR işlemleri onay gerektirmez
  { module: 'dashboard', actions: ['summary'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'workflow', actions: ['findNotReady', 'findBlocked', 'getStatus'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'category', actions: ['findMissingCategory'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'brand', actions: ['findMissingBrand'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'variant', actions: ['findMissingVariant'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'aiImage', actions: ['findIssues'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'aiSales', actions: ['findLowProfit', 'suggestPriceUp', 'suggestPriceDown'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'orders', actions: ['analyzeOrders', 'topSelling', 'todaySummary'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'marketplace', actions: ['analyzeMarketplace'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'stockProtection', actions: ['findRisky'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
  { module: 'aiCommandCenter', actions: ['getIssues'], requiresApproval: false, allowedRoles: ['ADMIN', 'OPERATOR'] },
];

export class CopilotPermissions {
  /**
   * İşlem onay gerektiriyor mu?
   */
  requiresApproval(module: ModuleName, action: string): boolean {
    const rule = PERMISSION_RULES.find(r => r.module === module && r.actions.includes(action));
    return rule?.requiresApproval ?? false;
  }

  /**
   * Kullanıcının yetkisi var mı?
   */
  isAllowed(module: ModuleName, action: string, role: string): boolean {
    const rule = PERMISSION_RULES.find(r => r.module === module && r.actions.includes(action));
    if (!rule) return false;
    return rule.allowedRoles.includes(role);
  }
}
