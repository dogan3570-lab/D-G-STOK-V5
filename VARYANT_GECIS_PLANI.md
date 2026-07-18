# Varyant Motoru Geçiş Planı: V1 → V5

**Hedef:** `/variants` endpoint'inin V5 motorunu kullanması, V1'in `archive/` altına taşınması.

---

## 1. Mevcut Durum Analizi

### 1.1 Varyant Motoru Sürümleri

| Sürüm | Servis | Route | Path | Durum |
|-------|--------|-------|------|-------|
| **V1** | `services/variantEngine.ts` (853 satır) | `routes/variants.ts` (1386 satır) | `/variants` | 🟡 LEGACY — **Ana route'da aktif** |
| **V2** | `services/variantEngineV2.ts` (~350 satır) | `routes/variantsV2.ts` | `/variants/v2` | 🟡 LEGACY — **Frontend hala kullanıyor** |
| **V4** | `services/variantEngineV4/` (2 dosya) | `routes/variantsV4.ts` | `/variants/v4` | 🟡 LEGACY — Geriye uyum |
| **V5** | `services/variantEngineV5/` (15 dosya, ~1700 satır) | `routes/variantsV5.ts` | `/variants/v5` | 🟢 ACTIVE — Yeni nesil |

### 1.2 V1 Export'ları (services/variantEngine.ts)

`routes/variants.ts` tarafından kullanılan fonksiyonlar:

| Fonksiyon | routes/variants.ts'de Kullanımı | Endpoint |
|-----------|--------------------------------|----------|
| `extractParentSku()` | `/vcm/stats`, `/vcm/parent-products`, `/vcm/parent-products/:sku/children`, `/vcm/scan` | Gruplama |
| `detectVariantsFromText()` | `aiSuggestVariants()` üzerinden | AI tespit |
| `aiSuggestVariants()` | `/vcm/detect` | AI öneri |
| `groupProductsByParent()` | `/vcm/parent-products` | Gruplama |
| `validateProduct()` | `/vcm/validate` | Doğrulama |
| `batchValidate()` | Kullanılmıyor (export edilmiş) | — |
| `getMarketplaceRules()` | Kullanılmıyor (export edilmiş) | — |
| `getVariantStats()` | `/vcm/live-stats` | İstatistik |
| `mapVariantValue()` | `/vcm/map-value` | Değer eşleme |
| `scanForVariantGroups()` | Kullanılmıyor (export edilmiş) | — |
| `detectVariantsFromSku()` | `/vcm/detect` | SKU tespit |
| `normalizeVariantValue()` | Kullanılmıyor (export edilmiş) | — |
| `detectVariantType()` | Kullanılmıyor (export edilmiş) | — |

### 1.3 V1 Route Endpoint'leri (routes/variants.ts)

**Grup 1 — VCM (Variant Mapping Center) — 15 endpoint**

| # | Method | Path | Açıklama |
|---|--------|------|----------|
| 1 | GET | `/variants/vcm/stats` | İstatistik dashboard |
| 2 | GET | `/variants/vcm/parent-products` | Parent ürün listesi |
| 3 | GET | `/variants/vcm/parent-products/:parentSku/children` | Alt varyantlar |
| 4 | GET | `/variants/vcm/marketplace-rules/:key` | Pazaryeri kuralları |
| 5 | POST | `/variants/vcm/ai-suggest-batch` | AI toplu öneri |
| 6 | POST | `/variants/vcm/batch-apply` | Toplu varyant uygula |
| 7 | POST | `/variants/vcm/validate` | Doğrulama |
| 8 | POST | `/variants/vcm/scan` | Varyant grubu tarama |
| 9 | POST | `/variants/vcm/ai-auto-apply` | AI otomatik uygulama |
| 10 | POST | `/variants/vcm/test` | Test merkezi |
| 11 | GET | `/variants/vcm/marketplaces` | Pazaryeri listesi |
| 12 | GET | `/variants/vcm/live-stats` | Canlı istatistik |
| 13 | POST | `/variants/vcm/map-value` | Değer eşleme |
| 14 | POST | `/variants/vcm/detect` | Varyant tespit |
| 15 | POST | `/variants/vcm/seed-rules` | Kural tohumlama |

**Grup 2 — Klasik CRUD — 15 endpoint**

| # | Method | Path | Açıklama |
|---|--------|------|----------|
| 16 | GET | `/variants/stats` | Basit istatistik |
| 17 | GET | `/variants/unmatched-products` | Eşleşmemiş ürünler |
| 18 | POST | `/variants/batch` | Toplu varyant ekle |
| 19 | POST | `/variants/auto-detect` | Otomatik tespit |
| 20 | POST | `/variants/bulk-match` | Toplu eşleştirme |
| 21 | GET | `/variants/xml-variants` | XML varyant tespit |
| 22 | GET | `/variants/` | Varyant listesi |
| 23 | GET | `/variants/types` | Varyant tipleri |
| 24 | POST | `/variants/` | Varyant oluştur |
| 25 | PUT | `/variants/:id` | Varyant güncelle |
| 26 | DELETE | `/variants/:id` | Varyant sil |
| 27 | GET | `/variants/logs` | Varyant logları |
| 28 | POST | `/variants/ai-suggest` | AI öneri |
| 29 | GET | `/variants/universal-attributes` | Evrensel nitelikler |
| 30 | GET | `/variants/marketplace-attributes/:key` | Pazaryeri nitelikleri |
| 31 | POST | `/variants/bulk-ai-suggest` | Toplu AI öneri |

### 1.4 V5 Route Endpoint'leri (routes/variantsV5.ts)

| # | Method | Path | Açıklama |
|---|--------|------|----------|
| 1 | POST | `/variants/v5/run` | Pipeline çalıştır |
| 2 | POST | `/variants/v5/run/:xmlSourceId` | XML kaynağı için pipeline |
| 3 | GET | `/variants/v5/decide/:productId` | Ürün kararı |
| 4 | GET | `/variants/v5/decide/:productId/history` | Karar geçmişi |
| 5 | GET | `/variants/v5/category/:categoryId` | Kategori yapılandırması |
| 6 | PUT | `/variants/v5/category/:categoryId` | Kategori yapılandırma güncelle |

**V5 export'ları (services/variantEngineV5/index.ts):**

| Fonksiyon | Açıklama |
|-----------|----------|
| `runV5Pipeline(xmlSourceId?)` | Ana pipeline — tüm ürünleri işler |
| `resumeV5Pipeline(stateId)` | Kaldığı yerden devam |
| `decideProduct(prismaProduct)` | Tek ürün için varyant kararı |
| `decideProductById(productId)` | ID ile ürün kararı |
| `getCategoryConfig(categoryId)` | Kategori varyant yapılandırması |
| `updateCategoryVariantConfig(...)` | Kategori yapılandırma güncelle |
| `clearCategoryCache()` | Önbellek temizleme |
| `extractVariantsFromProduct(product)` | Üründen varyant çıkarma |
| `getDecisionHistory(productId)` | Karar geçmişi |
| `getCacheSize()` | Önbellek boyutu |

---

## 2. Frontend Bağımlılıkları

### 2.1 Kullanılan Sayfalar ve Çağırdıkları Endpoint'ler

| Sayfa | Kullandığı Endpoint | Motor |
|-------|---------------------|-------|
| `VariantExceptionScreen.tsx` | `GET /variants/v2/stats` | **V2** |
| `VariantExceptionScreen.tsx` | `GET /variants/v2/screen` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/auto-match` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/confirm-auto-match` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/manual-match` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/approve-selected` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/reanalyze` | **V2** |
| `VariantExceptionScreen.tsx` | `POST /variants/v2/scan` | **V2** |
| `ProductPreparation.tsx` | `product.variantMatch` alanını okur | DB (Prisma) |
| `Dashboard.tsx` (tahmini) | `GET /dashboard/stats` (variantCount) | Dolaylı |

### 2.2 Frontend'in KULLANMADIĞI V1 Endpoint'leri

V1'deki 31 endpoint'in **sadece 1 tanesi** (`/variants/v2/stats`) frontend tarafından kullanılıyor olabilir. 
Ancak frontend `VariantExceptionScreen.tsx` **doğrudan V2'yi** (`/variants/v2/*`) çağırıyor, V1'i değil.

**Frontend V1'i kullanmıyor.**

---

## 3. Workflow Bağımlılıkları

Workflow, varyant motorunu **doğrudan çağırmaz**. Sadece:

| Dosya | İlişki |
|-------|--------|
| `services/workflow/WorkflowEngine.ts` | `stepVariant` state alanını tanımlar |
| `services/workflow/WorkflowStateManager.ts` | `VARIANT` adımını workflow zincirinde bir adım olarak yönetir |
| `services/workflow/EventListeners.ts` | `VariantMatchChanged` event pullar |
| `routes/workflowState.ts` | `triggerModule: 'VARIANT'` ile state günceller |

**Workflow, herhangi bir varyant motoru sürümüne bağlı değildir.** Sadece `product.variantMatch` boolean alanını ve workflow state tablosundaki `stepVariant` alanını kullanır.

---

## 4. Diğer Bağımlılıklar

### 4.1 xmlImport.ts — V2'yi Dynamic Import ile Kullanıyor

```typescript
const { analyzeAllProducts } = await import('./variantEngineV2.ts');
```

Bu import `services/variantEngineV2.ts`'den V2 fonksiyonlarını çağırıyor. V2 kaldırılırsa bu import patlar.

### 4.2 xmlv2.ts — xmlv2/VariantEngineV2'yi Kullanıyor

```typescript
import { analyzeVariantV2, isVariantEngineV2Enabled } from '../services/xmlv2/VariantEngineV2.ts';
```

Bu ayrı bir V2 implementasyonu (`services/xmlv2/` içinde), `services/variantEngineV2.ts` ile karıştırılmamalı.

---

## 5. V1 Kaldırılırsa Etkilenen Modüller

| Modül | Etki | Açıklama |
|-------|------|----------|
| `routes/variants.ts` | 🔴 **DOĞRUDAN** | Tüm import'ları V1'den geliyor, 31 endpoint çalışmaz |
| `services/variantEngine.ts` | 🔴 **SİLİNİR** | V1 motoru |
| `routes/index.ts` | 🟡 **Import güncellemesi** | `variantsRoutes` yerine V5 route'u bağlanmalı |
| `frontend` (VariantExceptionScreen) | 🟢 **ETKİLENMEZ** | V2 kullanıyor, V1 değil |
| `Workflow` | 🟢 **ETKİLENMEZ** | Sadece state alanı, motor çağırmıyor |
| `xmlImport.ts` | 🟡 **KONTROL GEREKLİ** | V2'yi import ediyor, V1 değil |
| `VariantExceptionScreen.tsx` | 🟡 **KONTROL GEREKLİ** | V2 kullanıyor, geçiş planı V2'yi de kapsamalı |

---

## 6. V5'i `/variants` Path'ine Geçirme Planı

### Adım 1: V5'te Eksik CRUD Endpoint'lerini Ekle

V5'te şu anda sadece 6 endpoint var. Aşağıdaki CRUD endpoint'leri V5'e eklenmeli:

```typescript
// routes/variantsV5.ts'e eklenecek yeni endpoint'ler:

// Mevcut CRUD (şu anda V1'de olan):
GET    /variants                   → Varyant listesi (sayfalanmış, filtreli)
GET    /variants/stats             → İstatistikler
GET    /variants/types             → Varyant tipleri
GET    /variants/logs              → Varyant logları
POST   /variants/                  → Varyant oluştur
PUT    /variants/:id               → Varyant güncelle
DELETE /variants/:id               → Varyant sil
POST   /variants/batch             → Toplu varyant ekle
POST   /variants/bulk-match        → Toplu eşleştirme
POST   /variants/auto-detect       → Otomatik tespit
POST   /variants/ai-suggest        → AI öneri
POST   /variants/bulk-ai-suggest   → Toplu AI öneri
GET    /variants/unmatched-products → Eşleşmemiş ürünler
GET    /variants/xml-variants      → XML varyant tespit

// VCM endpoint'leri (V1'den taşınacak):
GET    /variants/vcm/stats
GET    /variants/vcm/parent-products
POST   /variants/vcm/scan
POST   /variants/vcm/detect
POST   /variants/vcm/batch-apply
POST   /variants/vcm/validate
// ... diğer VCM endpoint'leri
```

### Adım 2: Frontend V2 → V5 Geçişi

`VariantExceptionScreen.tsx` şu anda V2 endpoint'lerini çağırıyor:

| V2 Endpoint | V5 Karşılığı | Aksiyon |
|-------------|-------------|---------|
| `GET /variants/v2/stats` | `GET /variants/v5/...` (yok) | V5'e benzer endpoint ekle |
| `GET /variants/v2/screen` | `GET /variants/v5/...` (yok) | V5'e benzer endpoint ekle |
| `POST /variants/v2/auto-match` | `POST /variants/v5/run` | V5 pipeline ile değiştir |
| `POST /variants/v2/scan` | `POST /variants/v5/run` | V5 pipeline ile değiştir |
| Diğer V2 endpoint'leri | V5 pipeline + decision | Tek tek eşle |

### Adım 3: routes/index.ts Güncellemesi

```typescript
// routes/index.ts'deki değişiklik:

// ESKİ (V1):
import variantsRoutes from './variants.ts';
router.use('/variants', variantsRoutes);

// YENİ (V5):
import variantsV5Router from './variantsV5.ts';
router.use('/variants', variantsV5Router);
```

### Adım 4: xmlImport.ts Güncellemesi

```typescript
// ESKİ:
const { analyzeAllProducts } = await import('./variantEngineV2.ts');

// YENİ:
const { runV5Pipeline } = await import('./variantEngineV5/index.ts');
```

### Adım 5: V1 Motoru Archive'e Taşı

```
services/variantEngine.ts          → archive/services/variantEngine.ts
routes/variants.ts                 → archive/routes/variants.ts
services/variantEngineV2.ts        → archive/services/variantEngineV2.ts
routes/variantsV2.ts               → archive/routes/variantsV2.ts
services/variantEngineV4/          → archive/services/variantEngineV4/
routes/variantsV4.ts               → archive/routes/variantsV4.ts
```

---

## 7. Değişiklik Listesi (Özet)

### 🔴 Yapılması Gereken Kod Değişiklikleri

| # | Dosya | Değişiklik |
|---|-------|-----------|
| 1 | `routes/variantsV5.ts` | **~15 yeni CRUD endpoint** ekle (V1'deki 31 endpoint'in V5 versiyonu) |
| 2 | `routes/index.ts` | `variantsRoutes` import'unu `variantsV5Router` ile değiştir |
| 3 | `routes/index.ts` | `router.use('/variants', ...)` hedefini V5'e çevir |
| 4 | `services/variantEngineV5/index.ts` | Gerekirse yeni fonksiyonlar ekle (CRUD destek) |
| 5 | `services/xmlImport.ts` | `analyzeAllProducts` import'unu V5 pipeline ile değiştir |
| 6 | `apps/web/src/pages/VariantExceptionScreen.tsx` | V2 endpoint'lerini V5 karşılıklarıyla değiştir |

### 🟢 Değişiklik Gerektirmeyenler

| Modül | Neden |
|-------|-------|
| Workflow (`services/workflow/`) | Varyant motoruna doğrudan bağlı değil |
| `routes/workflowState.ts` | Sadece `stepVariant` state alanını kullanır |
| `routes/workflow.ts` | Sadece `product.variantMatch` sayar |
| `apps/web/src/pages/ProductPreparation.tsx` | Sadece `product.variantMatch` alanını okur |
| `apps/web/src/pages/Dashboard.tsx` | Dolaylı, `GET /dashboard/stats` üzerinden |

### 🔵 Taşınacak Dosyalar (archive/)

| Dosya | Yeni Konum |
|-------|-----------|
| `services/variantEngine.ts` | `archive/services/variantEngine.ts` |
| `routes/variants.ts` | `archive/routes/variants.ts` |
| `services/variantEngineV2.ts` | `archive/services/variantEngineV2.ts` |
| `routes/variantsV2.ts` | `archive/routes/variantsV2.ts` |
| `services/variantEngineV4/` | `archive/services/variantEngineV4/` |
| `routes/variantsV4.ts` | `archive/routes/variantsV4.ts` |

---

## 8. İşlem Sırası

```
Adım 0: V5'e CRUD endpoint'leri ekle (kod yazma)
Adım 1: routes/index.ts'de V1 → V5 değişikliği
Adım 2: xmlImport.ts'de V2 → V5 değişikliği
Adım 3: Frontend V2 → V5 endpoint güncellemesi
Adım 4: V5 test (tüm /variants endpoint'leri çalışıyor mu?)
Adım 5: Eski motorları archive/ klasörüne taşı
Adım 6: Final test
```

---

## 9. Risk Değerlendirmesi

| Risk | Seviye | Açıklama |
|------|--------|----------|
| V5'te CRUD endpoint yok | 🔴 **KRİTİK** | 15+ endpoint yazılmalı, V1'deki mantık V5'e taşınmalı |
| Frontend V2 kullanıyor | 🟡 **ORTA** | VariantExceptionScreen sayfası V2'ye bağlı, V5 karşılığı yok |
| xmlImport.ts V2 kullanıyor | 🟢 **DÜŞÜK** | Dynamic import, V5 pipeline ile değiştirilebilir |
| Veritabanı şeması değişmiyor | 🟢 **YOK** | V1, V2, V4, V5 aynı Prisma şemasını kullanıyor |
| Workflow etkilenmez | 🟢 **YOK** | Sadece state alanı, motor çağırmıyor |

---

## 10. Karar: Tek Adımda mı Kademeli mi?

**Öneri: Kademeli geçiş**

1. **Önce** V5'e CRUD endpoint'leri ekle (V1'deki iş mantığını V5'e taşı)
2. **Sonra** `routes/index.ts`'de V1 → V5 değişikliği yap
3. **En son** eski motorları archive'e taşı

Bu sayede her adımda sistem çalışır durumda kalır.
