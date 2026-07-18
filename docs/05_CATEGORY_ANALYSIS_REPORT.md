# DG STOK V5.0 - Kategori Eşleştirme Motoru Analiz Raporu

**Tarih:** 2026-07-17  
**Durum:** ✅ Analiz Tamamlandı

---

## 1. MEVCUT MİMARİ

### 1.1 Veritabanı Modelleri

**Category (220-232):**
- id, name (unique), externalId, parentId, variantRequired
- Self-referencing tree (parent → children)
- Product ilişkisi (categoryId)

**CategoryMapping (234-250):**
- categoryId → Category
- marketplaceId → Marketplace
- externalId, externalName, externalPath
- source (manual|xml|ai|marketplace), confidence, active

**Product (44-110):**
- categoryId → Category
- categoryMatch (boolean)
- aiSuggestedCategoryId, aiScore, matchedBy, lastMatchDate

### 1.2 Backend API (categories.ts - 585 satır)

| Route | Method | Açıklama |
|-------|--------|----------|
| `/categories/stats` | GET | İstatistikler |
| `/categories/xml-categories` | GET | XML kategorileri tree |
| `/categories/tree` | GET | Sistem kategori ağacı |
| `/categories/marketplace-categories` | GET | Pazaryeri kategorileri |
| `/categories/ai-match` | POST | AI otomatik eşleştirme |
| `/categories/bulk-match` | POST | Toplu eşleştirme |
| `/categories/products` | GET | Kategori ürünleri |
| `/categories/unmatched-products` | GET | Eşleşmemiş ürünler |
| `/categories/match` | POST | Manuel eşleştirme |
| `/categories/unmatch` | POST | Eşleştirme kaldırma |
| `/categories/mappings` | GET/POST | Mapping CRUD |
| `/categories/mappings/:id` | PUT/DELETE | Mapping güncelle/sil |
| `/categories/logs` | GET | Kategori logları |

### 1.3 Frontend (CategoryMatchTab.tsx - 317 satır)

- KPI kartları (Toplam, Otomatik, Manuel, Hata, %)
- Pazaryeri seçici butonlar
- AI eşleştirme butonu
- Sol panel: checkbox'lu ürün tablosu
- Sağ panel: kategori ağacı (lazy load, arama, expand)
- Eşleştirme butonu

---

## 2. MEVCUT ÖZELLİKLER ✅

- Kategori ağacı (parent-child self-referencing)
- AI destekli otomatik eşleştirme (3 aşamalı: tam eşleşme, keyword, marka)
- Manuel eşleştirme (ürün seç → kategori seç → eşleştir)
- Toplu eşleştirme (XML kategorisi → sistem kategorisi)
- Kategori mapping (CategoryMapping modeli)
- Audit log
- Kategori taşıma (drag&drop için PUT /move)
- Pazaryeri filtresi ile kategori ağacı

---

## 3. EKSİK ÖZELLİKLER ❌

| # | Özellik | Öncelik |
|---|---------|---------|
| 1 | Marketplace'e özel kategori ağacı tablosu | Yüksek |
| 2 | Kategori özellikleri (attributes) gösterme | Yüksek |
| 3 | Eşleşmeyen ürünler için hata merkezi | Orta |
| 4 | Kategori versiyonlama | Düşük |
| 5 | Toplu eşleştirme için seçim (100/500/1000/5000) | Orta |
| 6 | Eşleşme sonrası otomatik hazırlık kontrolü | Yüksek |

---

## 4. GELİŞTİRME PLANI

1. MarketplaceCategory tablosu ekle (pazaryeri bazlı kategori ağacı)
2. Kategori özellikleri (attributes) API/UI
3. Kategori eşleştirme UI'ını yenile (ProductPreparation içindeki)
4. Test ve build
