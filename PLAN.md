# Edit Plan — STOKMANT/ERP Entegratör Operasyon Paneli

## Bilgi Toplama Özeti
- Repo/klasörde görünen dosya yok denecek kadar az: sadece `README.md` ve `TODO.md` var; mevcut uygulama kodu bulunmuyor.
- `search_files` aracı çalışmıyor (rg/ ripgrep binari yok). Bu nedenle ilerleme: “sıfırdan” proje iskeleti kurmak.
- Kullanıcı gereksinimi (özet):
  - ERP/operasyon paneli: KPI kartları, eşleştirme ilerleme, pazaryeri bazlı ready/sent/passive/hatalı sayaçları
  - İş akışları: pazaryerine gönder, toplu pasife al, toplu/tekil aktif et, kuyruk (batch) ve retry
  - “Pazaryeri ekle-kaldır” dinamik olmalı (otomatik yönetim)
  - Web tabanlı, güvenlik odaklı, operasyon ölçeklenebilir (100k XML)

## Seçimler (otomatik)
- Web uygulama tek monorepo: **Node.js + Express (API) + React (UI)**
- Queue: **BullMQ + Redis**
- DB: **Postgres + Prisma**
- Canlı/gerçek zamanlı güncelleme: **SSE (Server-Sent Events)** (kolay ve stabil)
- Kimlik doğrulama/Yetkilendirme: **JWT + RBAC**
- Güvenlik: input validation (zod), rate limit, audit log, CSRF (cookie + sameSite), CORS whitelist, secure headers

## Plan (Dosya bazında)
1. **Proje iskeletini kur**
   - `package.json`, `apps/server`, `apps/web`, ortak `packages/shared` yapısı
2. **DB şeması + Prisma**
   - `products`, `marketplaces`, `mappings`, `shipments`, `queue_jobs`, `api_status`, `audit_logs` gibi tablolar
3. **API katmanı**
   - Auth: login/me, RBAC
   - Health/Live status: `/health`, `/api-status`
   - Dashboard özetleri: `/dashboard/summary`, `/dashboard/progress`, `/marketplaces/:id/kpis`
   - İşlem endpointleri: `/actions/marketplace/sync`, `/actions/marketplace/passive-bulk`, `/actions/marketplace/activate-bulk`, `/actions/product/:id/passive`
4. **Queue / Worker**
   - BullMQ worker’lar: gönderim, pasife/aktif etme, senkron
   - Batch + idempotency key
   - Retry with exponential backoff + dead-letter
5. **Pazaryeri ekle/kaldır (DB-driven)**
   - `marketplaces` tablosu ile admin CRUD
   - UI “marketplace listesi”ni buradan okur
6. **Frontend (ERP UI)**
   - Dashboard kartları, ilerleme barları, marketplace merkez, queue tablosu
   - SSE ile gerçek zamanlı durum
7. **Redteam test senaryoları (teknik doğrulama)**
   - Entegrasyon test framework’ü: Playwright (UI) + Jest (backend)
   - Performans testi için “seed” generator (100k ürün)

## Bağımlı Dosyalar
- Şu an mevcut kod olmadığı için yeni dosyaların tümü proje iskeletini oluşturacak.

## Takip Adımları
- Proje ayağa kaldırma: `npm install` + `docker compose up` + `npm run dev`
- UI ile dashboard doğrulama

## Onay Gerekli Değil mi?
- Kullanıcı “tüm seçimleri sen yap” dediği için bu PLAN’ı onay varsayarak uygulamaya başlayacağım.

