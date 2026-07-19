# Sprint 8: Marketplace Adapter Production

## Mevcut Durum

### Var Olan Altyapı
- `services/marketplaces/core/` - SDK: Adapter, Client, Queue, Retry, Types
- `services/marketplaces/trendyol/` - Trendyol adapter (16 dosya)
- `services/marketplaces/n11/` - N11 adapter (1 dosya)
- `services/marketplace/` - Eski servisler (ApiDiagnosticEngine, vb.)

### Eski Route'lar
- `routes/trendyol.ts` → legacy'e taşınacak
- `routes/hepsiburada.ts` → legacy'e taşınacak
- `routes/n11.ts` → legacy'e taşınacak
- `routes/marketplaceTest.ts` → legacy'e taşınacak

## Yapılacaklar

### ADIM 1: Unified Marketplace Adapter Interface
Core interface'de eksik metodları ekle:
```
connect(), testConnection(), sendProduct(), updateProduct(),
updateStock(), updatePrice(), closeListing(), openListing(),
deleteListing(), getOrders(), updateOrder(), syncStatus()
```

### ADIM 2: Unified Marketplace Router
`routes/marketplace.ts` - Tek route dosyası:
```
POST /api/marketplace/send - Ürün gönder
POST /api/marketplace/:key/test - Bağlantı testi
GET  /api/marketplace/:key/status - Durum
GET  /api/marketplace/:key/orders - Siparişler
POST /api/marketplace/:key/stock - Stok güncelle
POST /api/marketplace/:key/price - Fiyat güncelle
POST /api/marketplace/:key/close - İlan kapat
POST /api/marketplace/:key/open - İlan aç
```

### ADIM 3: Queue + Retry + WorkflowState Entegrasyonu
Her adapter çağrısı:
1. Queue'ya eklenir
2. Retry mekanizmasından geçer
3. Başarılı → WorkflowState SENT/PUBLISHED
4. Başarısız → WorkflowState ERROR, retry
5. Timeline kaydı eklenir

### ADIM 4: Eski Route'lar → Legacy
```
trendyol.ts → legacy/routes/
hepsiburada.ts → legacy/routes/
n11.ts → legacy/routes/
marketplaceTest.ts → legacy/routes/
services/marketplace/ → legacy/services/
```

### ADIM 5: Dashboard Kartları
SummaryService'e ek KPI'lar:
- pendingSend, sending, sent, failed, retrying
