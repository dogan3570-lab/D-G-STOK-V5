# Kategori Modülü Analiz ve İyileştirme Önerileri

**Tarih:** 2026-07-18
**Tür:** Sadece analiz — kod değişikliği yok

---

## 1. Mevcut Yapı Analizi

### 1.1 Backend (routes/categories.ts — 670 satır)

| Endpoint | İşlev | Durum |
|----------|-------|-------|
| `GET /categories/stats` | İstatistik KPI | ✅ Çalışıyor |
| `GET /categories/xml-categories` | XML kategori ağacı | ✅ Çalışıyor |
| `GET /categories/tree` | Sistem kategori ağacı | ✅ Çalışıyor |
| `GET /categories/marketplace-categories` | Pazaryeri kategorileri | ✅ Çalışıyor |
| `POST /categories/ai-match` | **AI eşleştirme** | ⚠️ Basit keyword matching |
| `POST /categories/bulk-match` | Toplu eşleştirme | ✅ Çalışıyor |
| `GET /categories/` | Kategori listesi | ✅ Çalışıyor |
| `GET /categories/products` | Kategorili ürünler | ✅ Çalışıyor |
| `GET /categories/unmatched-products` | Eşleşmemiş ürünler | ✅ Çalışıyor |
| `POST /categories/match` | Manuel eşleştirme | ✅ Çalışıyor |
| `POST /categories/unmatch` | Eşleştirme kaldırma | ✅ Çalışıyor |
| `POST /categories/` | Kategori oluştur | ✅ Çalışıyor |
| `CRUD /categories/mappings` | Kategori mapping yönetimi | ✅ Çalışıyor |
| `GET /categories/logs` | Denetim logları | ✅ Çalışıyor |
| `PUT /:id/move` | Sürükle-bırak taşıma | ✅ Çalışıyor |

### 1.2 Frontend (CategoryMatchTab.tsx — 317 satır)

| Çağrı | İşlev |
|-------|-------|
| `GET /categories/stats` | KPI istatistikleri |
| `GET /categories/products?uncategorized=true` | Eşleşmemiş ürün listesi |
| `GET /categories/tree?marketplaceId=X` | Kategori ağacı |
| `GET /marketplaces` | Pazaryeri listesi |
| `POST /categories/match` | Manuel kategori eşleştirme |
| `POST /categories/ai-match` | AI eşleştirme başlatma |

### 1.3 Bağlı Olduğu Servisler

| Servis | Bağlantı | Durum |
|--------|----------|-------|
| `EventBus` | `CategoryMatchChanged` event'i | ✅ Mevcut |
| `WorkflowState` | `stepCategory` alanı | ⚠️ Event işleniyor mu? |
| `AutoRecalculationEngine` | `onProductChanged` | ⚠️ Çağrılmıyor |
| `DashboardService` | İstatistik güncelleme | ⚠️ Entegre değil |
| `aiEngine.ts` / `aiCore/` | AI servisleri | ❌ **Kullanılmıyor** |

---

## 2. Tespit Edilen Eksiklikler

### 2.1 🔴 Kritik: AI Kategori Motoru Kullanılmıyor

Mevcut `POST /categories/ai-match` endpoint'i basit keyword matching yapıyor:

```typescript
// routes/categories.ts:184-227 (Mevcut AI mantığı)
// Sadece string eşleştirme yapıyor, gerçek AI kullanmıyor
const searchText = [product.title, supplierCategory, description].join(' ');
const directMatch = catIndex.get(supplierNorm); // Basit sözlük
```

Oysa projede zaten:
- `services/aiEngine.ts` — AI motor servisi
- `services/aiCore/AICore.ts` — AI çekirdek (model connector, prompt builder)
- `services/aiCore/utils/ModelConnector.ts` — Harici AI model bağlantısı

Bunlar hiçbir şekilde kategori eşleştirmede kullanılmıyor.

### 2.2 🟡 Orta: Öğrenilmiş Eşleştirmeler Otomatik Uygulanmıyor

`categoryMapping` tablosunda başarılı eşleştirmeler kaydediliyor ama:

```typescript
// categoryMapping kaydı var ama sonraki XML import'larda otomatik kullanılmıyor
// xmlImport.ts → products oluştururken categoryMapping kontrolü yok
```

Her XML import sonrası aynı kategoriler elle eşleştirilmek zorunda.

### 2.3 🟡 Orta: Workflow Bağlantısı Zayıf

`EventBus` üzerinden `CategoryMatchChanged` event'i yayınlanıyor ancak:

```typescript
// EventListeners.ts — VariantMatchChanged var ama CategoryMatchChanged yok!
export function registerWorkflowEventListeners(): void {
  EventBus.on('ProductCreated', ...);
  EventBus.on('ProductUpdated', ...);
  EventBus.on('VariantMatchChanged', ...);
  // ❌ CategoryMatchChanged event listener'ı EKLENMEMİŞ!
}
```

Kategori eşleştiğinde workflow state güncellenmiyor, auto-recalculation tetiklenmiyor.

### 2.4 🟢 Düşük: Dashboard Senkronizasyonu Eksik

Dashboard servisi (`DashboardService.ts`) kategori istatistiklerini güncellemiyor:

```typescript
// DashboardService.ts — Kategori verileri sorgulanmıyor
// GET /dashboard/stats — categoryCount var ama real-time değil
```

---

## 3. İyileştirme Önerileri

### 3.1 AI Kategori Motoru Entegrasyonu

**Mevcut:** 
```
routes/categories.ts → POST /categories/ai-match → keyword matching (basit)
```

**Hedef:**
```
routes/categories.ts → POST /categories/ai-match → aiEngine.ts → aiCore/ → gerçek AI
```

**Değişiklik gereken dosyalar:**

| Dosya | Değişiklik |
|-------|-----------|
| `routes/categories.ts` | `/ai-match` endpoint'ini `aiEngine.ts`'yi kullanacak şekilde güncelle |
| `services/aiEngine.ts` | Kategori eşleştirme fonksiyonu ekle (`matchCategory`) |
| `services/aiCore/AICore.ts` | Kategori prompt'u ekle |
| `services/aiCore/utils/PromptBuilder.ts` | Kategori eşleştirme şablonu ekle |

**Akış:**
```
POST /categories/ai-match
  → aiEngine.matchCategory(productTitle, supplierCategory, description)
    → AICore.analyze(prompt)
      → ModelConnector.query(model, prompt)
        → OpenAI / Claude / yerel model
      ← { categoryId, confidence, reasoning }
    ← { match, confidence, source: 'ai' }
  ← { matchedCount, results }
```

### 3.2 Öğrenilmiş Eşleştirmelerin Otomatik Uygulanması

**Mevcut:** Eşleştirmeler sadece manuel veya AI batch ile yapılıyor.

**Hedef:** XML import sırasında önceki başarılı eşleştirmeler otomatik uygulansın.

**Değişiklik gereken dosyalar:**

| Dosya | Değişiklik |
|-------|-----------|
| `services/xmlImport.ts` | Ürün oluşturma sırasında `categoryMapping` kontrolü ekle |
| `routes/categories.ts` | `POST /categories/match` sonrası mapping kaydı oluşturmayı güçlendir |

**Akış:**
```
xmlImport.ts → importXmlProducts()
  → Her ürün için:
    → categoryMapping'te (supplierCategory → systemCategory) ara
    → Varsa: categoryId = mapping.categoryId, categoryMatch = true
    → Yoksa: normal akış
```

### 3.3 Workflow Bağlantısının Güçlendirilmesi

**Mevcut:** `CategoryMatchChanged` event'i yayınlanıyor ama dinlenmiyor.

**Hedef:** Kategori eşleştiğinde workflow state güncellensin.

**Değişiklik gereken dosyalar:**

| Dosya | Değişiklik |
|-------|-----------|
| `services/workflow/EventListeners.ts` | `CategoryMatchChanged` event listener'ı ekle |
| `services/autoRecalculation/index.ts` | `onProductChanged(productId, 'category_match')` desteği |

**Akış:**
```
routes/categories.ts → POST /categories/match
  → EventBus.emit('CategoryMatchChanged', { productIds, ... })
    → EventListeners.ts:
      → WorkflowStateManager.update(productId, 'stepCategory', 'OK')
      → AutoRecalculationEngine.onProductChanged(productId, 'category_match')
      → DashboardService.refreshStats()
```

### 3.4 Dashboard Senkronizasyonu

**Mevcut:** Dashboard kategorileri `GET /dashboard/stats` üzerinden statik sorgular.

**Hedef:** Kategori değişikliklerinde dashboard anlık güncellensin.

**Değişiklik gereken dosyalar:**

| Dosya | Değişiklik |
|-------|-----------|
| `services/dashboard/DashboardService.ts` | Kategori istatistiklerini güncelleme metodu ekle |
| `routes/categories.ts` | EventBus emit'ine dashboard güncellemesi ekle |

---

## 4. Değişiklik Yapılmayacak Alanlar

| Bileşen | Neden |
|---------|-------|
| `CategoryMatchTab.tsx` (UI) | Mevcut UI korunacak, kullanıcı akışı değişmeyecek |
| `ProductPreparation.tsx` (ana sayfa) | Çalışmaya devam edecek, değişiklik yok |
| `GET /categories/stats` | API formatı aynı kalacak |
| `GET /categories/tree` | API formatı aynı kalacak |
| `POST /categories/match` | API imzası aynı kalacak |

---

## 5. Önerilen Sprint Planı

| Sprint | İş | Dosyalar |
|--------|-----|----------|
| **Sprint A** | AI Kategori Motoru entegrasyonu | `routes/categories.ts`, `aiEngine.ts`, `aiCore/` |
| **Sprint B** | Öğrenilmiş eşleştirmelerin otomatik uygulanması | `xmlImport.ts` |
| **Sprint C** | Workflow + AutoRecalculation bağlantısı | `EventListeners.ts`, `autoRecalculation/` |
| **Sprint D** | Dashboard senkronizasyonu | `DashboardService.ts` |

---

## 6. Özet

| Alan | Mevcut Durum | Hedef | Öncelik |
|------|-------------|-------|---------|
| AI kullanımı | Keyword matching | Gerçek AI (aiCore) | 🔴 Yüksek |
| Öğrenilmiş eşleştirme | Manuel | Otomatik | 🟡 Orta |
| Workflow bağlantısı | Event var, listener yok | Full entegrasyon | 🟡 Orta |
| Dashboard | Statik sorgu | Event-driven | 🟢 Düşük |
| UI/API | ✅ Çalışıyor | Değişmeyecek | — |
