# 🚀 Enterprise Integration Completion Sprint

**Hedef:** DG STOK V5.0'ı %65'ten %95+ entegrasyon seviyesine çıkarmak

---

## 1. EventBus Listener Eksiklikleri (14 event)

### 1.1 AI Image Event'leri → Dashboard

| Event | Durum | Yapılacak |
|-------|-------|-----------|
| `ImageAnalyzed` | 🔴 Listener yok | Dashboard/SummaryService listener'ı eklenecek |
| `ImageIssueDetected` | 🔴 Listener yok | Bildirim listener'ı eklenecek |
| `ImageApproved` | 🔴 Listener yok | AuditLog listener'ı eklenecek |
| `ImageRejected` | 🔴 Listener yok | AuditLog listener'ı eklenecek |

**Yapılacak:** `EventListeners.ts`'e 4 yeni `EventBus.on()` eklenecek. Her biri `SummaryService.clearCache()` ve `DashboardService.clearCache()` çağıracak.

### 1.2 AI Sales Event'leri → Dashboard + WorkflowState

| Event | Durum | Yapılacak |
|-------|-------|-----------|
| `PriceRecommendationCreated` | 🔴 Listener yok | Dashboard listener'ı |
| `PriceRecommendationApproved` | 🔴 Listener yok | AuditLog + Dashboard |
| `PriceRecommendationRejected` | 🔴 Listener yok | AuditLog + Dashboard |
| `ProfitChanged` | 🔴 Listener yok | Dashboard + WorkflowState (Pricing adımını güncelle) |

**Yapılacak:** `EventListeners.ts`'e 4 yeni listener. `ProfitChanged` → `WorkflowStateManager.syncFromProduct()` çağıracak.

### 1.3 AI Copilot Event'leri → AuditLog + Dashboard

| Event | Durum | Yapılacak |
|-------|-------|-----------|
| `CopilotRequested` | 🔴 Listener yok | AuditLog kaydı |
| `CopilotTaskStarted` | 🔴 Listener yok | AuditLog + Timeline |
| `CopilotTaskCompleted` | 🔴 Listener yok | AuditLog + Dashboard |
| `CopilotTaskFailed` | 🔴 Listener yok | AuditLog + AICommandCenter issue oluştur |

### 1.4 Stock Protection Event'leri → WorkflowState

| Event | Durum | Yapılacak |
|-------|-------|-----------|
| `HealthScoreUpdated` | 🔴 Listener yok | WorkflowState readiness güncellemesi |
| `StockProtectionDecision` | ⚠️ Sadece log | Timeline kaydı ekle |

### 1.5 `CompetitionChanged` — Ölü Kod

| Event | Durum | Yapılacak |
|-------|-------|-----------|
| `CompetitionChanged` | 🔴 Hiç emit edilmiyor | Kaldır (events.ts'ten) |

---

## 2. Dashboard — Tek Veri Kaynağı

### 2.1 Mevcut Durum
15 COUNT sorgusunun 14'ü direkt DB'den (`routes/index.ts:837-852`)

### 2.2 Yapılacak
`/dashboard/stats` endpoint'i `SummaryService.getSummary()`'yi kullanacak şekilde yeniden yazılacak.

```typescript
// YENİ: routes/index.ts
router.get('/dashboard/stats', async (_req, res) => {
  const summary = await SummaryService.getSummary();
  // XML/Marketplace ek bilgilerini ekle (bunlar WorkflowState'te yok)
  const marketplaces = await prisma.marketplace.count();
  const xmlSources = await prisma.xmlSource.count();
  res.json({ ...summary, totalMarketplaces: marketplaces, totalXmlSources: xmlSources });
});
```

SummaryService'e şu alanlar eklenecek:
- `totalOrders` → WorkflowState'den çıkarılamaz, ayrı endpoint
- `lowStockProducts` → StockProtection'dan alınabilir
- `todayOrders` → DashboardRefresh ile güncellenebilir cache

---

## 3. ReadyToSend — Bypass Kapatma

### 3.1 Mevcut Durum
Frontend `ReadyToSend.tsx` doğrudan `/products?categoryMatch=true&brandMatch=true` API'sini çağırıyor (`ReadyToSend.tsx:42`)

### 3.2 Yapılacak
Frontend `/ready-to-send` endpoint'ini kullanacak. Bu endpoint `ReadyToSendEngine.getReadiness()`'i çağıracak.

```typescript
// YENİ: routes/readyToSend.ts
router.get('/', requireAuth, async (req, res) => {
  const { xmlSourceId, page, limit } = req.query;
  const result = await ReadyToSendEngine.getReadyProducts(xmlSourceId, page, limit);
  res.json(result);
});
```

**Frontend değişikliği:** `ReadyToSend.tsx:42` → `apiFetch('/ready-to-send?...')`

---

## 4. AI Modülleri Entegrasyonu

### 4.1 AI Command Center → Diğer AI Modülleri

AICommandCenter şu an diğer AI modüllerini **tetiklemiyor**. Yapılacak:

```typescript
// EventListeners.ts'e eklenecek
EventBus.on('ImageIssueDetected', async (event) => {
  // AI Command Center'a issue olarak ekle
  await prisma.aIIssue.create({...});
  SummaryService.clearCache();
});

EventBus.on('PriceRecommendationCreated', async (event) => {
  // Dashboard'u güncelle
  SummaryService.clearCache();
  DashboardService.clearCache();
});
```

### 4.2 AI Copilot → Diğer Modülleri Tetikleme

Copilot şu an sadece OKUYOR. Yapılacak:

```typescript
// CopilotExecutor.ts'de CopilotTaskCompleted event'ine listener
EventBus.on('CopilotTaskCompleted', async (event) => {
  // Copilot bir iş yaptıysa Dashboard'u yenile
  SummaryService.clearCache();
  DashboardService.clearCache();
  // AuditLog kaydı
  await prisma.auditLog.create({...});
});
```

---

## 5. Marketplace Adapter Standardizasyonu

### 5.1 Mevcut Durum
Sadece Trendyol ve N11 adapter'ı var. (`routes/marketplace.ts:14-16`)

### 5.2 Yapılacak
Şimdilik sadece mevcut 2 adapter'ın ortak interface kullandığını doğrula. Diğerleri için `getAdapterClass()` null döndüğünde hata mesajı düzelt.

---

## 6. Kullanılmayan 16 Route

### 6.1 Karar: KALDIR (şimdilik)
Bu route'lar frontend'den çağrılmıyor, başka servisler tarafından kullanılmıyor. Güvenle kaldırılabilir.

| Route | Dosya | İşlem |
|-------|-------|-------|
| `/bi` | `routes/bi.ts` | index.ts'ten mount'u kaldır |
| `/plm` | `routes/plm.ts` | Kaldır |
| `/mdm` | `routes/mdm.ts` | Kaldır |
| `/twin` | `routes/twin.ts` | Kaldır |
| `/dispatch` | `routes/dispatch.ts` | Kaldır |
| `/forensic` | `routes/forensic.ts` | Kaldır |
| `/dqc` | `routes/dqc.ts` | Kaldır |
| `/pipeline` | `routes/pipeline.ts` | Kaldır |
| `/operations` | `routes/operations.ts` | Kaldır |
| `/providers` | `routes/providers.ts` | Kaldır |
| `/reconciliation` | `routes/reconciliation.ts` | Kaldır |
| `/recalculation` | `routes/recalculation.ts` | Kaldır |
| `/title` | `routes/title.ts` | Kaldır |
| `/transform` | `routes/transform.ts` | Kaldır |
| `/variant-consistency` | `routes/variant-consistency.ts` | Kaldır |
| `/rules` | `routes/rules.ts` | Kaldır |

**Kod:** `routes/index.ts:60-91` — Bu 16 satırı kaldır.

---

## 7. Kullanılmayan Servisler

### 7.1 operation/ klasörü (5 dosya)
```typescript
services/operation/EventBus.ts        // İkinci EventBus — KALDIR
services/operation/OperationEngine.ts // KALDIR
services/operation/OperationQueue.ts  // KALDIR
services/operation/OperationStore.ts  // KALDIR
services/operation/RetryManager.ts    // KALDIR
services/operation/types.ts           // KALDIR
services/operation/index.ts           // KALDIR
```

### 7.2 aiEngine/ ve aiCore/ klasörleri
```typescript
services/aiEngine/AIAnalysisEngine.ts  // KALDIR
services/aiCore/AICore.ts             // KALDIR
services/aiCore/utils/*               // KALDIR
services/finance/FinanceTrigger.ts    // KALDIR
```

---

## 8. Production Acceptance Test

Son adımda kapsamlı PAT çalıştırılacak:

1. ✅ TypeScript derleme — 0 hata
2. ✅ Prisma validate — geçerli
3. ✅ Tüm route'lar çalışıyor
4. ✅ EventBus emit ↔ listener eşleşmesi
5. ✅ WorkflowState cascade testi
6. ✅ Dashboard tek kaynak testi
7. ✅ ReadyToSend bypass yok testi
8. ✅ AI event'leri dinleniyor testi
9. ✅ API yanıt süreleri
10. ✅ 100K ürün senaryosu

---

## 9. Tahmini Süre

| Adım | İşlem | Süre |
|------|-------|------|
| 1 | EventListeners'a 14 yeni listener | ~30 dk |
| 2 | Dashboard → SummaryService geçişi | ~20 dk |
| 3 | ReadyToSend bypass kapatma (backend+frontend) | ~30 dk |
| 4 | Kullanılmayan route'ları kaldırma | ~15 dk |
| 5 | Kullanılmayan servisleri kaldırma | ~10 dk |
| 6 | CompetitionChanged kaldırma | ~5 dk |
| 7 | Derleme + Test | ~15 dk |
| **Toplam** | | **~2 saat** |
