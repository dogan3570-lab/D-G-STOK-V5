# DG STOK V5.0 — GitHub Main Branch Envanter Raporu

**Tarih:** 2026-07-18
**Commit:** `0d2e035`
**Yöntem:** Her dosya import/call chain analizi ile incelendi.

---

## ENVANTER SINIFLARI

| Sınıf | Açıklama |
|-------|----------|
| 🟢 **ACTIVE** | Şu anda kullanılıyor, workflow'a bağlı, korunacak |
| 🟡 **LEGACY** | Eski sürüm, referans amaçlı tutulabilir |
| 🔵 **ARCHIVE** | Kullanılmıyor, `archive/` klasörüne taşınabilir |
| 🔴 **DELETE_CANDIDATE** | Hiçbir yerden çağrılmıyor, güvenle silinebilir |

---

## 1. ÇEKİRDEK (Core) — `apps/server/src/`

### 1.1 Entry Points

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `index.ts` | 🟢 ACTIVE | Node.js runtime | `npm start`/`node index.ts` | Uygulama giriş noktası |
| `server.ts` | 🟢 ACTIVE | `index.ts` (import) | `index.ts` satır 2 | Tüm HTTP, WebSocket, worker'ları başlatır |
| `bootstrap.ts` | 🟢 ACTIVE | `server.ts` (import) | `server.ts` satır 20, 220, 224 | Admin kullanıcı + event sistemi başlatır |
| `env.ts` | 🟢 ACTIVE | `server.ts`, diğer servisler | `server.ts` satır 16 | JWT, DB konfigürasyonu |

### 1.2 Database

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `db/prisma.ts` | 🟢 ACTIVE | Tüm route'lar ve servisler | 40+ dosya import ediyor | Tüm veritabanı işlemleri |
| `db/ensureDb.ts` | 🟢 ACTIVE | `server.ts` | `server.ts` satır 222 | DB bağlantı kontrolü |

### 1.3 Auth

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `auth/authMiddleware.ts` | 🟢 ACTIVE | Tüm routes | 20+ route dosyası | JWT doğrulama, yetkilendirme |

### 1.4 Middleware

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `middleware/errorHandler.ts` | 🟢 ACTIVE | Express app | `server.ts`'te kullanılmalı | Hata yönetimi |

### 1.5 Queue & Workers

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `queue/index.ts` | 🟢 ACTIVE | Worker'lar | `workers/index.ts` | BullMQ kuyruk |
| `queue/jobTypes.ts` | 🟢 ACTIVE | `queue/index.ts` | `queue/index.ts` | İş tipleri |
| `workers/index.ts` | 🟡 LEGACY | `server.ts` (ENABLE_WORKERS=true) | `server.ts` satır 207 | Worker başlatma (opsiyonel) |

### 1.6 SSE / WebSocket

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `sse/events.ts` | 🟢 ACTIVE | `server.ts` | `server.ts` satır 158 | SSE endpoint |
| `sse/websocket.ts` | 🟢 ACTIVE | `server.ts` | `server.ts` satır 17, 203 | Gerçek zamanlı iletişim |

### 1.7 Actions

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `actions/marketplaceSync.ts` | 🟢 ACTIVE | `routes/actions.ts` | Route: `/actions` | Pazaryeri senkronizasyonu |

### 1.8 Types

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `types/ssh2-sftp-client.d.ts` | 🟢 ACTIVE | `services/providers/SftpProvider.ts` | TypeScript type | SFTP tip tanımı |

---

## 2. ROUTE'LAR — `apps/server/src/routes/`

### 2.1 Route Registry

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `routes/index.ts` | 🟢 **ACTIVE** | `server.ts` satır 18 | `attachRoutes(app)` | **Tüm route'ları kaydeder** (685 satır, karmaşık) |

### 2.2 Register Edilmiş Route'lar (ACTIVE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `routes/actions.ts` | 🟢 ACTIVE | `routes/index.ts` satır 5 | `router.use('/actions', ...)` | Marketplace sync action'ları |
| `routes/ai.ts` | 🟢 ACTIVE | `routes/index.ts` satır 19 | `router.use('/ai', ...)` | AI servisleri |
| `routes/automation.ts` | 🟢 ACTIVE | `routes/index.ts` satır 10 | `router.use('/automation', ...)` | Otomasyon kuralları |
| `routes/brands.ts` | 🟢 ACTIVE | `routes/index.ts` satır 13 | `router.use('/brands', ...)` | Marka CRUD |
| `routes/brands-policy.ts` | 🟢 ACTIVE | `routes/index.ts` satır 14 | `router.use('/brand-policies', ...)` | Marka politikası |
| `routes/brandsV3.ts` | 🟢 ACTIVE | `routes/index.ts` satır 29 | `router.use('/brands/v3', ...)` | Marka V3 |
| `routes/categories.ts` | 🟢 ACTIVE | `routes/index.ts` satır 8 | `router.use('/categories', ...)` | Kategori CRUD |
| `routes/contentEngine.ts` | 🟢 ACTIVE | `routes/index.ts` satır 28 | `router.use('/content', ...)` | İçerik motoru |
| `routes/dqc.ts` | 🟢 ACTIVE | `routes/index.ts` satır 22 | `router.use('/dqc', ...)` | Veri kalite kontrol |
| `routes/listings.ts` | 🟢 ACTIVE | `routes/index.ts` satır 25 | `router.use('/listings', ...)` | Listing yönetimi |
| `routes/mdm.ts` | 🟢 ACTIVE | `routes/index.ts` satır 24 | `router.use('/mdm', ...)` | Master data management |
| `routes/pipeline.ts` | 🟢 ACTIVE | `routes/index.ts` satır 24 | `router.use('/pipeline', ...)` | Pipeline yönetimi |
| `routes/plm.ts` | 🟢 ACTIVE | `routes/index.ts` satır 19 | `router.use('/plm', ...)` | PLM |
| `routes/products.ts` | 🟢 ACTIVE | `routes/index.ts` satır 12 | `router.use('/products', ...)` | Ürün CRUD |
| `routes/reports.ts` | 🟢 ACTIVE | `routes/index.ts` satır 11 | `router.use('/reports', ...)` | Raporlar |
| `routes/rules.ts` | 🟢 ACTIVE | `routes/index.ts` satır 20 | `router.use('/rules', ...)` | Kurallar |
| `routes/title.ts` | 🟢 ACTIVE | `routes/index.ts` satır 16 | `router.use('/title', ...)` | Başlık motoru |
| `routes/transform.ts` | 🟢 ACTIVE | `routes/index.ts` satır 15 | `router.use('/transform', ...)` | Dönüşüm |
| `routes/twin.ts` | 🟢 ACTIVE | `routes/index.ts` satır 22 | `router.use('/twin', ...)` | Dijital ikiz |
| `routes/variants.ts` | 🟢 ACTIVE | `routes/index.ts` satır 9 | `router.use('/variants', ...)` | **Varyant V1** (1386 satır!) |
| `routes/variantsV2.ts` | 🟡 LEGACY | `routes/index.ts` satır 26 | `router.use('/variants/v2', ...)` | Varyant V2 (geriye uyum) |
| `routes/variantsV4.ts` | 🟡 LEGACY | `routes/index.ts` satır 27 | `router.use('/variants/v4', ...)` | Varyant V4 (geriye uyum) |
| `routes/variantsV5.ts` | 🟢 ACTIVE | `routes/index.ts` satır 30 | `router.use('/variants/v5', ...)` | **Varyant V5 (güncel)** |
| `routes/workflow.ts` | 🟡 LEGACY | `routes/index.ts` satır 17 | `router.use('/workflow', ...)` | Workflow V1 (eski motor) |
| `routes/workflowState.ts` | 🟢 ACTIVE | `routes/index.ts` satır 31 | `router.use('/workflow-state', ...)` | **Yeni workflow state** |
| `routes/xmlSources.ts` | 🟢 ACTIVE | `routes/index.ts` satır 7 | `router.use('/xml-sources', ...)` | XML kaynakları |

### 2.3 Register Edilmemiş Route'lar (ARCHIVE veya DELETE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `routes/bi.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — İş zekası route'u, diskte duruyor |
| `routes/dashboard.ts` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** — DashboardService zaten ACTIVE |
| `routes/dispatch.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Sevk route'u |
| `routes/finance.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Finans route'u, financeEngine.ts ACTIVE |
| `routes/forensic.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Forensic route'u |
| `routes/hepsiburada.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — HB entegrasyon route'u |
| `routes/listingV2.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Listing V2, listingEngineV2 ACTIVE |
| `routes/marketplaceTest.ts` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** — Test route'u |
| `routes/n11.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — N11 entegrasyon route'u |
| `routes/operations.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Operasyon route'u |
| `routes/orders.ts` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** — Sipariş route'u zaten `index.ts` satır 415-444'te inline |
| `routes/providers.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Provider route'u |
| `routes/recalculation.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Yeniden hesaplama |
| `routes/reconciliation.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Mutabakat |
| `routes/stockProtection.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Stok koruma route'u |
| `routes/system.ts` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** — Sistem route'u |
| `routes/trendyol.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Trendyol entegrasyon route'u |
| `routes/variant-consistency.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Varyant tutarlılık |
| `routes/workflow-v2.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — Workflow V2 |
| `routes/xml-engine.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — XML engine route'u |
| `routes/xmlv2.ts` | 🔵 **ARCHIVE** | Hiçbiri | Hiçbiri | **YOK** — XML V2 route'u |

---

## 3. SERVİSLER — `apps/server/src/services/`

### 3.1 ACTIVE Servisler (Workflow'a bağlı)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/eventBus/EventBus.ts` | 🟢 ACTIVE | `workflowState.ts`, diğer | Event-driven | **Tüm event sistemi** |
| `services/eventBus/events.ts` | 🟢 ACTIVE | `EventBus.ts` | `EventBus.ts` | Event tipleri |
| `services/workflow/index.ts` | 🟢 ACTIVE | `EventListeners.ts` | `bootstrap.ts` | Workflow modül |
| `services/workflow/types.ts` | 🟢 ACTIVE | `workflow/index.ts` | `workflow/index.ts` | Workflow tipleri |
| `services/workflow/WorkflowEngine.ts` | 🟢 ACTIVE | `workflow/index.ts` | EventBus | **Workflow motoru** |
| `services/workflow/WorkflowStateManager.ts` | 🟢 ACTIVE | `routes/workflowState.ts` | `routes/workflowState.ts` | **State yönetimi** |
| `services/workflow/EventListeners.ts` | 🟢 ACTIVE | `bootstrap.ts` | `bootstrap.ts` satır 28 | **Event listener'lar** |
| `services/autoRecalculation/index.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | `routes/workflowState.ts` | Yeniden hesaplama |
| `services/autoRecalculation/AutoRecalculationEngine.ts` | 🟢 ACTIVE | `routes/workflowState.ts` | WorkflowState | **Otomatik yeniden hesaplama** |
| `services/autoRecalculation/SummaryService.ts` | 🟢 ACTIVE | `routes/workflowState.ts` | WorkflowState | Özet servisi |
| `services/autoRecalculation/engines/BarcodeEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Barkod motoru |
| `services/autoRecalculation/engines/DescriptionEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Açıklama motoru |
| `services/autoRecalculation/engines/ImageEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Görsel motoru |
| `services/autoRecalculation/engines/PriceEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Fiyat motoru |
| `services/autoRecalculation/engines/ReadyToSendEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Gönderime hazır |
| `services/autoRecalculation/engines/TemplateEngine.ts` | 🟢 ACTIVE | `AutoRecalculationEngine.ts` | AutoRecalculation | Şablon motoru |
| `services/dashboard/DashboardService.ts` | 🟢 ACTIVE | `routes/workflowState.ts` | `routes/workflowState.ts` | Dashboard verileri |
| `services/automationScheduler.ts` | 🟢 ACTIVE | `server.ts` | `server.ts` satır 229 | **Zamanlanmış görevler** |

### 3.2 ACTIVE Servisler (Route bağlı)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/variantEngine.ts` (V1) | 🟡 **LEGACY** | `routes/variants.ts` | `routes/variants.ts` | **Varyant V1** — Halen kullanılıyor! |
| `services/variantEngineV2.ts` (V2) | 🟡 **LEGACY** | `routes/variantsV2.ts` | `routes/variantsV2.ts` | Varyant V2 |
| `services/variantEngineV4/index.ts` | 🟡 **LEGACY** | `routes/variantsV4.ts` | `routes/variantsV4.ts` | Varyant V4 |
| `services/variantEngineV5/index.ts` | 🟢 **ACTIVE** | `routes/variantsV5.ts` | `routes/variantsV5.ts` | **Varyant V5 (güncel)** |
| `services/variantEngineV5/*` (13 dosya) | 🟢 **ACTIVE** | V5 index | V5 pipeline | V5 alt modülleri |
| `services/variant/VariantConsistencyService.ts` | 🟢 ACTIVE | `routes/variant-consistency.ts` (ARCHIVE) | **KULLANILMIYOR** | Aslında ARCHIVE olmalı |
| `services/workflowEngine.ts` | 🟡 **LEGACY** | `routes/workflow.ts` | `routes/workflow.ts` | Eski workflow motoru |
| `services/contentEngine/index.ts` | 🟢 ACTIVE | `routes/contentEngine.ts` | Route: `/content` | İçerik motoru |
| `services/aiCore/AICore.ts` | 🟢 ACTIVE | `routes/ai.ts` | Route: `/ai` | AI çekirdek |
| `services/aiCore/utils/*` | 🟢 ACTIVE | `AICore.ts` | `AICore.ts` | AI yardımcıları |
| `services/aiEngine.ts` | 🟢 ACTIVE | `routes/ai.ts` | Route: `/ai` | AI motoru |
| `services/barcode/BarcodePrefixEngine.ts` | 🟢 ACTIVE | `routes/products.ts` | Route: `/products` | Barkod önek motoru |
| `services/listingEngine.ts` | 🟡 **LEGACY** | `routes/listings.ts` | Route: `/listings` | Listing V1 |
| `services/listingEngineV2/index.ts` | 🟢 ACTIVE | `routes/listingV2.ts` (ARCHIVE) | **KULLANILMIYOR** | Aslında ARCHIVE |
| `services/listingEngineV2/priceEngine.ts` | 🟢 ACTIVE | `listingEngineV2/index.ts` | **KULLANILMIYOR** | ARCHIVE |
| `services/listingEngineV2/ruleEngine.ts` | 🟢 ACTIVE | `listingEngineV2/index.ts` | **KULLANILMIYOR** | ARCHIVE |
| `services/listingEngineV2/types.ts` | 🟢 ACTIVE | `listingEngineV2/index.ts` | **KULLANILMIYOR** | ARCHIVE |
| `services/titleEngine.ts` | 🟢 ACTIVE | `routes/title.ts` | Route: `/title` | Başlık motoru |
| `services/transformationEngine.ts` | 🟢 ACTIVE | `routes/transform.ts` | Route: `/transform` | Dönüşüm motoru |
| `services/brandPolicy.ts` | 🟢 ACTIVE | `routes/brands-policy.ts` | Route: `/brand-policies` | Marka politikası |
| `services/xmlImport.ts` | 🟢 ACTIVE | `routes/index.ts` | Route: `/xml/import` | XML import |
| `services/marketplaceApi.ts` | 🟢 ACTIVE | `routes/index.ts` | Route: `/marketplaces/:id/test` | Marketplace test |
| `services/logger.ts` | 🟢 ACTIVE | Tüm servisler | 5+ dosya | Loglama |
| `services/dqcEngine.ts` | 🟢 ACTIVE | `routes/dqc.ts` | Route: `/dqc` | Veri kalite kontrol |
| `services/productAnalysis.ts` | 🟢 ACTIVE | `routes/pipeline.ts` | Route: `/pipeline` | Ürün analizi |
| `services/publishingEngine.ts` | 🟢 ACTIVE | `routes/listings.ts` | Route: `/listings` | Yayınlama motoru |
| `services/financeEngine.ts` | 🟢 ACTIVE | `routes/index.ts` (inline /finance) | Route: `/finance` | Finans motoru |
| `services/reconciliationEngine.ts` | 🟢 ACTIVE | `routes/index.ts` (inline) | Route: `/finance` | Mutabakat motoru |
| `services/stockMonitor.ts` | 🟢 ACTIVE | Inline routes | Route: `/dashboard/stats` | Stok monitör |
| `services/forensicEngine.ts` | 🟢 ACTIVE | `routes/forensic.ts` (ARCHIVE) | **KULLANILMIYOR** | Aslında ARCHIVE |

### 3.3 ACTIVE Marketplace Servisleri

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/marketplace/*` (9 dosya) | 🟡 **LEGACY** | `routes/index.ts` (dynamic import) | Route: `/marketplaces/:id/test` | Eski marketplace |
| `services/marketplaces/core/*` (10 dosya) | 🟢 **ACTIVE** | Trendyol/N11 adaptörleri | Yeni mimari | **Yeni marketplace core** |
| `services/marketplaces/trendyol/*` (15 dosya) | 🟢 **ACTIVE** | Yeni Trendyol entegrasyonu | EventBus | **Trendyol V2** |
| `services/marketplaces/n11/N11Adapter.ts` | 🟢 **ACTIVE** | Yeni N11 entegrasyonu | EventBus | N11 V2 |

### 3.4 ACTIVE Provider Servisleri

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/providers/*` (8 dosya) | 🟢 **ACTIVE** | `routes/actions.ts` | Route: `/actions` | Veri sağlayıcıları |

### 3.5 ACTIVE XML Servisleri

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/xml-engine/*` (9 dosya) | 🟢 **ACTIVE** | `routes/xml-engine.ts` (ARCHIVE) | **KULLANILMIYOR** | ARCHIVE olmalı |
| `services/xmlv2/*` (4 dosya) | 🟢 **ACTIVE** | `routes/xmlv2.ts` (ARCHIVE) | **KULLANILMIYOR** | ARCHIVE olmalı |

### 3.6 ACTIVE Diğer Servisler

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `services/audit/AuditService.ts` | 🟢 ACTIVE | `routes/index.ts` | Route: `/audit-logs` | Denetim logları |
| `services/finance/FinanceTrigger.ts` | 🟢 ACTIVE | `financeEngine.ts` | Finance engine | Finans tetikleyici |
| `services/operation/*` (5 dosya) | 🟢 ACTIVE | `routes/operations.ts` (ARCHIVE) | **KULLANILMIYOR** | ARCHIVE olmalı |
| `services/stockProtection/*` (7 dosya) | 🟢 **ACTIVE** | `routes/stockProtection.ts` (ARCHIVE) | **KULLANILMIYOR** | ARCHIVE olmalı |
| `services/trendyol/*` (2 dosya) | 🟢 ACTIVE | `routes/trendyol.ts` (ARCHIVE) | **KULLANILMIYOR** | ARCHIVE olmalı |

---

## 4. VARYANT MOTOR ENVANTERİ (ÖZEL)

| Motor | Dosya(lar) | Satır | Çağıran Route | Sınıf | Açıklama |
|-------|-----------|-------|---------------|-------|----------|
| **V1** | `services/variantEngine.ts` | ~150 | `routes/variants.ts` → `/variants` | 🟡 **LEGACY** | **Halen aktif!** `/variants` route'u V1'i kullanıyor |
| **V2** | `services/variantEngineV2.ts` | ~200 | `routes/variantsV2.ts` → `/variants/v2` | 🟡 **LEGACY** | Geriye uyum için tutuluyor |
| **V4** | `services/variantEngineV4/` (2 dosya) | ~250 | `routes/variantsV4.ts` → `/variants/v4` | 🟡 **LEGACY** | Geriye uyum |
| **V5** | `services/variantEngineV5/` (15 dosya) | ~1700 | `routes/variantsV5.ts` → `/variants/v5` | 🟢 **ACTIVE** | **Yeni nesil varyant motoru** |
| **XML-V2** | `services/xmlv2/VariantEngineV2.ts` | 332 | `routes/xmlv2.ts` (ARCHIVE) | 🔵 **ARCHIVE** | XML içi varyant |

---

## 5. WEB FRONTEND — `apps/web/src/`

### 5.1 App.tsx (Router)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `App.tsx` | 🟢 ACTIVE | `main.tsx` | React DOM | **Ana uygulama** |
| `main.tsx` | 🟢 ACTIVE | `index.html` | Vite | Entry point |
| `types.ts` | 🟢 ACTIVE | Birden çok sayfa | Import | Tip tanımları |

### 5.2 Kullanılan Sayfalar (ACTIVE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `pages/Dashboard.tsx` | 🟢 ACTIVE | `App.tsx` satır 69 | `kontrol` | Kontrol paneli |
| `pages/XmlSources.tsx` | 🟢 ACTIVE | `App.tsx` satır 71 | `xml` | XML kaynakları |
| `pages/ProductPool.tsx` | 🟢 ACTIVE | `App.tsx` satır 73 | `urunhavuzu` | Ürün havuzu |
| `pages/ProductPreparation.tsx` | 🟢 ACTIVE | `App.tsx` satır 75 | `urunhazirlama` | Ürün hazırlama |
| `pages/ReadyToSend.tsx` | 🟢 ACTIVE | `App.tsx` satır 77 | `gonderimehazir` | Gönderime hazır |
| `pages/VariantExceptionScreen.tsx` | 🟢 ACTIVE | `App.tsx` satır 79 | `varyant` | Varyant istisna |
| `pages/MarketplaceManagement.tsx` | 🟢 ACTIVE | `App.tsx` satır 81 | `pazaryeri` | Pazaryeri yönetimi |
| `pages/Orders.tsx` | 🟢 ACTIVE | `App.tsx` satır 83 | `siparis` | Siparişler |
| `pages/Reports.tsx` | 🟢 ACTIVE | `App.tsx` satır 85 | `rapor` | Raporlar |
| `pages/Settings.tsx` | 🟢 ACTIVE | `App.tsx` satır 87 | `ayar` | Ayarlar |
| `pages/Login.tsx` | 🟢 ACTIVE | `App.tsx` satır 94 | Login state | Giriş |

### 5.3 Kullanılmayan Sayfalar (DELETE CANDIDATE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `pages/AuditLogs.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Automation.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Brands.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Categories.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/DataHealthCenter.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Finance.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/ListingEngineV2.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK (1212 satır!)** |
| `pages/Marketplace.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/MarketplaceIntegration.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/MarketplaceOperations.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Messages.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Notifications.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Orchestrator.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Products.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/ProviderTestCenter.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Shipments.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Templates.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Users.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/Variants.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/VariantReviewV5.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `pages/XmlEnginePanel.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK (712 satır!)** |

### 5.4 Kullanılmayan Componentler

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `components/Categories.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `components/Dashboard.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `components/Marketplaces.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `components/Products.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |
| `components/Suppliers.tsx` | 🔴 **DELETE** | Hiçbiri | Hiçbiri | **YOK** |

### 5.5 Kullanılan Componentler (ACTIVE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `components/ErrorBoundary.tsx` | 🟢 ACTIVE | `App.tsx` | `App.tsx` satır 108 | Hata yakalama |
| `components/Layout/Header.tsx` | 🟢 ACTIVE | `App.tsx` | `App.tsx` satır 101 | Header |
| `components/Layout/Sidebar.tsx` | 🟢 ACTIVE | `App.tsx` | `App.tsx` satır 99 | Sidebar menü |
| `components/ui/KpiCard.tsx` | 🟢 ACTIVE | `Dashboard.tsx` | Dashboard | KPI kartı |
| `components/ui/Modal.tsx` | 🟢 ACTIVE | Birden çok sayfa | Import | Modal |
| `components/ui/Toast.tsx` | 🟢 ACTIVE | Birden çok sayfa | Import | Toast bildirim |

### 5.6 Kullanılan Hook'lar ve Lib'ler

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `hooks/useDebounce.ts` | 🟢 ACTIVE | Sayfalar | Import | Debounce |
| `hooks/useKeyboard.ts` | 🟢 ACTIVE | Sayfalar | Import | Klavye kısayol |
| `hooks/useTheme.ts` | 🟢 ACTIVE | `App.tsx` | `App.tsx` satır 16 | Tema |
| `lib/api.ts` | 🟢 ACTIVE | Tüm sayfalar | Import | **API istemci** |
| `lib/constants.ts` | 🟢 ACTIVE | Sayfalar | Import | Sabitler |
| `lib/design-system.tsx` | 🟢 ACTIVE | Sayfalar | Import | **Tasarım sistemi** |
| `lib/theme-context.tsx` | 🟢 ACTIVE | Sayfalar | Import | Tema context |
| `lib/theme-styles.ts` | 🟢 ACTIVE | Sayfalar | Import | Tema stilleri |
| `lib/utils.ts` | 🟢 ACTIVE | Sayfalar | Import | Yardımcı fonksiyonlar |
| `styles/theme.css` | 🟢 ACTIVE | `App.tsx` | `App.tsx` satır 17 | Tema CSS |

### 5.7 Prep Alt Bileşenleri (ACTIVE)

| Dosya | Sınıf | Kullanan | Çağıran | Workflow Etkisi |
|-------|-------|----------|---------|-----------------|
| `pages/prep/PrepProductRow.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Ürün hazırlama satırı |
| `pages/prep/PrepStatusBadge.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Durum rozeti |
| `pages/prep/PrepSummary.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Özet |
| `pages/prep/types.ts` | 🟢 ACTIVE | Prep bileşenleri | Import | Tipler |
| `pages/prep/BrandMatchTab.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Marka eşleştirme |
| `pages/prep/CategoryMatchTab.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Kategori eşleştirme |
| `pages/prep/ListingTemplateTab.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Şablon eşleştirme |
| `pages/prep/VariantMatchTab.tsx` | 🟢 ACTIVE | `ProductPreparation.tsx` | ProductPreparation | Varyant eşleştirme |

---

## 6. İKİNCİL PROJELER

### 6.1 `backend/` (NestJS) — Tümü ARCHIVE

| Özellik | Sınıf | Açıklama |
|---------|-------|----------|
| **Tüm dosyalar** | 🔵 **ARCHIVE** | Express API ile tam çakışma |
| `backend/src/main.ts` | 🔵 ARCHIVE | NestJS entry point |
| `backend/src/modules/*` (20 modül) | 🔵 ARCHIVE | Auth, brands, categories, finance, orders, products, users, variants... Hepsi `apps/server/`'de var |
| `backend/Dockerfile` | 🔵 ARCHIVE | İkinci Docker imajı |

### 6.2 `frontend/` (Next.js) — Tümü ARCHIVE

| Özellik | Sınıf | Açıklama |
|---------|-------|----------|
| **Tüm dosyalar** | 🔵 **ARCHIVE** | React+Vite ile çakışma |
| `frontend/src/app/admin/*` (20+ sayfa) | 🔵 ARCHIVE | Admin paneli — `apps/web/`'de de var |
| `frontend/src/app/page.tsx` | 🔵 ARCHIVE | Storefront ana sayfa |
| `frontend/Dockerfile` | 🔵 ARCHIVE | İkinci Docker imajı |

---

## 7. ÖZET İSTATİSTİKLER

| Sınıf | Dosya Sayısı |
|-------|-------------|
| 🟢 **ACTIVE** | ~100 dosya |
| 🟡 **LEGACY** | ~10 dosya (varyant V1/V2/V4, workflow V1, listing V1) |
| 🔵 **ARCHIVE** | ~80 dosya (backend/, frontend/, 21 route, eski servisler) |
| 🔴 **DELETE_CANDIDATE** | ~30 dosya (23 React sayfası, 5 component, 5 route) |

### Kritik Bulgu: Varyant V1 Hâlâ Aktif

**`routes/variants.ts`** (1386 satır) hâlâ **`services/variantEngine.ts`** (V1)'i kullanıyor.
Bu route `/variants` path'ine bağlı ve en çok kullanılan endpoint'lerden biri.
V5 olmasına rağmen V1 hâlada ana route'da.

### Önerilen Sıralama

1. **Hemen**: 23 ölü React sayfasını ve 5 ölü component'i sil (DELETE_CANDIDATE)
2. **Hemen**: 5 DELETE_CANDIDATE route'u sil (`dashboard.ts`, `marketplaceTest.ts`, `orders.ts`, `system.ts`)
3. **Kısa**: Varyant V1'den V5'e geçiş yap, `routes/variants.ts`'i `services/variantEngineV5/`'e bağla
4. **Kısa**: 16 ARCHIVE route'u `archive/` klasörüne taşı
5. **Orta**: `backend/` ve `frontend/` projelerini ayrı repo'ya taşı veya sil
6. **Orta**: `marketplace/` (eski) vs `marketplaces/` (yeni) birleştirme
7. **Uzun**: `xmlImport.ts` + `xml-engine/` + `xmlv2/` birleştirme
