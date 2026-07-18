# TRENDYOL API - PRODUCTION CHECKLIST

Bu doküman, Trendyol Marketplace API entegrasyonunu production'a çıkarmadan önce kontrol edilmesi gereken maddeleri içerir.

---

## 1. ✅ Authentication

- [ ] **API Key** tanımlı ve geçerli
- [ ] **API Secret** tanımlı ve geçerli
- [ ] **Supplier ID** doğru (Stage: 2738, Production: gerçek ID)
- [ ] Basic Auth test edildi
- [ ] Yetkisiz erişim (401) doğru yönetiliyor

## 2. ⚙️ Environment

- [ ] **Stage URL:** `https://stageapi.trendyol.com`
- [ ] **Production URL:** `https://api.trendyol.com`
- [ ] Stage/Production ayrımı otomatik çalışıyor
- [ ] Base URL DB'den doğru okunuyor

## 3. 🔒 Security

- [ ] API Key/Secret DB'de şifreli saklanıyor
- [ ] SSL/TLS aktif
- [ ] Authorization header log'lanmıyor (maskeleniyor)
- [ ] Rate limit koruması aktif

## 4. ⏱️ Timeout & Retry

- [ ] **Timeout:** 30 saniye
- [ ] **Max Retry:** 3
- [ ] **Exponential Backoff:** Aktif
- [ ] **429 Rate Limit:** Retry-After header'ı okunuyor
- [ ] **5xx Retry:** Aktif
- [ ] **4xx (non-429):** Retry yapılmıyor

## 5. 📦 Batch System

- [ ] **Batch limit:** 50 ürün/batch
- [ ] **Async polling:** 5 saniye aralık
- [ ] **Polling timeout:** 5 dakika
- [ ] **Max concurrent:** 3 batch
- [ ] **Partial success:** Destekleniyor
- [ ] Ürün bazlı hata raporu üretiliyor

## 6. 🛡️ Circuit Breaker

- [ ] CLOSED → OPEN (5 hata)
- [ ] OPEN → HALF_OPEN (30 saniye)
- [ ] HALF_OPEN → CLOSED (2 başarı)
- [ ] Fallback mekanizması çalışıyor

## 7. 📋 Dead Letter Queue

- [ ] Başarısız ürünler DLQ'ya düşüyor
- [ ] Operatör inceleyebiliyor
- [ ] Tekrar gönderim destekleniyor
- [ ] Max entry limit: 10000

## 8. 🔑 Idempotency

- [ ] Product hash (SHA-256) çalışıyor
- [ ] Duplicate detection aktif
- [ ] 24 saat TTL
- [ ] Order ID duplicate koruması

## 9. 🔗 Correlation ID

- [ ] Tüm zincirde aynı ID kullanılıyor
- [ ] `X-Correlation-Id` header'ı gönderiliyor
- [ ] Log'larda Correlation ID görünüyor
- [ ] Event'lerde Correlation ID taşınıyor
- [ ] Batch alt ID'ler (`-batch-01`) çalışıyor

## 10. 📊 Metrics & Monitoring

- [ ] Success Rate hesaplanıyor
- [ ] Error Rate hesaplanıyor
- [ ] Average Response Time ölçülüyor
- [ ] 429 Count takip ediliyor
- [ ] Retry Count takip ediliyor
- [ ] Circuit State takip ediliyor
- [ ] DLQ Count takip ediliyor

## 11. 📝 Logger

- [ ] Request log'lanıyor
- [ ] Response log'lanıyor
- [ ] Duration log'lanıyor
- [ ] HTTP Status log'lanıyor
- [ ] Correlation ID log'lanıyor
- [ ] Payload Size log'lanıyor (opsiyonel)
- [ ] Hassas veriler maskeleniyor

## 12. 🧪 API Test

- [ ] Authentication test edildi
- [ ] Categories test edildi
- [ ] Brands test edildi
- [ ] Attributes test edildi
- [ ] 1 Product test edildi
- [ ] 50 Product (batch) test edildi
- [ ] Stock Update test edildi
- [ ] Price Update test edildi
- [ ] Orders test edildi
- [ ] Shipment test edildi
- [ ] Returns test edildi

## 13. 🔄 Rollback Planı

- [ ] Eski adapter'a dönüş mümkün
- [ ] Feature flag ile kontrol edilebilir
- [ ] DB değişikliği gerektirmiyor
- [ ] Migration varsa rollback scripti hazır

## 14. 🚀 Deployment

- [ ] Tüm dosyalar Git'te
- [ ] `npx tsc --noEmit` temiz
- [ ] Dependency'ler yüklü
- [ ] Environment variable'lar tanımlı
- [ ] Docker image hazır (varsa)

---

## ÖZET

| Kategori | Durum |
|----------|-------|
| Authentication | ⏳ |
| Environment | ⏳ |
| Security | ⏳ |
| Timeout & Retry | ⏳ |
| Batch System | ⏳ |
| Circuit Breaker | ⏳ |
| Dead Letter Queue | ⏳ |
| Idempotency | ⏳ |
| Correlation ID | ⏳ |
| Metrics | ⏳ |
| Logger | ⏳ |
| API Tests | ⏳ |
| Rollback | ⏳ |
| Deployment | ⏳ |

**CHECKLIST SONUCU:** ___ / 14

**KARAR:** Production'a çıkılabilir mi? [EVET / HAYIR]
