# DG STOK V5.0 API Dokümantasyonu

## 📋 Genel Bakış

DG STOK V5.0, çoklu pazaryeri entegrasyonu, XML ürün yönetimi ve otomasyon özellikleri sunan bir stok yönetim sistemidir.

**Base URL:** `http://localhost:4000`
**WebSocket:** `ws://localhost:4000/ws`

---

## 🔐 Authentication

### Giriş Yap
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@dgstok.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "admin@dgstok.com",
    "role": "ADMIN"
  }
}
```

### Kullanıcı Bilgisi
```http
GET /auth/me
Cookie: token=<jwt_token>
```

---

## 🏪 XML Kaynakları

### XML Kaynaklarını Listele
```http
GET /xml-sources
```

### XML Kaynağı Oluştur
```http
POST /xml-sources
Content-Type: application/json

{
  "name": "Tedarikçi A",
  "company": "Tedarikçi A.Ş.",
  "sourceType": "URL",
  "url": "https://example.com/urunler.xml",
  "currency": "TRY",
  "vatRate": 20,
  "scheduleIntervalMinutes": 60
}
```

### XML İçe Aktar
```http
POST /xml-sources/:id/import
```

### XML İçe Aktar (Manuel)
```http
POST /xml-sources/import
Content-Type: application/xml

<?xml version="1.0"?>
<products>
  <product>
    <xmlKey>URUN-001</xmlKey>
    <title>Test Ürünü</title>
    <sku>SKU-001</sku>
    <price>100.00</price>
    <stock>50</stock>
  </product>
</products>
```

---

## 📦 Ürünler

### Ürünleri Listele
```http
GET /products?page=1&limit=20&search=ürün&status=XML&lowStock=true
```

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| page | number | Sayfa numarası (default: 1) |
| limit | number | Sayfa başına ürün (default: 20) |
| search | string | Arama metni |
| status | string | Filtre: XML, LISTED, ERROR |
| lowStock | boolean | Düşük stok filtresi |
| categoryId | string | Kategori filtresi |
| brandId | string | Marka filtresi |
| sortBy | string | Sıralama: title, stock, price, createdAt |
| sortOrder | string | asc veya desc |

### Ürün Detayı
```http
GET /products/:id
```

### Ürün Oluştur
```http
POST /products
Content-Type: application/json

{
  "xmlKey": "URUN-001",
  "title": "Test Ürünü",
  "sku": "SKU-001",
  "barcode": "8691234567890",
  "stock": 100,
  "minStock": 10,
  "salePrice": 150.00,
  "vatRate": 20,
  "categoryId": "uuid",
  "brandId": "uuid",
  "description": "Ürün açıklaması",
  "images": "https://example.com/image1.jpg,https://example.com/image2.jpg"
}
```

### Ürün Güncelle
```http
PUT /products/:id
Content-Type: application/json

{
  "title": "Güncellenmiş Ürün",
  "stock": 200,
  "salePrice": 175.00
}
```

### Ürün Sil
```http
DELETE /products/:id
```

### Toplu Ürün Güncelle
```http
POST /products/batch-update
Content-Type: application/json

{
  "ids": ["uuid1", "uuid2"],
  "data": {
    "status": "LISTED",
    "salePrice": 200.00
  }
}
```

---

## 🏷️ Kategoriler

### Kategorileri Listele
```http
GET /categories
```

### Kategori Oluştur
```http
POST /categories
Content-Type: application/json

{
  "name": "Elektronik",
  "parentId": "uuid" // optional
}
```

### Kategori Güncelle
```http
PUT /categories/:id
```

### Kategori Sil
```http
DELETE /categories/:id
```

---

## 🏢 Markalar

### Markaları Listele
```http
GET /brands
```

### Marka Oluştur
```http
POST /brands
Content-Type: application/json

{
  "name": "Samsung"
}
```

---

## 🏪 Pazaryerleri

### Pazaryerlerini Listele
```http
GET /marketplaces
```

### Pazaryeri Oluştur
```http
POST /marketplaces
Content-Type: application/json

{
  "key": "trendyol",
  "name": "Trendyol",
  "apiKey": "api_key",
  "apiSecret": "api_secret",
  "apiUrl": "https://api.trendyol.com"
}
```

---

## 📊 Dashboard

### Özet İstatistikler
```http
GET /dashboard/stats
```

**Response:**
```json
{
  "totalProducts": 1500,
  "totalOrders": 250,
  "totalMarketplaces": 3,
  "totalRevenue": 125000.00,
  "lowStockProducts": 45,
  "activeXmlSources": 5,
  "recentImports": [...]
}
```

### Pazaryeri Özeti
```http
GET /dashboard/summary
```

---

## 📈 Raporlar

### Genel Rapor
```http
GET /reports
```

### Finans Raporu
```http
GET /reports/finance?startDate=2024-01-01&endDate=2024-12-31
```

### Ürün Raporu
```http
GET /reports/products
```

### Sipariş Raporu
```http
GET /reports/orders
```

---

## 📦 Siparişler

### Siparişleri Listele
```http
GET /orders?page=1&limit=20&status=new
```

### Sipariş Detayı
```http
GET /orders/:id
```

---

## 🔔 Bildirimler

### Bildirimleri Listele
```http
GET /notifications
```

### Bildirim Oluştur
```http
POST /notifications
Content-Type: application/json

{
  "type": "info",
  "title": "XML İçe Aktarma Tamamlandı",
  "message": "150 ürün başarıyla içe aktarıldı"
}
```

### Bildirimi Okundu İşaretle
```http
POST /notifications/:id/read
```

---

## 🤖 Otomasyon

### Kuralları Listele
```http
GET /automation
```

### Kural Oluştur
```http
POST /automation
Content-Type: application/json

{
  "name": "XML Senkronizasyonu",
  "type": "xml_sync",
  "triggerType": "schedule",
  "actionType": "sync_xml",
  "schedule": "*/30 * * * *",
  "active": true
}
```

### Kuralı Aç/Kapat
```http
POST /automation/:id/toggle
```

---

## 📋 Varyantlar

### Varyantları Listele
```http
GET /variants?page=1&limit=20
```

### Varyant Tipleri
```http
GET /variants/types
```

---

## 👥 Kullanıcılar (Admin)

### Kullanıcıları Listele
```http
GET /users
```

---

## ⚙️ Ayarlar

### Ayarları Getir
```http
GET /settings
```

### Ayarları Güncelle
```http
PUT /settings
Content-Type: application/json

{
  "key": "value"
}
```

---

## 📝 Audit Log

### Logları Listele
```http
GET /audit-logs?page=1&limit=50
```

---

## 🔌 WebSocket Bağlantısı

### Bağlantı
```javascript
const ws = new WebSocket('ws://localhost:4000/ws?token=<jwt_token>');
```

### Abone Olma
```json
{
  "type": "subscribe",
  "channels": ["imports", "notifications", "orders"]
}
```

### Kanal Listesi
| Kanal | Açıklama |
|-------|----------|
| imports | XML içe aktarma ilerlemesi |
| notifications | Bildirimler |
| orders | Yeni siparişler |
| products | Ürün güncellemeleri |
| system | Sistem durumu |

### Olay Tipleri
```json
{
  "type": "event",
  "channel": "imports",
  "event": "progress",
  "data": {
    "runId": "uuid",
    "sourceName": "Tedarikçi A",
    "processed": 250,
    "total": 500,
    "percentage": 50
  }
}
```

---

## 🚨 Hata Kodları

| Kod | HTTP Status | Açıklama |
|-----|-------------|----------|
| UNAUTHORIZED | 401 | Yetkilendirme hatası |
| NOT_FOUND | 404 | Kaynak bulunamadı |
| VALIDATION_ERROR | 400 | Doğrulama hatası |
| INTERNAL_ERROR | 500 | Sunucu hatası |
| INVALID_XML | 400 | Geçersiz XML formatı |
| DUPLICATE_KEY | 409 | Mükerrer kayıt |
| RATE_LIMIT | 429 | Çok fazla istek |

---

## 📊 Performans İpuçları

1. **Sayfalama:** Tüm listelemelerde `page` ve `limit` parametrelerini kullanın
2. **Batch İşlemler:** Toplu güncellemeler için `/products/batch-update` endpoint'ini kullanın
3. **WebSocket:** Gerçek zamanlı güncellemeler için WebSocket bağlantısını tercih edin
4. **Filtreleme:** Mümkün olduğunca server-side filtreleme kullanın
5. **Cache:** Sık kullanılan sorgular için `ETag` header'larını kullanın

---

## 🔒 Güvenlik

- Tüm API istekleri JWT token ile korunmaktadır
- Rate limiting: 15 dakikada 1000 istek
- Hassas bilgiler HTTP-only cookie ile iletilir
- CORS yapılandırması ile güvenli erişim
- Helmet ile HTTP header güvenliği
