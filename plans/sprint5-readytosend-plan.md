# DG STOK V5.0 — Sprint 5: Gönderime Hazır Merkezi (Production)

## Mevcut Durum

1. `ReadyToSend.tsx` → Product tablosundan `categoryMatch`, `brandMatch`, `variantMatch` okuyor
2. `dispatch.ts` → Aynı Product alanlarını okuyor
3. Tek karar JSON'ı yok
4. Marketplace durumu gösterilmiyor

## Yapılacaklar

### ADIM 1: ReadyToSendEngine Servisi

`services/readyToSend/ReadyToSendEngine.ts`

```typescript
interface ProductReadiness {
  productId: string;
  ready: boolean;
  score: number;
  status: string; // READY | WAITING_CATEGORY | WAITING_BRAND | ...
  checks: {
    xml: boolean;
    category: boolean;
    brand: boolean;
    variant: boolean;
    listingTemplate: boolean;
    barcode: boolean;
    images: boolean;
    price: boolean;
    stock: boolean;
    marketplace: boolean;  // Her pazaryeri için ayrı
  };
  marketplaces: Array<{
    key: string;
    name: string;
    status: 'READY' | 'SENT' | 'ERROR' | 'REJECTED' | 'PASSIVE';
    listingUrl?: string;
  }>;
  missing: string[];  // İnsan okunabilir hata mesajları
}

class ReadyToSendEngine {
  static async checkProduct(productId: string, marketplaceKey?: string): Promise<ProductReadiness>
  static async listReady(page, limit, filters): Promise<{ items: ProductReadiness[]; total: number }>
}
```

### ADIM 2: API Endpoint'leri

`routes/readyToSend.ts`

| Endpoint | Açıklama |
|----------|----------|
| `GET /ready-to-send/check/:productId` | Tek ürün JSON'ı |
| `GET /ready-to-send/list` | Filtreli liste |
| `POST /ready-to-send/send` | Pazaryerine gönder |

### ADIM 3: dispatch.ts → Legacy

`routes/dispatch.ts` → `legacy/routes/dispatch.ts`
(Yeni sistem `readyToSend.ts` kullanır)

### ADIM 4: ReadyToSend.tsx Yenileme

Yeni JSON objesini okuyacak:
- Kart rengi `status`'a göre
- Gönder butonu sadece `ready=true`
- Eksikler otomatik gösterilecek

### ADIM 5: Dashboard Yeni Kartlar

SummaryService'e ekle:
- `readyProducts`, `notReadyProducts`
- `missingCategory`, `missingBrand`, `missingVariant`, `missingTemplate`
- `apiPending`, `rejectedProducts`

### ADIM 6: Marketplace Durum

Her ürün için marketplace durumu:
- Trendyol: Hazır / Bekliyor / Gönderildi / Hata / Reddedildi
- `ProductMarketplaceState` tablosundan okunur
