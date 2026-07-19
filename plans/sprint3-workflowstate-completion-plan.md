# DG STOK V5.0 — Sprint 3: WorkflowState Production Completion

## Mevcut Durum

### ✅ Sprint 2'den Gelenler
- `routes/workflow.ts` ve `services/workflowEngine.ts` → legacy
- `WorkflowStateManager` → `calculateReadiness`, `getReadinessColor`, `getStatusFromScore`
- `Orchestrator.tsx` → `/workflow-state/stats` kullanıyor
- Tüm import'lar `WorkflowStateManager`'e yönlendirildi

### ❌ Sprint 3'te Çözülecek Sorunlar
1. `DashboardService` hala `prisma.product.groupBy`, `prisma.productMarketplaceState.groupBy` okuyor → WorkflowState kullanmalı
2. `SummaryService` kısmen WorkflowState kullanıyor ama Product tablosundan da okuyor
3. `ProductPool.tsx` hala `product.categoryMatch`, `product.brandMatch` okuyor → WorkflowState'ten okumalı
4. `calculateReadyToSend` fonksiyonu yok
5. Workflow Timeline UI'da görünmüyor
6. EventBus → WorkflowState zinciri tam kurulu değil

---

## Adım Adım Uygulama

### ADIM 1: WorkflowState Model Güncelleme (Prisma)

```prisma
model WorkflowState {
  id          String   @id @default(uuid())
  productId   String   @unique
  status      String   @default("XML_IMPORTED")
  stepCategory String? // OK | MISSING
  stepBrand   String?
  stepVariant String?
  stepTemplate String?
  readiness   Int      @default(0)
  errorCount  Int      @default(0)
  lastError   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**No schema change needed** - the current model already supports what we need.

### ADIM 2: calculateReadyToSend(productId)

WorkflowStateManager'a ekle:

```typescript
static async calculateReadyToSend(productId: string): Promise<{
  ready: boolean;
  score: number;
  missing: string[];
}> {
  const ws = await prisma.workflowState.findUnique({ where: { productId } });
  if (!ws) return { ready: false, score: 0, missing: ['WORKFLOW_STATE_NOT_FOUND'] };
  
  const missing: string[] = [];
  let score = 0;
  
  // XML: 10 puan
  score += 10; // XML kaynağı var sayılır (WorkflowState varsa)
  
  // Kategori: 20 puan
  if (ws.stepCategory === 'OK') score += 20;
  else missing.push('CATEGORY');
  
  // Marka: 15 puan
  if (ws.stepBrand === 'OK') score += 15;
  else missing.push('BRAND');
  
  // Varyant: 20 puan
  if (ws.stepVariant === 'OK') score += 20;
  else missing.push('VARIANT');
  
  // Şablon: 25 puan
  if (ws.stepTemplate === 'OK') score += 25;
  else missing.push('TEMPLATE');
  
  // Kontroller: 10 puan
  if (ws.errorCount === 0) score += 10;
  else missing.push('VALIDATION_ERRORS');
  
  return {
    ready: missing.length === 0,
    score,
    missing,
  };
}
```

### ADIM 3: SummaryService → Tamamen WorkflowState Tabanlı

`SummaryService.getSummary()` güncelle:
- Tüm sayıları `prisma.workflowState` üzerinden hesapla
- Artık `prisma.product` okumayacak
- `pendingCategory` → `workflowState.where({ stepCategory: 'MISSING' })`
- `readyForListing` → `workflowState.where({ status: 'READY_TO_SEND' })`

### ADIM 4: DashboardService → SummaryService Üzerinden

DashboardService artık:
- kendi count sorgularını yapmayacak
- tüm veriyi SummaryService'ten alacak
- sadece XML/marketplace ek bilgilerini ekleyecek

### ADIM 5: Workflow Timeline Route

`workflowState.ts`'e ek endpoint:

```typescript
// GET /workflow-state/timeline/:productId
router.get('/timeline/:productId', requireAuth, async (req, res) => {
  const timeline = await prisma.workflowTimeline.findMany({
    where: { productId: req.params.productId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items: timeline });
});
```

### ADIM 6: EventBus → WorkflowState Zinciri

Her event sonrası:
1. Event işlenir
2. WorkflowStateManager.onModuleChanged() çağrılır
3. Cascade kuralları uygulanır
4. WorkflowTimeline'a kayıt eklenir
5. DashboardRefresh event'i yayınlanır

### ADIM 7: readyToSend API Endpoint

```typescript
// GET /workflow-state/ready-to-send/:productId
router.get('/ready-to-send/:productId', requireAuth, async (req, res) => {
  const result = await WorkflowStateManager.calculateReadyToSend(req.params.productId);
  res.json(result);
});

// GET /workflow-state/ready-to-send (toplu)
router.get('/ready-to-send', requireAuth, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const items = await prisma.workflowState.findMany({
    where: { status: 'READY' },
    skip: (page - 1) * limit,
    take: limit,
  });
  res.json({ items, total: items.length });
});
```

---

## Dosya Değişiklik Özeti

| Dosya | Değişiklik |
|-------|-----------|
| `services/workflow/WorkflowStateManager.ts` | + `calculateReadyToSend()`, + `recordTimeline()` |
| `services/autoRecalculation/SummaryService.ts` | Tüm sorgular WorkflowState üzerinden |
| `services/dashboard/DashboardService.ts` | Sadece SummaryService kullanır |
| `routes/workflowState.ts` | + `/ready-to-send`, + `/timeline/:productId` |
| `routes/dashboard.ts` | DashboardService.getSummary() kullanır |
| `web/src/pages/Dashboard.tsx` | `/dashboard/summary` API'sini kullanır |
| `web/src/pages/ProductPool.tsx` | WorkflowState renklerini kullanır |

---

## Risk Değerlendirmesi

| Risk | Çözüm |
|------|-------|
| Dashboard yanlış veri gösterebilir | Önce test et, sonra canlıya al |
| readyToSend hesaplaması eksik olabilir | Tüm kontrolleri tek noktada topla |
| Timeline kayıtları eskiyebilir | Her event'te otomatik kayıt ekle |
| ProductPool renkleri bozulabilir | WorkflowState readiness skoruna göre renklendir |
