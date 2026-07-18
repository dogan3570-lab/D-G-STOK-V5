# 🏗️ Ürün Hazırlama Merkezi V6.0 — UX Revizyonu

**Tarih:** 2026-07-18  
**Yazar:** Zoo (Mimar)  
**Durum:** ✅ ONAYLANDI — Kod yazılacak

---

## Sprint Kısıtları

| Kural | Değer |
|---|---|
| Maksimum değişen dosya | **5** |
| Backend değişikliği | **❌ Yok** |
| Yeni endpoint | **❌ Yok** |
| Yeni servis | **❌ Yok** |
| API değişikliği | **❌ Yok** |
| Veritabanı değişikliği | **❌ Yok** |
| İş kuralları değişikliği | **❌ Yok** |
| Menü yeri değişikliği | **❌ Yok** |

---

## 1. Mevcut Durum

[`ProductPreparation.tsx`](../apps/web/src/pages/ProductPreparation.tsx) sayfası **4 sekme** halinde:

| Sekme | Bileşen | İşlev |
|---|---|---|
| 🗂️ Kategori | [`CategoryMatchTab.tsx`](../apps/web/src/pages/prep/CategoryMatchTab.tsx) | Kategori eşleştirme |
| 🏷️ Marka | [`BrandMatchTab.tsx`](../apps/web/src/pages/prep/BrandMatchTab.tsx) | Marka eşleştirme |
| 🧬 Varyant | [`VariantMatchTab.tsx`](../apps/web/src/pages/prep/VariantMatchTab.tsx) | Varyant doğrulama |
| 📋 Listeleme | [`ListingTemplateTab.tsx`](../apps/web/src/pages/prep/ListingTemplateTab.tsx) | Fiyat şablonu |

**Sorun:** 4 ayrı sekme + 4 ayrı tablo + 30+ KPI kartı. Kullanıcı kayboluyor.

---

## 2. Yeni Tasarım — 5 Dosya

### 2.1. Değişecek / Yeni Dosyalar

```
apps/web/src/pages/
├── ProductPreparation.tsx   ← [1] YENİDEN YAZ (ana sayfa, mevcut dosya)
└── prep/
    ├── PrepSummary.tsx      ← [2] YENİ (üst özet kartları)
    ├── PrepProductRow.tsx   ← [3] YENİ (tek ürün satırı + inline panel)
    ├── PrepStatusBadge.tsx  ← [4] YENİ (durum göstergesi)
    └── types.ts             ← [5] YENİ (tipler)
```

**Sadece 5 dosya.** Başka hiçbir dosyaya dokunulmayacak.

### 2.2. Değişmeyecek Dosyalar

| Dosya | Neden |
|---|---|
| Mevcut 4 tab bileşeni (`CategoryMatchTab`, `BrandMatchTab`, `VariantMatchTab`, `ListingTemplateTab`) | Backend'e yönlendirme için import edilecek, silinmeyecek |
| Tüm backend route'ları | Değişiklik yok |
| Prisma şeması | Değişiklik yok |
| App.tsx, Sidebar, Layout | Menü yeri aynı |
| KpiCard, Toast, api.ts | Mevcut UI kullanılacak |

---

## 3. Kritik Tasarım Kararları

### 3.1. Düzenle Butonu Inline Açılır

Yeni sayfa veya popup yok. Satır içinde genişleme (inline expansion):

```
┌─────────────────────────────────────────────────────────────┐
│ 👟 Nike Air Max 270             🗂️ ✅ [Düzenle]           │
│    SKU: NM270-001                🏷️ ❌ [Düzenle]           │
│                                  🧬 ✅ [Düzenle]           │
│                                  📋 ❌ [Düzenle]           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 🏷️ Marka Eşleştirme ──────────────────────────────┐   │
│  │                                                     │   │
│  │  XML Marka: NIKE_SPORTS                             │   │
│  │  DG Marka: [Nike________________]  [🔗 Eşleştir]   │   │
│  │                                                     │   │
│  │  [💾 Kaydet]  [İptal]                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2. İşlem Sonrası Otomatik Devam

Kullanıcı bir adımı kaydettiğinde:

```
Kategori kaydedildi
  ↓
Marka otomatik kontrol (refetch)
  ↓
Marka tamamsa → Varyant otomatik kontrol
  ↓
Varyant tamamsa → Şablon otomatik kontrol
  ↓
Tümü tamam → Ürün listeden KAYBOLUR
```

Kullanıcı **hiçbir şey yapmaz.** Sayfa otomatik güncellenir.

### 3.3. Sadece Eksik Ürünler Gösterilir

Bu ekranın amacı: **Eksikleri tamamlamak.**

- `categoryMatch = false` VEYA
- `brandMatch = false` VEYA  
- `variantMatch = false` VEYA
- `templateMatch = false`

**Tümü true olan ürünler bu ekranda GÖRÜNMEZ.** Otomatik olarak Gönderime Hazır modülüne geçer.

---

## 4. Ekran Yerleşimi

```
┌────────────────────────────────────────────────────────────────────┐
│  Ürün Hazırlama Merkezi                            [🔍 Ara...]   │
│  V6.0 · Sadece eksik ürünler gösterilir                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐   │
│  │  📦     │ │  ✅     │ │  ❌     │ │  ⚠️     │ │  🚀       │   │
│  │  9.355  │ │  9.100  │ │  255    │ │  18     │ │  9.100    │   │  ← PrepSummary
│  │ Toplam  │ │  Hazır  │ │  Eksik  │ │İncelen. │ │Gönder.Haz.│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ❌ Eksik olan 255 ürün gösteriliyor                         │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  ─── Ürün ─────────── 🗂️ Kategori │ 🏷️ Marka │ 🧬 Varyant │  │
│  │                                                              │  │
│  │  👟 Nike Air Max 270   ✅ Tamam   ❌ Eksik   ✅ Hazır      │  │  ← Satır
│  │     SKU: NM270-001     [Düzenle]  [Düzenle]  [Düzenle]     │  │
│  │                                                              │  │
│  │  👟 Adidas Run 500     ❌ Eksik   ✅ Tamam   ✅ Hazır      │  │  ← Satır
│  │     SKU: AR500-W       [Düzenle]  [Düzenle]  [Düzenle]     │  │
│  │                                                              │  │
│  │  👟 Puma Flex          ✅ Tamam   ✅ Tamam   ⚠️ İncelenecek│  │  ← Satır
│  │     SKU: PFX-42        [Düzenle]  [Düzenle]  [Düzenle]     │  │
│  │                                                              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  [◀] Sayfa 1 / 6  [▶]  Göster: 50                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Veri Akışı

### 5.1. İstatistikler (Üst Özet)

```
GET /products/stats  ← Mevcut API
{
  totalProducts: 9355,            // 📦 Toplam
  pendingCategory: 255,           // ❌ Eksik
  variantAnalysisPending: 18,     // ⚠️ İncelenecek
  readyForListing: 9100           // 🚀 Gönderime Hazır
}
✅ Hazır = totalProducts - pendingCategory - variantAnalysisPending
```

### 5.2. Ürün Listesi (Sadece Eksikler)

```
GET /products?page=1&limit=50  ← Mevcut API
  &categoryMatch=false          ← Sadece eksik olanlar
  &brandMatch=false
  &variantMatch=false
  &templateMatch=false

Hepsi OR mantığı ile filtrelenir (backend'de mevcut).
```

**Alternatif:** Frontend'de tüm ürünler çekilip filtreleme yapılır (sayfa başı 50 kayıt).

### 5.3. "Düzenle" Butonları

| Buton | Inline Panel İçeriği | Kullanılan API |
|---|---|---|
| 🗂️ Kategori [Düzenle] | Pazaryeri kategorisi dropdown + Kaydet | `POST /categories/match` |
| 🏷️ Marka [Düzenle] | Marka input + Eşleştir butonu | `POST /brands/v3/match` |
| 🧬 Varyant [Düzenle] | "Varyantları Tara" butonu + Durum | `POST /variants/v4/scan/:id` |
| 📋 Listeleme [Düzenle] | Şablon seç dropdown | `POST /listings` |

---

## 6. Component Mimarisi

```
ProductPreparation.tsx
├── PrepSummary.tsx         ← 5 KPI kartı (mevcut KpiCard kullanır)
├── Filtre / Arama          ← inline, basit
├── Tablo
│   └── PrepProductRow.tsx  ← Tek satır + inline panel
│       └── PrepStatusBadge.tsx  ← ✅ / ❌ / ⚠️
└── Pagination              ← inline, basit
```

### 6.1. State Yönetimi

```typescript
interface PrepState {
  stats: PrepStats | null;
  products: ProductItem[];
  loading: boolean;
  page: number;
  total: number;
  search: string;
  expandedRow: string | null;       // Hangi satır genişletilmiş?
  expandedAction: string | null;    // Hangi aksiyon? (category|brand|variant|template)
  saving: boolean;
}

// İşlem sonrası otomatik akış:
async function handleSave(productId: string) {
  // 1. Kaydet
  // 2. Kapat inline panel
  // 3. Refetch ürün listesi
  // 4. Eğer tüm adımlar tamam → ürün otomatik kaybolur
  // 5. Kullanıcı hiçbir şey yapmaz
}
```

---

## 7. Kullanıcı Akışı (Tam)

```
Kullanıcı → Ürün Hazırlama'ya girer
  │
  ▼
Sadece eksik ürünleri görür (255 adet)
  │
  ▼
Hangi kart ❌ veya ⚠️ ise [Düzenle]'ye basar
  │
  ▼
Satır içi panel açılır (sayfadan çıkmaz)
  │
  ▼
İşlemi yapar → [Kaydet]'e basar
  │
  ▼
Panel kapanır
  │
  ▼
Sayfa otomatik refetch yapar
  │
  ├─ Tümü tamam → ürün listeden kaybolur → Gönderime Hazır'a geçer
  ├─ Hala eksik var → satır güncellenir, kullanıcı devam eder
  │
  ▼
Kullanıcı sayfada kalır, sıradaki eksik ürüne geçer
```

---

## 8. Kabul Kriteri

Kod bittikten sonra:

1. ✅ Ürün Hazırlama ekranı açılır, sadece eksik ürünler görünür
2. ✅ Bir eksik üründe [Düzenle]'ye basılır, inline panel açılır
3. ✅ İşlem yapılır, kaydedilir, ürün otomatik listeden çıkar
4. ✅ Aynı ürün Gönderime Hazır ekranında görünür

---

## 9. Todo Listesi (Uygulama Sırası)

```
[ ] types.ts oluştur — PrepProduct, PrepStats, StatusType
[ ] PrepStatusBadge.tsx oluştur — ✅/❌/⚠️ durum göstergesi + [Düzenle]
[ ] PrepProductRow.tsx oluştur — tek ürün satırı + inline panel
[ ] PrepSummary.tsx oluştur — 5 KPI kartı
[ ] ProductPreparation.tsx yeniden yaz — eski tab yapısını kaldır, yeni görünüm
```

---

## 10. Özet

| Başlık | Karar |
|---|---|
| Değişen dosya sayısı | **5** (1 yeniden yaz + 4 yeni) |
| Backend | **Dokunulmayacak** |
| Mevcut API'ler | **Aynen kullanılacak** |
| Mevcut tab bileşenleri | **Silinmeyecek**, import edilecek |
| Düzenle | **Inline expansion** — yeni sayfa/popup yok |
| Otomatik devam | Kaydet → refetch → ürün otomatik kaybolur |
| Sadece eksikler | `categoryMatch=false` OR `brandMatch=false` OR ... |
| Tasarım | Tek satır, 4 kart, minimal, 2026 kurumsal |
