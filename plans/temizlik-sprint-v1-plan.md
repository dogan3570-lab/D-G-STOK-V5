# DG STOK V5.0 — Temizlik Sprint V1 Planı

## Mevcut Durum Analizi

### Route Katmanı (apps/server/src/routes/)
```
📁 routes/ (46 dosya)
```

### Servis Katmanı (apps/server/src/services/)
```
📁 services/ (çok sayıda eski ve yeni motor)
```

### Frontend (apps/web/src/pages/)
```
📁 pages/ (çok sayıda eski ve yeni ekran)
```

---

## 1️⃣ Variant V2 ve V4 Kaldırma

### Silinecek Route Dosyaları
| Dosya | Satır | Durum |
|-------|-------|-------|
| `routes/variantsV2.ts` | 394 satır | ❌ Silinecek |
| `routes/variantsV4.ts` | 206 satır | ❌ Silinecek |

### Silinecek Servis Dosyaları
| Dosya | Satır | Durum |
|-------|-------|-------|
| `services/variantEngineV2.ts` | 1362 satır | ❌ Silinecek |
| `services/variantEngineV4/index.ts` | ~300 satır | ❌ Silinecek |
| `services/variantEngineV4/types.ts` | ~50 satır | ❌ Silinecek |
| `services/xmlv2/VariantEngineV2.ts` | ~200 satır | ❌ Silinecek |
| `services/xmlv2/` (tümü) | ~5 dosya | ❌ Silinecek |

### Frontend Güncellemeleri
| Dosya | Değişiklik |
|-------|-----------|
| `pages/VariantExceptionScreen.tsx` | `/variants/v2/*` → `/variants/v5/*` API'lerine yönlendir |
| `pages/prep/VariantMatchTab.tsx` | `/variants/v4/*` → `/variants/v5/*` API'lerine yönlendir |
| `pages/VariantReviewV5.tsx` | Değişiklik yok (zaten V5 kullanıyor) |

### Route Mount Kaldırma (`routes/index.ts`)
```typescript
// Silinecek import'lar:
- import variantsV2Router from './variantsV2.ts';   // ❌
- import variantsV4Router from './variantsV4.ts';   // ❌

// Silinecek mount'lar:
- router.use('/variants/v2', variantsV2Router);     // ❌
- router.use('/variants/v4', variantsV4Router);     // ❌

// Korunacak:
- import variantsRoutes from './variantsV5.ts';     // ✅ (zaten varsayılan)
- router.use('/variants', variantsRoutes);          // ✅ (zaten V5)
```

---

## 2️⃣ Brand V1 + V3 Birleştirme

### Mevcut Durum
| Dosya | Route Path | Satır | Özellik |
|-------|-----------|-------|---------|
| `routes/brands.ts` (V1) | `/brands` | 602 satır | Temel CRUD, AI match |
| `routes/brandsV3.ts` (V3) | `/brands/v3` | 298 satır | Cache'li stats, batch match |

### Birleştirme Stratejisi
V3'teki özellikler (`/stats` cache, batch match) V1'e entegre edilecek:
- V1 `/brands` altına V3 özelliklerini ekle
- V3 route'unu legacy'e taşı
- Tüm frontend çağrılarını `/brands` altına yönlendir

### API Migration
| Eski Endpoint | Yeni Endpoint | Durum |
|--------------|---------------|-------|
| `GET /brands/v3/stats` | `GET /brands/stats` (cache'li) | ✅ Merge |
| `GET /brands/v3/products` | `GET /brands/products` | ✅ Merge |
| `POST /brands/v3/auto-match` | `POST /brands/auto-match` | ✅ Zaten var |

---

## 3️⃣ XML Engine Tek Yapı

### Mevcut Durum
```
services/xml-engine/       → Ana XML motoru (6 dosya)
services/xmlv2/            → Eski XML V2 motoru (5 dosya) 
routes/xml-engine.ts       → XML Engine route
routes/xmlv2.ts            → XML V2 route
routes/xmlSources.ts       → XML kaynak route (korunacak)
```

### Yapılacaklar
- `services/xmlv2/` → Legacy'e taşı
- `routes/xmlv2.ts` → Legacy'e taşı (kullanılmıyorsa)
- `routes/xml-engine.ts` kontrol et → kullanılıyorsa koru
- `services/xml-engine/` → Ana XML motoru olarak kalır

---

## 4️⃣ Workflow V2 Kaldırma

### Mevcut Durum
| Dosya | Satır | Durum |
|-------|-------|-------|
| `routes/workflow-v2.ts` | 50 satır | ❌ Silinecek |
| `routes/workflow.ts` | ~200 satır | ✅ Korunacak |
| `routes/workflowState.ts` | ~100 satır | ✅ Korunacak |

### Frontend Kontrol
- `/workflow-v2` API çağrısı bulunamadı ✅ (güvenle silinebilir)

---

## 5️⃣ Listing V2 Kaldırma

### Mevcut Durum
| Dosya | Satır | Durum |
|-------|-------|-------|
| `routes/listingV2.ts` | 91 satır | ❌ Silinecek (ZATEN MOUNT EDİLMEMİŞ!) |
| `services/listingEngineV2/` | ~150 satır | ❌ Silinecek |
| `routes/listings.ts` | ~600 satır | ✅ Korunacak |

### ÖNEMLİ TESPİT
`listingV2.ts` **routes/index.ts'e mount edilmemiş**! Yani zaten çalışmıyor.
Frontend (`ListingEngineV2.tsx`) `/listing-v2/*` çağrıları yapıyor ama route yok → **zaten 404 dönüyor**.

### Frontend Güncelleme
`pages/ListingEngineV2.tsx`:
- `/listing-v2/*` → `/listings/*` API'lerine yönlendir (listings.ts zaten benzer endpoint'lere sahip)
- Veya sayfa tamamen kullanılmıyorsa legacy'e taşınabilir

---

## 6️⃣ Eski Marketplace Route'ları Temizlik

### Mevcut Durum
| Dosya | Path | Satır | Durum |
|-------|------|-------|-------|
| `routes/trendyol.ts` | `/marketplace/trendyol/*` | ~250 satır | ❌ Legacy (yerine `marketplaces/trendyol/` servisleri var) |
| `routes/hepsiburada.ts` | `/marketplace/hepsiburada/*` | ~200 satır | ❌ Legacy |
| `routes/n11.ts` | `/marketplace/n11/*` | ~170 satır | ❌ Legacy |
| `routes/marketplaceTest.ts` | `/marketplaces/:id/test-v2` | ~80 satır | ❌ Legacy (yerine index.ts'de `/marketplaces/:id/test` var) |

### Migration
Bu route'lar direkt Prisma sorguları yapıyor ve yerine zaten:
- `routes/index.ts`'de `/marketplaces` CRUD var
- `services/marketplaces/trendyol/` gibi yeni nesil adapter'lar var
- `MarketplaceControlCenter` yeni API'leri kullanıyor

---

## 7️⃣ Legacy Klasör Yapısı

```
legacy/
├── routes/
│   ├── variantsV2.ts
│   ├── variantsV4.ts
│   ├── listingV2.ts
│   ├── workflow-v2.ts
│   ├── trendyol.ts
│   ├── hepsiburada.ts
│   ├── n11.ts
│   └── marketplaceTest.ts
├── services/
│   ├── variantEngineV2.ts
│   ├── variantEngineV4/
│   ├── xmlv2/
│   └── listingEngineV2/
└── pages/
    ├── VariantExceptionScreen.tsx  (V2'ye bağımlı)
    ├── ListingEngineV2.tsx         (V2'ye bağımlı)
    └── prep/VariantMatchTab.tsx    (V4'e bağımlı)
```

**NOT**: Legacy'e taşınan dosyalar silinmez, sadece arşivlenir. 
İleride referans olarak kullanılabilir.

---

## 8️⃣ Adım Adım Uygulama Sırası

### AŞAMA 1: Route Temizliği (Backend)
```
Adım 1.1: routes/index.ts'den variantsV2Router ve variantsV4Router import/mount kaldır
Adım 1.2: routes/variantsV2.ts → legacy/routes/ taşı
Adım 1.3: routes/variantsV4.ts → legacy/routes/ taşı
Adım 1.4: routes/listingV2.ts → legacy/routes/ taşı (zaten mount edilmemiş)
Adım 1.5: routes/workflow-v2.ts → legacy/routes/ taşı
Adım 1.6: routes/trendyol.ts → legacy/routes/ taşı
Adım 1.7: routes/hepsiburada.ts → legacy/routes/ taşı
Adım 1.8: routes/n11.ts → legacy/routes/ taşı
Adım 1.9: routes/marketplaceTest.ts → legacy/routes/ taşı
```

### AŞAMA 2: Servis Temizliği
```
Adım 2.1: services/variantEngineV2.ts → legacy/services/ taşı
Adım 2.2: services/variantEngineV4/ → legacy/services/ taşı
Adım 2.3: services/xmlv2/ → legacy/services/ taşı
Adım 2.4: services/listingEngineV2/ → legacy/services/ taşı
```

### AŞAMA 3: Brand Merge
```
Adım 3.1: brandsV3.ts'deki cache+stats mantığını brands.ts'e entegre et
Adım 3.2: brandsV3.ts → legacy/routes/ taşı
Adım 3.3: routes/index.ts'den brandsV3Router mount kaldır
```

### AŞAMA 4: Frontend Güncelleme (Variant)
```
Adım 4.1: VariantExceptionScreen.tsx → V2 çağrılarını V5'e çevir
         - /variants/v2/stats → /variants/stats (V5)
         - /variants/v2/screen → /variants/screen (V5)
         - /variants/v2/auto-match → /variants/v5/ ile uyumlu
Adım 4.2: VariantMatchTab.tsx → V4 çağrılarını V5'e çevir
         - /variants/v4/stats → /variants/stats
         - /variants/v4/problems → /variants/...
```

### AŞAMA 5: Frontend Güncelleme (Listing)
```
Adım 5.1: ListingEngineV2.tsx → /listing-v2/* çağrılarını kontrol et
         - Kullanılmıyorsa sayfayı legacy'e taşı
         - Kullanılıyorsa /listings/* API'lerine yönlendir
```

### AŞAMA 6: Build ve Test
```
Adım 6.1: npx tsx ile server başlat, API testi yap
Adım 6.2: Frontend build kontrolü
Adım 6.3: Tüm endpoint'leri curl ile test et
Adım 6.4: Sıfır TypeScript hatası
```

---

## 9️⃣ Risk Değerlendirmesi

| Risk | Olasılık | Etki | Önlem |
|------|---------|------|-------|
| V2/V4 API'leri frontend'de kullanılıyor | Yüksek | Kritik | Frontend çağrılarını V5'e yönlendir |
| Legacy dosyalar silinirse referans kaybı | Orta | Düşük | Legacy klasörüne taşı, silme |
| Brand V3 özellikleri merge'de kaybolur | Düşük | Orta | Cache ve batch match'i V1'e ekle |
| listingV2 zaten ölü route | Düşük | Düşük | Frontend'i de legacy'e taşı |
| XML engine route'ları karışabilir | Düşük | Orta | Önce xmlv2'nin kullanıldığını kontrol et |

---

## 🔟 API Uyumluluk Tablosu

| Kategori | Silinen Route | Yerine Kullanılacak | Durum |
|----------|--------------|---------------------|-------|
| Variant V2 | `GET /variants/v2/stats` | `GET /variants/stats` (V5) | ✅ |
| Variant V2 | `GET /variants/v2/screen` | `GET /variants/screen` (V5) | ✅ |
| Variant V2 | `POST /variants/v2/auto-match` | `POST /variants/run` (V5) | ✅ |
| Variant V2 | `POST /variants/v2/manual-match` | `POST /variants/v5/decide` (V5) | ✅ |
| Variant V2 | `POST /variants/v2/reanalyze` | `POST /variants/run` (V5) | ✅ |
| Variant V4 | `GET /variants/v4/stats` | `GET /variants/stats` (V5) | ✅ |
| Variant V4 | `GET /variants/v4/problems` | `GET /variants/v5/history` | ✅ |
| Variant V4 | `POST /variants/v4/scan` | `POST /variants/run` (V5) | ✅ |
| Workflow V2 | `GET /workflow-v2/status` | `GET /workflow-state/status` | ✅ |
| Workflow V2 | `POST /workflow-v2/start` | `POST /workflow/start` | ✅ |
| Listing V2 | `GET /listing-v2/rules` | `GET /listings/rules` | ⚠️ kontrol et |
| Listing V2 | `POST /listing-v2/calculate` | `POST /listings/calculate` | ⚠️ kontrol et |
| Marketplace | `GET /marketplace/trendyol/*` | `GET /marketplaces` (index.ts) | ✅ |
| Marketplace | `GET /marketplace/hepsiburada/*` | `GET /marketplaces` (index.ts) | ✅ |
| Marketplace | `GET /marketplace/n11/*` | `GET /marketplaces` (index.ts) | ✅ |
