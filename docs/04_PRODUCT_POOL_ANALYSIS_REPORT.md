# DG STOK V5.0 - Product Pool Analiz Raporu

**Tarih:** 2026-07-17  
**Versiyon:** 1.0  
**Durum:** ✅ Analiz Tamamlandı

---

## 1. MEVCUT MİMARI

### 1.1 Backend

| Dosya | İçerik |
|-------|--------|
| `routes/products.ts` | **779 satır** - Tüm ürün API'leri (stats, listeleme, CRUD, bulk, analyze, prepare, stock) |
| `routes/index.ts` | `/products` prefix ile products router'ı bağlı |

### 1.2 Frontend

| Dosya | İçerik |
|-------|--------|
| `pages/ProductPool.tsx` | **488 satır** - Ana ürün havuzu sayfası |

### 1.3 Database (Product Modeli)

**44 alan** içeren kapsamlı bir model:

- **Temel**: id, xmlKey, title, sku, barcode, stockCode
- **Fiyat**: purchasePrice, salePrice, vatRate, commissionRate, profitMargin, minProfit, discount
- **İçerik**: description, detail, seoTitle, seoDescription, technicalSpecs
- **Medya**: images, videos
- **Kategori/Marka**: categoryId, brandId, categoryMatch, brandMatch
- **Varyant**: variantMatch, variantStatus, variants[]
- **XML**: xmlSourceId, supplierCategory
- **Durum**: status, errorMessage, tags
- **Stok**: minStock, criticalStockLevel, autoStockManagement, lastStockCheckAt
- **Tedarikçi**: link, unit, currency
- **Marka Yönetimi**: brandUsageType, customBrandName, prefixEnabled, originalTitle, computedTitle
- **AI**: aiSuggestedCategoryId, aiScore, matchedBy, lastMatchDate

**İlişkiler:**
- Product → Category (N:1)
- Product → Brand (N:1)
- Product → XmlSource (N:1)
- Product → Variant[] (1:N)
- Product → ProductMarketplaceState[] (1:N)
- Product → ProductHistory[] (1:N)

**Index'ler:**
- variantMatch, xmlSourceId, categoryId, brandId, status, createdAt
- Composite: status + xmlSourceId
- barcode

---

## 2. MEVCUT API ROTALARI (products.ts)

| Route | Method | Auth | Açıklama |
|-------|--------|------|----------|
| `/products/stats` | GET | Auth | KPI istatistikleri (19 farklı sayım) |
| `/products` | GET | Auth | Gelişmiş filtreleme + pagination (20+ filtre) |
| `/products/bulk-update` | POST | ADMIN/OP | Toplu güncelleme (18 alan) |
| `/products/bulk-delete` | POST | ADMIN/OP | Toplu silme (ilişkili kayıtlarla) |
| `/products/analyze` | POST | ADMIN/OP | AI kalite skoru hesaplama (10 kriter) |
| `/products/prepare` | POST | ADMIN/OP | Listelemeye hazırlama |
| `/products/:id` | GET | Auth | Tek ürün detayı (tüm ilişkilerle) |
| `/products` | POST | ADMIN/OP | Yeni ürün oluşturma |
| `/products/:id` | PUT | ADMIN/OP | Ürün güncelleme (18 alan) |
| `/products/:id` | DELETE | ADMIN/OP | Ürün silme (ilişkili kayıtlarla) |
| `/products/refresh-template-matches` | POST | ADMIN/OP | Şablon eşleştirme senkronizasyonu |
| `/products/:id/stock-config` | PUT | ADMIN/OP | Stok yönetim ayarları |
| `/products/stock-scan` | POST | ADMIN/OP | Manuel stok taraması |
| `/products/stock-alerts` | GET | Auth | Kritik stok alarmları |

---

## 3. MEVCUT UI ÖZELLİKLERİ (ProductPool.tsx)

### ✅ Mevcut Özellikler
- **KPI Kartları**: Toplam, Hazır, Kategori/Marka/Varyant bekleyen, Hatalı
- **Filtreler**: Ürün adı (300ms debounce), Durum, XML Kaynağı
- **Sayfa boyutu**: 50/100/200/500/1000
- **Server-side pagination**: Sayfa numarası + toplam sayfa
- **Sticky columns**: Checkbox + Resim + Ürün Adı + XML Kaynağı + Marka + Stok + Fiyat + Durum
- **Scrollable columns**: SKU, Barkod, Kategori, Varyant, Renk, Beden, Numara, Güncelleme
- **Checkbox seçim**: Tekli + Tümünü seç
- **Seçim toolbar**: Seçili sayısı + Temizle butonu
- **Drawer (sağ panel)**: 9 sekme (Genel, Fiyat, Kategori, Marka, Varyant, Attributes, Resimler, Pazaryerleri, Log)
- **Resim fallback**: hata durumunda SVG placeholder
- **Hover efektleri**, **loading durumu**, **boş durum**

### ❌ Eksik Özellikler
- Toplu işlem toolbar'ı (KDV/Fiyat/Marka/Kategori/Sil/Pasif/Aktif)
- Gönderime hazır kontrolü (yeşil/kırmızı ikon)
- Hızlı hata gösterimi (eksik kategori/marka/varyant/barkod/resim ikonları)
- Gelişmiş filtreler (fiyat aralığı, stok durumu, gönderime hazır, pazaryeri, varyant durumu)
- Kategori/Marka filtreleri
- Sıralama (kolon başlığına tıklama)
- Export (CSV/Excel)
- Dashboard entegrasyonu güncelleme

---

## 4. PERFORMANS DEĞERLENDİRMESİ

| Metrik | Mevcut | Hedef |
|--------|--------|-------|
| Max ürün | 1000 sayfa başına | 100K+ toplam |
| Sayfa yükü | ~500ms (50 ürün) | <200ms |
| Arama | Debounce 300ms | Anlık |
| Index'ler | 7 adet | Yeterli |

---

## 5. GELİŞTİRME PLANI

### Faz 1: Backend Geliştirmeleri
1. `GET /products/errors` - Hatalı ürünler için özel endpoint
2. `POST /products/bulk` - Toplu işlem endpoint'i (status/active/passive)

### Faz 2: UI Geliştirmeleri
3. Toplu işlem toolbar'ı
4. Gelişmiş filtreler
5. Hızlı hata gösterimi (ikonlar)
6. Gönderime hazır kontrolü
7. Kolon sıralama

### Faz 3: Test
8. Backend testleri
9. Build doğrulama
