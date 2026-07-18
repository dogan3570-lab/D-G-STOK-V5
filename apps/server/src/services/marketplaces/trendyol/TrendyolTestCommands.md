# TRENDYOL API - Canlı Test Komutları

Bu doküman, Trendyol Marketplace API'sini test etmek için curl komutlarını içerir.

## Değişkenler

```bash
# Stage ortamı (test)
BASE_URL="https://stageapi.trendyol.com"
API_PREFIX="/stagesapigw"
SUPPLIER_ID="2738"

# Production ortamı (gerçek)
# BASE_URL="https://api.trendyol.com"
# API_PREFIX="/api"
# SUPPLIER_ID="<gerçek_seller_id>"

# API Credentials
API_KEY="<api_key>"
API_SECRET="<api_secret>"
AUTH=$(echo -n "$API_KEY:$API_SECRET" | base64)
```

---

## 1. Authentication Test

```bash
# Basit bir endpoint çağrısı ile auth testi
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)" \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  -H "User-Agent: DG-STOK-V5.0/1.0" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/brands?page=0&size=1"
```

**Expected:** `HTTP 200`

---

## 2. Kategori Çekme

```bash
# Tüm kategorileri getir
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/categories" | jq '.categories | length'
```

**Expected:** Kategori sayısı (örn: 5000+)

---

## 3. Marka Çekme

```bash
# İlk 10 markayı getir
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/brands?page=0&size=10" | jq '.content[].name'
```

**Expected:** Marka listesi

---

## 4. Kategori Attribute'lerini Çekme

```bash
# Belirli bir kategorinin attribute'lerini getir (categoryId=3736 örnek)
CATEGORY_ID=3736
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/categories/$CATEGORY_ID/attributes" | jq '.categoryAttributes[] | {id, name, required}'
```

**Expected:** Attribute listesi (gerçek attributeId'ler)

---

## 5. Ürün Gönderme (1 ürün)

```bash
# Tek ürün gönder (asenkron - batchRequestId döner)
curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: DG-STOK-V5.0/1.0" \
  -d '{
    "items": [{
      "barcode": "TESTBARCODE001",
      "title": "Test Ürünü - Lütfen Onaylamayın",
      "productMainId": "TEST001",
      "brandId": 123,
      "categoryId": 3736,
      "quantity": 10,
      "stockCode": "TEST001",
      "dimensionalWeight": 1,
      "description": "Test ürünüdür, onaylamayın",
      "currencyType": "TRY",
      "listPrice": 150.00,
      "salePrice": 100.00,
      "vatRate": 20,
      "cargoCompanyId": 0,
      "images": [{"url": "https://picsum.photos/200"}],
      "attributes": [{"attributeId": 0, "customAttributeValue": "Renk: Kırmızı"}]
    }]
  }' \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/products"
```

**Expected:** `HTTP 202` + `batchRequestId`

---

## 6. Batch Sorgulama (Polling)

```bash
# batchRequestId'yi 5. adımdan al
BATCH_ID="<batch_request_id>"

# Batch durumunu sorgula
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/products/batch-requests/$BATCH_ID" | jq
```

**Expected Status:** `WAITING` → `PROCESSING` → `SUCCESS` | `FAILED`

---

## 7. Stok Güncelleme

```bash
curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"barcode": "TESTBARCODE001", "quantity": 25}]}' \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/products/stock-update" | jq
```

**Expected:** `HTTP 200`

---

## 8. Fiyat Güncelleme

```bash
curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"barcode": "TESTBARCODE001", "salePrice": 120.00, "listPrice": 150.00}]}' \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/products/price-update" | jq
```

**Expected:** `HTTP 200`

---

## 9. Sipariş Çekme

```bash
# Son 7 günün siparişlerini getir
START_DATE=$(date -u -d "7 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/orders?page=0&size=10&startDate=$START_DATE" | jq '.content[] | {orderNumber, status, totalPrice}'
```

**Expected:** Sipariş listesi (veya boş)

---

## 10. İade Çekme

```bash
curl -s \
  -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/returns?page=0&size=10" | jq '.content[] | {id, orderNumber, status}'
```

**Expected:** İade listesi (veya boş)

---

## 11. Kargo Takip No Ekleme

```bash
# Not: Bu endpoint Trendyol dokümantasyonunda doğrulanmalıdır
ORDER_NO="<sipariş_no>"
PACKAGE_ID="<paket_id>"
curl -s -X PUT \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber": "MNG123456", "cargoCompany": "MNG KARGO"}' \
  "$BASE_URL$API_PREFIX/suppliers/$SUPPLIER_ID/orders/$ORDER_NO/shipment-packages/$PACKAGE_ID/update-tracking-number" | jq
```

**Expected:** `HTTP 200`

---

## Test Raporu Şablonu

| # | Test | Durum | Not |
|---|------|-------|-----|
| 1 | Authentication | ⏳ | |
| 2 | Kategori Çekme | ⏳ | |
| 3 | Marka Çekme | ⏳ | |
| 4 | Attribute Çekme | ⏳ | |
| 5 | 1 Ürün Gönderme | ⏳ | |
| 6 | Batch Sorgulama | ⏳ | |
| 7 | Stok Güncelleme | ⏳ | |
| 8 | Fiyat Güncelleme | ⏳ | |
| 9 | Sipariş Çekme | ⏳ | |
| 10 | İade Çekme | ⏳ | |
| 11 | Kargo Takip No | ⏳ | |

---

## Postman Collection

Postman Collection import etmek için aşağıdaki JSON'u `trendyol-api.postman_collection.json` olarak kaydedin:

```json
{
  "info": {
    "name": "Trendyol Marketplace API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "https://stageapi.trendyol.com" },
    { "key": "prefix", "value": "/stagesapigw" },
    { "key": "supplierId", "value": "2738" },
    { "key": "apiKey", "value": "" },
    { "key": "apiSecret", "value": "" }
  ],
  "auth": {
    "type": "basic",
    "basic": [
      { "key": "username", "value": "{{apiKey}}", "type": "string" },
      { "key": "password", "value": "{{apiSecret}}", "type": "string" }
    ]
  },
  "item": [
    {
      "name": "Auth Test (Brands)",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/brands?page=0&size=1",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Get Categories",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/categories",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Get Brands",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/brands?page=0&size=10",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Get Category Attributes",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/categories/3736/attributes",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Create Product",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/products",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"items\": [{ \"barcode\": \"TESTBARCODE001\", \"title\": \"Test Ürünü\", \"productMainId\": \"TEST001\", \"brandId\": 123, \"categoryId\": 3736, \"quantity\": 10, \"stockCode\": \"TEST001\", \"dimensionalWeight\": 1, \"description\": \"Test\", \"currencyType\": \"TRY\", \"listPrice\": 150.00, \"salePrice\": 100.00, \"vatRate\": 20, \"cargoCompanyId\": 0, \"images\": [], \"attributes\": [] }] }"
        }
      }
    },
    {
      "name": "Check Batch Status",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/products/batch-requests/{{batchRequestId}}",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Update Stock",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/products/stock-update",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Accept", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"items\": [{ \"barcode\": \"TESTBARCODE001\", \"quantity\": 25 }] }"
        }
      }
    },
    {
      "name": "Update Price",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/products/price-update",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Accept", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"items\": [{ \"barcode\": \"TESTBARCODE001\", \"salePrice\": 120.00, \"listPrice\": 150.00 }] }"
        }
      }
    },
    {
      "name": "Get Orders",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/orders?page=0&size=10",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Get Returns",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/returns?page=0&size=10",
        "header": [
          { "key": "Accept", "value": "application/json" },
          { "key": "User-Agent", "value": "DG-STOK-V5.0/1.0" }
        ]
      }
    },
    {
      "name": "Update Tracking Number",
      "request": {
        "method": "PUT",
        "url": "{{baseUrl}}{{prefix}}/suppliers/{{supplierId}}/orders/{{orderNo}}/shipment-packages/{{packageId}}/update-tracking-number",
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Accept", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"trackingNumber\": \"MNG123456\", \"cargoCompany\": \"MNG KARGO\" }"
        }
      }
    }
  ]
}
```
