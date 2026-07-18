# DG STOK V5.0 - XML Veri Toplama Motoru Analiz Raporu

**Tarih:** 2026-07-17  
**Versiyon:** 1.0  
**Durum:** ✅ Tamamlandı

---

## 1. MEVCUT MİMARI

### 1.1 XML Engine V5 (Mevcut)

```
apps/server/src/services/xml-engine/
├── index.ts              # Singleton export
├── XmlEngineV5.ts        # Ana motor (100K+ ürün)
├── Normalizer.ts          # Ürün normalizasyonu
├── FieldMapper.ts         # Alan eşleştirme
├── DuplicateChecker.ts    # Duplicate kontrol (barcode → xmlKey → SKU)
├── ImportLogger.ts        # Import log sistemi
├── adapters/
│   ├── XmlAdapter.ts      # XML streaming parser
│   ├── JsonAdapter.ts     # JSON parser
│   └── CsvAdapter.ts      # CSV parser
```

### 1.2 Provider Mimarisi (Ayrı - XML Engine'den bağımsız)

```
apps/server/src/services/providers/
├── ProviderRegistry.ts    # Provider kayıt/değişim
├── IDataProvider.ts       # Provider arayüzü
├── JsonProvider.ts
├── CsvProvider.ts
├── ExcelProvider.ts
├── ApiProvider.ts
├── FtpProvider.ts
├── SftpProvider.ts
├── SyncScheduler.ts
└── CryptoHelper.ts
```

### 1.3 Route Yapısı (İki ayrı API)

| Route | Dosya | Görev |
|-------|-------|-------|
| `/xml-sources` | xmlSources.ts (.ts) | CRUD, test, analyze, sync, history, fields, mapping, pricing |
| `/api/xml-engine` | xml-engine.ts | import, progress, cancel, mapping, stats, runs, test |

### 1.4 Queue/Worker

| Bileşen | Durum |
|---------|-------|
| BullMQ Queue | ✅ Mevcut (sadece marketplace.sync) |
| XML Import Worker | ❌ Eksik |
| Job Types | ❌ XML import tipi tanımlı değil |

### 1.5 UI Sayfaları

| Sayfa | Dosya | Durum |
|-------|-------|-------|
| XmlEnginePanel.tsx | apps/web/src/pages/ | ✅ Mevcut (XML Veri Kaynakları paneli) |
| XmlSources.tsx | apps/web/src/pages/ | ✅ Mevcut (XML Kaynak yönetimi) |

---

## 2. VERİTABANI ŞEMASI

### 2.1 XmlSource (XML Kaynağı)
- `id`, `name`, `company`, `sourceType` (MANUAL/URL/FTP/SFTP)
- `url`, `username`, `password`
- `currency`, `vatRate`, `purchasePriceVatStatus`
- `updateStock`, `updatePrice`, `updateImages`
- `active`, `connectionStatus` (unknown/connected/error/auth_error/timeout)
- `scheduleIntervalMinutes`, `cronExpression`
- `lastRunAt`, `lastSuccessAt`, `lastError`
- `fieldMapping` (JSON), `pricingRules` (JSON)
- `purchasePriceField`

### 2.2 XmlImportRun (Import Çalıştırma Kaydı)
- `sourceId`, `startedAt`, `finishedAt`, `durationMs`
- `status` (running/completed/error/cancelled)
- `totalProducts`, `newProducts`, `updatedProducts`, `failedProducts`, `skippedProducts`, `deletedProducts`
- `errorDetail`

### 2.3 XmlImportItemResult (Ürün Bazlı Import Sonucu)
- `importRunId`, `xmlKey`, `sku`
- `outcome` (created/updated/skipped/error), `errorDetail`

### 2.4 Product
- `xmlKey` (unique), `title`, `description`, `sku`, `barcode`
- `stock`, `purchasePrice`, `salePrice`, `vatRate`, `currency`
- `xmlSourceId` (XmlSource ilişkisi)
- `status` (XML/vb.), `images`, `link`, `unit`

---

## 3. MEVCUT ADAPTER ANALİZİ

### 3.1 XmlAdapter ✅ (Streaming)
- Regex tabanlı streaming parser (`<product>`, `<urun>`, `<item>` etiketleri)
- XML tag normalize (Türkçe/İngilizce alan adları)
- CDATA desteği
- Sayısal değer dönüşümü

### 3.2 JsonAdapter ✅
- Çoklu format desteği (dizi, products, items, data, urunler)
- JSON key normalize

### 3.3 CsvAdapter ✅
- Header otomatik algılama
- Çift tırnak içinde virgül desteği
- Header normalize (Türkçe/İngilizce)

### 3.4 Eksik Adapter'lar ❌
- **ExcelAdapter** - Mevcut provider'da var ama XML Engine'de yok
- **FtpAdapter/SftpAdapter** - Mevcut provider'da var ama XML Engine'de yok

---

## 4. GÜÇLÜ YÖNLER

1. **Singleton mimari** - XmlEngineV5 singleton olarak çalışıyor
2. **Adapter pattern** - Yeni kaynak eklemek kolay
3. **Normalizasyon** - Türkçe/İngilizce alan adları destekleniyor
4. **Duplicate kontrol** - barkod → xmlKey → SKU sırasıyla kontrol
5. **Import log** - Her işlem kayıt altına alınıyor
6. **EventBus entegrasyonu** - Progress takibi için event yayını
7. **Progress takibi** - Aktif import durumu canlı takip

---

## 5. GELİŞTİRİLMESİ GEREKEN ALANLAR

### 🔴 Kritik
1. **Queue/Worker entegrasyonu** - XML import arka planda çalışmalı, UI kilitlenmemeli
2. **FTP/SFTP/Excel adapter'lar** - Provider'lar XML Engine'e entegre edilmeli
3. **Streaming parser iyileştirme** - Büyük dosyalarda regex yerine SAX benzeri parser
4. **Error handling merkezi** - Hata kodları ve merkezi yönetim

### 🟡 Orta
5. **Batch insert** - Her ürün için ayrı query yerine batch
6. **Field mapping UI** - Kullanıcı arayüzünde mapping yapılabilsin
7. **Dashboard entegrasyonu** - Dashboard'da XML istatistikleri gösterilsin
8. **Variant parsing** - XML'den varyant bilgileri de çekilebilsin

### 🟢 Düşük
9. **XML Validation** - XML şema doğrulama
10. **Rate limiting** - Aşırı yüklenmeyi önleme
11. **Retry mekanizması** - Başarısız import'ları otomatik tekrar dene

---

## 6. PERFORMANS DEĞERLENDİRMESİ

| Metrik | Mevcut Durum | Hedef |
|--------|--------------|-------|
| Ürün Kapasitesi | ~50K (RAM'e yükler) | 100K+ (streaming) |
| Import Hızı | ~500 ürün/sn | ~1000 ürün/sn |
| Batch Insert | ❌ Yok | ✅ Eklenecek |
| Transaction | ❌ Yok | ✅ Eklenecek |
| Database Index | ✅ Mevcut | ✅ Yeterli |
| RAM Kullanımı | Tüm dosya RAM'de | Streaming ile düşük |

---

## 7. BAĞIMLILIKLAR

```json
{
  "bullmq": "^5.0.0",
  "express": "^4.18.0",
  "@prisma/client": "^5.0.0",
  "xlsx": "^0.18.0",  // Excel için (provider'da mevcut)
  "ssh2-sftp-client": "^9.0.0",  // SFTP için (provider'da mevcut)
  "basic-ftp": "^5.0.0"  // FTP için (provider'da mevcut)
}
```

---

## 8. ÖNERİLEN GELİŞTİRME SIRASI

1. XML Import Worker (Queue entegrasyonu)
2. Excel/FTP/SFTP Adapter'lar
3. Batch Insert + Transaction
4. Streaming Parser İyileştirme
5. Error Handling Merkezi
6. Dashboard Entegrasyonu
7. Field Mapping UI
8. Testler (Küçük/Orta/Büyük XML)
