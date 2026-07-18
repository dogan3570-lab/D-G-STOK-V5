# Variant V5 — Tek Varyant Platformu Geçiş Mimarisi

**Amaç:** V1, V2 ve V5'i tek sistem altında birleştirmek, `/variants` endpoint'ini V5'e taşımak.

---

## A) ENDPOINT EŞLEME TABLOSU

### A.1 V1 → V2 → V5 Eşlemesi

#### GRUP 1: CRUD İşlemleri (Temel)

| # | V1 (routes/variants.ts) | V2 (routes/variantsV2.ts) | V5 (routes/variantsV5.ts) | Yeni V5 Karşılığı |
|---|------------------------|--------------------------|--------------------------|-------------------|
| 1 | `GET /variants/` | — | — | `GET /variants` **EKLENECEK** |
| 2 | `GET /variants/:id` | — | — | `GET /variants/:id` **EKLENECEK** |
| 3 | `POST /variants/` | — | — | `POST /variants` **EKLENECEK** |
| 4 | `PUT /variants/:id` | — | — | `PUT /variants/:id` **EKLENECEK** |
| 5 | `DELETE /variants/:id` | — | — | `DELETE /variants/:id` **EKLENECEK** |
| 6 | `GET /variants/types` | — | — | `GET /variants/types` **EKLENECEK** |
| 7 | `GET /variants/logs` | — | — | Var: `GET /variants/decide/:id/history` |

#### GRUP 2: Varyant Tespit ve Analiz

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 8 | `POST /variants/auto-detect` | `POST /variants/v2/scan` | `POST /variants/v5/run` | Var: `POST /variants/run` |
| 9 | `POST /variants/ai-suggest` | — | — | `POST /variants/ai-suggest` **EKLENECEK** |
| 10 | `POST /variants/bulk-ai-suggest` | — | — | `POST /variants/bulk-ai-suggest` **EKLENECEK** |
| 11 | `POST /variants/vcm/ai-suggest-batch` | — | — | — (üstteki ile birleşir) |
| 12 | `POST /variants/vcm/detect` | — | `GET /variants/v5/decide/:productId` | Var |
| 13 | `POST /variants/vcm/scan` | `POST /variants/v2/scan` | — | `POST /variants/scan` **EKLENECEK** |
| 14 | `POST /variants/vcm/ai-auto-apply` | `POST /variants/v2/auto-match` | — | `POST /variants/auto-apply` **EKLENECEK** |

#### GRUP 3: Varyant Eşleştirme

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 15 | `POST /variants/batch` | — | — | `POST /variants/batch` **EKLENECEK** |
| 16 | `POST /variants/bulk-match` | — | — | `POST /variants/bulk-match` **EKLENECEK** |
| 17 | `POST /variants/vcm/batch-apply` | — | — | Var: `POST /variants/run` |
| 18 | — | `POST /variants/v2/manual-match` | — | `POST /variants/manual-match` **EKLENECEK** |
| 19 | — | `POST /variants/v2/confirm-auto-match` | — | `POST /variants/confirm-match` **EKLENECEK** |
| 20 | — | `POST /variants/v2/approve-selected` | — | `POST /variants/approve` **EKLENECEK** |
| 21 | — | `POST /variants/v2/reanalyze` | — | `POST /variants/reanalyze` **EKLENECEK** |

#### GRUP 4: İstatistik ve Dashboard

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 22 | `GET /variants/stats` | `GET /variants/v2/stats` | — | `GET /variants/stats` **EKLENECEK** |
| 23 | `GET /variants/vcm/stats` | — | — | — (üstteki ile birleşir) |
| 24 | `GET /variants/vcm/live-stats` | — | — | — (üstteki ile birleşir) |
| 25 | `GET /variants/vcm/parent-products` | — | — | `GET /variants/parent-products` **EKLENECEK** |
| 26 | `GET /variants/vcm/parent-products/:sku/children` | — | — | `GET /variants/parent/:sku/children` **EKLENECEK** |

#### GRUP 5: İstisna Ekranı (VariantExceptionScreen)

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 27 | — | `GET /variants/v2/screen` | — | `GET /variants/screen` **EKLENECEK** |
| 28 | — | `GET /variants/v2/problems` | — | `GET /variants/problems` **EKLENECEK** |
| 29 | `GET /variants/xml-variants` | — | — | `GET /variants/xml-variants` **EKLENECEK** |
| 30 | `GET /variants/unmatched-products` | — | — | `GET /variants/unmatched` **EKLENECEK** |

#### GRUP 6: Yapılandırma

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 31 | `GET /variants/vcm/marketplace-rules/:key` | — | — | Var: `GET /variants/category/:categoryId` |
| 32 | `GET /variants/vcm/marketplaces` | — | — | — (global marketplaces) |
| 33 | `POST /variants/vcm/seed-rules` | — | — | Var: `PUT /variants/category/:categoryId` |
| 34 | `GET /variants/universal-attributes` | — | — | `GET /variants/attributes` **EKLENECEK** |
| 35 | `GET /variants/marketplace-attributes/:key` | — | — | `GET /variants/attributes/:marketplace` **EKLENECEK** |
| 36 | — | `GET /variants/v2/thresholds` | — | `GET /variants/thresholds` **EKLENECEK** |
| 37 | — | `PUT /variants/v2/thresholds` | — | `PUT /variants/thresholds` **EKLENECEK** |

#### GRUP 7: Doğrulama ve Test

| # | V1 | V2 | V5 | Yeni V5 Karşılığı |
|---|----|----|----|-------------------|
| 38 | `POST /variants/vcm/validate` | — | — | Var: V5 validator |
| 39 | `POST /variants/vcm/test` | — | — | `POST /variants/test` **EKLENECEK** |
| 40 | `POST /variants/vcm/map-value` | — | — | Var: V5 aiExtractor |
| 41 | `GET /variants/vcm/marketplace-rules/:key` | — | Var: `GET /variants/category/:categoryId` | Var |

---

## B) EKSİK ENDPOINT LİSTESİ

V5'te olmayan ve eklenmesi gereken endpoint'ler:

### B.1 CRUD İşlemleri (7 endpoint)

```typescript
// routes/variantsV5.ts'e eklenecek:

// Varyant CRUD
GET    /variants                    // Listele (sayfalanmış, filtreli)
GET    /variants/:id                // Tek varyant getir
POST   /variants                    // Varyant oluştur
PUT    /variants/:id                // Varyant güncelle
DELETE /variants/:id                // Varyant sil
GET    /variants/types              // Varyant tipleri (groupBy name)
GET    /variants/logs               // Varyant logları
```

### B.2 Toplu İşlemler (5 endpoint)

```typescript
POST   /variants/batch              // Toplu varyant ekle
POST   /variants/bulk-match         // Toplu eşleştirme
POST   /variants/auto-apply         // AI otomatik uygula (V1 vcm/ai-auto-apply)
POST   /variants/bulk-ai-suggest    // Toplu AI öneri
POST   /variants/batch-apply        // Toplu varyant uygula (V1 vcm/batch-apply)
```

### B.3 İstisna Ekranı (5 endpoint)

```typescript
GET    /variants/screen             // İstisna ekranı ürünleri (V2 /screen)
GET    /variants/problems           // Problem listesi (V2 /problems)
GET    /variants/unmatched          // Eşleşmemiş ürünler (V1 /unmatched-products)
GET    /variants/xml-variants       // XML varyant tespit (V1 /xml-variants)
GET    /variants/parent-products    // Parent ürün listesi (V1 /vcm/parent-products)
GET    /variants/parent/:sku/children // Alt varyantlar (V1 /vcm/parent-products/:sku/children)
```

### B.4 Manuel Eşleştirme (4 endpoint)

```typescript
POST   /variants/manual-match       // Manuel eşleştir (V2 /manual-match)
POST   /variants/confirm-match      // Otomatik eşleştirmeyi onayla (V2 /confirm-auto-match)
POST   /variants/approve            // Seçilenleri onayla (V2 /approve-selected)
POST   /variants/reanalyze          // Yeniden analiz (V2 /reanalyze)
```

### B.5 AI Önerileri (2 endpoint)

```typescript
POST   /variants/ai-suggest         // AI öneri (V1 /ai-suggest)
POST   /variants/ai-suggest-batch   // AI toplu öneri (V1 /vcm/ai-suggest-batch)
```

### B.6 İstatistik ve Dashboard (3 endpoint)

```typescript
GET    /variants/stats              // Ana istatistikler
GET    /variants/vcm-stats          // VCM istatistikleri (eski /vcm/stats)
GET    /variants/parent-products    // Parent ürün listesi (eski /vcm/parent-products)
```

### B.7 Yapılandırma (5 endpoint)

```typescript
GET    /variants/attributes         // Evrensel nitelikler (V1 /universal-attributes)
GET    /variants/attributes/:marketplace // Pazaryeri nitelikleri
GET    /variants/thresholds         // Eşik değerleri (V2 /thresholds)
PUT    /variants/thresholds         // Eşik değerlerini güncelle
POST   /variants/test               // Test merkezi (V1 /vcm/test)
```

### B.8 Toplam: 31 Yeni Endpoint

| Kategori | Adet |
|----------|------|
| CRUD | 7 |
| Toplu işlem | 5 |
| İstisna ekranı | 6 |
| Manuel eşleştirme | 4 |
| AI önerileri | 2 |
| İstatistik | 3 |
| Yapılandırma | 4 |
| **Toplam** | **31** |

---

## C) FRONTEND GEÇİŞ PLANI

### C.1 Frontend Sayfaları ve Kullandıkları Endpoint'ler

| Sayfa | Dosya | Şu An Kullandığı | V5 Hedef |
|-------|-------|-----------------|----------|
| **Varyant İstisna Ekranı** | `pages/VariantExceptionScreen.tsx` | `GET /variants/v2/stats` | `GET /variants/stats` |
| | | `GET /variants/v2/screen` | `GET /variants/screen` |
| | | `POST /variants/v2/auto-match` | `POST /variants/auto-apply` |
| | | `POST /variants/v2/confirm-auto-match` | `POST /variants/confirm-match` |
| | | `POST /variants/v2/manual-match` | `POST /variants/manual-match` |
| | | `POST /variants/v2/approve-selected` | `POST /variants/approve` |
| | | `POST /variants/v2/reanalyze` | `POST /variants/reanalyze` |
| | | `POST /variants/v2/scan` | `POST /variants/scan` |
| **Ürün Hazırlama** | `pages/ProductPreparation.tsx` | `product.variantMatch` (DB alanı) | Aynı (DB değişmez) |
| | | `product.variants[]` (ilişkisel) | Aynı |
| | | `d.pendingVariant` (summary) | `GET /variants/stats` |
| **Dashboard** | `pages/Dashboard.tsx` | `GET /dashboard/stats` (variantCount) | Aynı |
| **Reports** | `pages/Reports.tsx` | Varyant raporları | Aynı |
| **Workflow (arkaplan)** | `services/workflow/*` | `stepVariant` state alanı | Aynı |
| | | `VariantMatchChanged` event | Aynı |

### C.2 Frontend Değişiklik Listesi

```typescript
// VariantExceptionScreen.tsx'deki değişiklikler:

// ESKİ:
const res = await apiFetch('/variants/v2/stats');
const data = await apiFetch(`/variants/v2/screen?${params}`);
await apiFetch('/variants/v2/auto-match', { method: 'POST', body: { productIds } });

// YENİ:
const res = await apiFetch('/variants/stats');
const data = await apiFetch(`/variants/screen?${params}`);
await apiFetch('/variants/auto-apply', { method: 'POST', body: { productIds } });
```

### C.3 Etkilenmeyen Sayfalar

| Sayfa | Neden Etkilenmez |
|-------|-----------------|
| `Dashboard.tsx` | `GET /dashboard/stats` aynı kalır |
| `ProductPreparation.tsx` | Sadece `product.variantMatch` alanını okur |
| `Reports.tsx` | Kendi report endpoint'lerini kullanır |
| `Products.tsx` (ölü) | Kullanılmıyor |

---

## D) GEÇİŞ SONRASI MİMARİ

### D.1 Katmanlı Mimari

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│  (VariantExceptionScreen, ProductPreparation, vb.)  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (fetch)
                      ▼
┌─────────────────────────────────────────────────────┐
│              /variants (Express Router)              │
│                                                     │
│  routes/variantsV5.ts (GÜNCELLENMİŞ)                │
│  - CRUD: GET/POST/PUT/DELETE /variants              │
│  - Pipeline: POST /variants/run                     │
│  - AI: POST /variants/ai-suggest                    │
│  - Screen: GET /variants/screen                     │
│  - Match: POST /variants/manual-match               │
│  - Stats: GET /variants/stats                       │
│  - Config: GET/PUT /variants/thresholds             │
└─────────────────────┬───────────────────────────────┘
                      │ Fonksiyon çağrısı
                      ▼
┌─────────────────────────────────────────────────────┐
│         services/variantEngineV5/index.ts           │
│                 (PUBLIC API)                        │
│                                                     │
│  runV5Pipeline()     decideProductById()            │
│  extractVariants()   getDecisionHistory()           │
│  getCategoryConfig() updateCategoryConfig()         │
│  + YENİ:                                            │
│  listVariants()      getVariant()                   │
│  createVariant()     updateVariant()                │
│  deleteVariant()     getVariantTypes()              │
│  getScreenProducts() getProblems()                  │
│  manualMatch()       autoApply()                    │
│  getStats()          getThresholds()                │
└───────┬─────────┬──────────┬──────────┬────────────┘
        │         │          │          │
        ▼         ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│ Pipeline │ │Decision│ │Category│ │ AI Extractor │
│ .run()   │ │Engine  │ │Engine  │ │ .analyze()   │
│ .resume()│ │.decide │ │.getConf│ │              │
└────┬─────┘ └───┬────┘ └───┬────┘ └──────┬───────┘
     │           │          │             │
     ▼           ▼          ▼             ▼
┌─────────────────────────────────────────────────────┐
│                  PRISMA / DB                         │
│                                                     │
│  product (variantMatch, variants[])                  │
│  variant (id, name, value, productId)                │
│  variantAnalysis (productId, confidence, status)     │
│  variantThreshold (key, value)                       │
│  categoryVariantConfig (categoryId, rules)           │
│  workflowState (stepVariant, readiness)              │
└─────────────────────┬───────────────────────────────┘
                      │ EventBus
                      ▼
┌─────────────────────────────────────────────────────┐
│              WORKFLOW ENTEGRASYONU                   │
│                                                     │
│  EventListeners.ts                                   │
│    └─ VariantMatchChanged → AutoRecalculation       │
│    └─ VariantMatchChanged → WorkflowState.update    │
│                                                     │
│  WorkflowStateManager.ts                            │
│    └─ stepVariant: 'OK' | 'MISSING' | 'ERROR'      │
│    └─ readiness: 0-100                              │
│                                                     │
│  AutoRecalculationEngine.ts                         │
│    └─ onProductChanged(productId, 'variant_match')  │
└─────────────────────────────────────────────────────┘
```

### D.2 Veri Akışı

```
1. Kullanıcı Frontend'de "Varyant Tara" butonuna tıklar
       │
       ▼
2. POST /variants/scan  (Express Router)
       │
       ▼
3. runV5Pipeline()  (V5 Engine Public API)
       │
       ▼
4. pipeline.run()  (V5 Pipeline)
       │
       ├─ Prisma: Tüm ürünleri çek
       ├─ categoryEngine: Kategori yapılandırmasını al
       ├─ decisionEngine: Her ürün için varyant kararı ver
       ├─ aiExtractor: AI ile varyant özelliklerini çıkar
       ├─ familyEngine: Varyant ailelerini oluştur
       ├─ validator: Doğrulama yap
       └─ logger: Kararları logla
       │
       ▼
5. Prisma: variantAnalysis tablosuna yaz
       │
       ▼
6. EventBus: 'VariantMatchChanged' event'i yayınla
       │
       ▼
7. EventListeners:    
       ├─ WorkflowStateManager → stepVariant güncelle
       ├─ AutoRecalculationEngine → yeniden hesaplama başlat
       └─ DashboardService → istatistikleri güncelle
```

### D.3 V5 Sub-Modül Sorumlulukları

| Modül | Dosya | Görevi | V1/V2 Karşılığı |
|-------|-------|--------|-----------------|
| **pipeline** | `pipeline.ts` | Tüm ürünleri sırayla işler, state yönetir | V1 scan + V2 analyzeAllProducts |
| **decisionEngine** | `decisionEngine.ts` | Kategori bazlı varyant kararı verir | V1 aiSuggestVariants + V2 smartAnalyze |
| **categoryEngine** | `categoryEngine.ts` | Kategori-varyant eşleme kuralları | V1 getMarketplaceRules |
| **aiExtractor** | `aiExtractor.ts` | AI ile varyant çıkarımı | V1 detectVariantsFromText + V2 analyzeProduct |
| **familyEngine** | `familyEngine.ts` | Varyant aile gruplaması | V1 groupProductsByParent |
| **validator** | `validator.ts` | Doğrulama kuralları | V1 validateProduct + batchValidate |
| **logger** | `logger.ts` | Karar loglama | V1 audit log |
| **cache** | `cache.ts` | Kategori önbelleği | — |
| **helpers** | `helpers.ts` | Dönüşüm yardımcıları | V1 extractParentSku + normalizeVariantValue |

### D.4 Yeni Eklenecek V5 Servis Fonksiyonları

```typescript
// services/variantEngineV5/index.ts'e eklenecek yeni fonksiyonlar:

// === CRUD ===
async function listVariants(filters, page, limit): Promise<{items, total}>
async function getVariant(id: string): Promise<Variant | null>
async function createVariant(data): Promise<Variant>
async function updateVariant(id: string, data): Promise<Variant>
async function deleteVariant(id: string): Promise<void>
async function getVariantTypes(): Promise<{name, count}[]>

// === Toplu İşlem ===
async function batchCreateVariants(items: Array<{productId, name, value}>): Promise<number>
async function bulkMatchProducts(matches): Promise<{total, errors}>
async function autoApplyVariants(productIds): Promise<{applied, skipped}>

// === İstisna Ekranı ===
async function getScreenProducts(filters): Promise<{items, total, stats}>
async function getProblems(filters): Promise<{items, total}>
async function getUnmatchedProducts(filters): Promise<{items, total}>
async function getParentProducts(filters): Promise<{items, total}>
async function getParentChildren(parentSku): Promise<children[]>

// === Manuel Eşleştirme ===
async function manualMatchProducts(matches): Promise<{matched, errors}>
async function confirmAutoMatch(matches): Promise<{updated}>
async function approveSelected(productIds, groupId?): Promise<{updated}>
async function reanalyzeProducts(productIds): Promise<{analyzed, errors}>

// === İstatistik ===
async function getVariantStats(xmlSourceId?): Promise<VariantStats>
async function getVcmStats(marketplaceKey?): Promise<VcmStats>

// === AI ===
async function aiSuggest(productId, title?, description?): Promise<Suggestion[]>
async function aiSuggestBatch(productIds): Promise<{productId, suggestions}[]>

// === Yapılandırma ===
async function getUniversalAttributes(marketplace?): Promise<Attribute[]>
async function getThresholds(): Promise<Record<string, number>>
async function updateThresholds(data): Promise<Record<string, number>>
```

---

## E) GEÇİŞ ADIMLARI

### E.1 Aşama 1: V5 CRUD ve İstisna Ekranı (Öncelikli)

1. `services/variantEngineV5/index.ts`'e CRUD fonksiyonlarını ekle
2. `services/variantEngineV5/` altına yeni `screenEngine.ts` ekle (istisna ekranı)
3. `services/variantEngineV5/` altına yeni `statsEngine.ts` ekle (istatistik)
4. `routes/variantsV5.ts`'e 31 yeni endpoint ekle
5. Frontend `VariantExceptionScreen.tsx`'de V2 → V5 endpoint değişikliği

### E.2 Aşama 2: Route Bağlantısı

1. `routes/index.ts`'de `import variantsRoutes from './variants.ts'` satırını değiştir
2. `router.use('/variants', variantsRouter)` hedefini V5'e çevir
3. `xmlImport.ts`'de V2 import'unu V5 pipeline ile değiştir

### E.3 Aşama 3: Eski Motorları Archive'e Taşı

1. `services/variantEngine.ts` → `archive/services/variantEngine.ts`
2. `routes/variants.ts` → `archive/routes/variants.ts`
3. `services/variantEngineV2.ts` → `archive/services/variantEngineV2.ts`
4. `routes/variantsV2.ts` → `archive/routes/variantsV2.ts`
5. `services/variantEngineV4/` → `archive/services/variantEngineV4/`
6. `routes/variantsV4.ts` → `archive/routes/variantsV4.ts`

### E.4 Aşama 4: Test ve Doğrulama

1. Tüm `/variants` endpoint'lerini test et
2. Frontend sayfalarını kontrol et
3. Workflow state geçişlerini doğrula
4. Dashboard istatistiklerini kontrol et

---

## F) VERİTABANI ŞEMASI (Değişmiyor)

V1, V2, V4 ve V5 aynı Prisma şemasını kullanır:

```prisma
model Product {
  variantMatch  Boolean   @default(false)
  variants      Variant[]
}

model Variant {
  id        String   @id @default(cuid())
  name      String   // Renk, Beden, Numara...
  value     String   // Siyah, M, 42...
  productId String
  product   Product  @relation(fields: [productId], references: [id])
}

model VariantAnalysis {
  id         String   @id
  productId  String
  confidence Int
  source     String   // AI_MATCH, MANUAL, PATTERN
  status     String   // AUTO_ACCEPTED, PENDING, REJECTED
  parentSku  String?
  groupId    String?
}

model VariantThreshold {
  key   String @id   // auto_accept, auto_suggest, manual
  value Int
}

model CategoryVariantConfig {
  categoryId String @id
  attributes Json   // V5 spesifik
}

model WorkflowState {
  stepVariant String @default("MISSING")  // Workflow ile bağlantı
}
```

---

## G) RİSK DEĞERLENDİRMESİ

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| V5 CRUD yazılırken hata | Orta | Yüksek | Tek tek endpoint test et |
| Frontend V2→V5 geçişinde URL hatası | Düşük | Yüksek | Tüm frontend sayfalarını test et |
| Workflow state bozulması | Düşük | Kritik | Aynı DB alanları kullanılır |
| xmlImport.ts'de V2 import'u unutulursa | Orta | Yüksek | Tüm import'ları kontrol et |
| Eski motorlar hemen silinirse | Düşük | Yüksek | Önce archive'e taşı, 1 ay sonra sil |

---

## H) ÖZET: NE EKLENECEK, NE DEĞİŞECEK

| İşlem | Dosya(lar) | Değişiklik |
|-------|-----------|-----------|
| **31 yeni endpoint** | `routes/variantsV5.ts` | Kod ekle |
| **11 yeni servis fonksiyonu** | `services/variantEngineV5/index.ts` | Kod ekle |
| **2 yeni alt modül** | `screenEngine.ts`, `statsEngine.ts` | Yeni dosya |
| **1 import değişikliği** | `routes/index.ts` | V1 → V5 |
| **1 import değişikliği** | `services/xmlImport.ts` | V2 → V5 |
| **9 endpoint değişikliği** | `VariantExceptionScreen.tsx` | V2 → V5 |
| **6 dosya taşıma** | archive/ klasörüne | V1, V2, V4 |
