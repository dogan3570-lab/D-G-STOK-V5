# DG STOK V5.0 - Yapılacaklar Listesi

## ✅ Tamamlananlar

- [x] App.tsx dosyasının eksik kalan bölümünü tamamen incele
- [x] JSX kapanış ve sayfa bloklarını sentaks hatasız şekilde tamamla
- [x] Server tarafında route mount / auth / queue-sse akış uyumsuzluklarını düzelt
  - [x] auth middleware + server boot + route/SSE/worker dosyalarını analiz et
  - [x] dosya bazlı düzeltme planını çıkar ve onay al
  - [x] server bootstrap akışını tekilleştir (index/server uyumu)
  - [x] import uzantı ve attach sırası tutarlılığını düzelt
  - [x] route/action response formatı tutarlılık kontrolü
  - [x] index.ts sade entrypoint'e çek ve server.ts buildServer/startWorkers akışını tek kaynak yap
  - [x] auth middleware hata formatlarını `{ ok:false, error:{ code, message } }` ile standardize et
  - [x] apps/server TypeScript build/check çalıştır
  - [x] health + auth + action enqueue + SSE smoke test
- [x] Sağ panel sayfalarını (özellikle XML, Ürünler, Kategori, Varyant, Marka, Şablon, Pazaryeri, Gönderim, Sipariş, Rapor, Ayar, Log) tek tek işlevsel doldur
  - [x] sağ panelin mevcut App.tsx yapısını analiz et
  - [x] sağ paneli kalıcı üst özet + alt modül içerik düzenine taşıma planını netleştir
  - [x] App.tsx içinde layout refactor (kalıcı üst blok + alt detay blok)
  - [x] XML sekmesini form + kaynak listesi + fallback aksiyonları ile tamamla
  - [x] Şablon sekmesini şablon listesi + oluşturma alanı ile tamamla
  - [x] Gönderim sekmesini gönderi kuyruğu tablosu + durum kartları ile tamamla
  - [x] Sipariş sekmesini sipariş listesi + filtre kartları ile tamamla
  - [x] Rapor sekmesini KPI + dönemsel özet kartları ile tamamla
  - [x] Ayar sekmesini sistem/entegrasyon/yönetici aksiyon panelleri ile tamamla
  - [x] Ortak section başlık/stil yapısını tüm sekmelere uygula
  - [x] types.ts gerekiyorsa yeni payload tipleriyle genişlet
  - [x] UI build/doğrulama çalıştır
- [x] Web App.tsx içinde ilgili sayfalara gerçek listeleme + ekleme + güncelleme akışlarını bağla
- [x] Tipleri (apps/web/src/types.ts) yeni API payloadlarıyla uyumlu genişlet
- [x] Web uygulamasını yeniden açıp tüm sayfaları tek tek doğrula
- [x] Backend endpointlerini curl ile happy/error/edge-case test et
- [x] Test bulgularına göre gerekli düzeltmeleri uygula
- [x] Son durum raporunu paylaş
- [x] UI dark tema dönüşümü için global stil altyapısını güncelle (`apps/web/src/index.css`)
- [x] App layout ve component class'larını ilk referans görseldeki renk paletine geçir (`apps/web/src/App.tsx`)
- [x] Menü/başlık/kart/buton görsellerini neon vurgulu koyu tasarıma hizala
- [x] Görsel tutarlılık kontrolü için çalıştırma doğrulama adımını tamamla
- [x] Ürünler sayfası sütunlarını tek tek zenginleştir (ürün özeti + fiyat + stok durumu + işlem sütunu)
- [x] Ürünler tablosuna üst KPI satırı ve toplu aksiyon alanı ekle
- [x] Ürünler sayfasını manuel kontrol edip bir sonraki sayfaya (XML) geç
- [x] Admin login endpointini ekle (JWT cookie + role=ADMIN)
- [x] Sadece ADMIN için şifre değiştirme endpointi ekle (`POST /admin/change-password`)
- [x] Ayarlar ekranında yalnız admin için "Yönetici İşlemleri" panelini göster
- [x] Curl ile admin/normal kullanıcı yetki testlerini tamamla (happy/error/edge)
- [x] Kritik-path: Kontrol Paneli'ni gerçek KPI + sağlık özeti ile kullanılabilir hale getir
- [x] Kritik-path: Ürünler modülünü gerçek veri + arama + filtre + tablo görünümüyle tamamla
- [x] Kritik-path: Pazaryerleri modülünü durum yönetimi + sync akışıyla güçlendir
- [x] Kritik-path tiplerini `apps/web/src/types.ts` içinde genişlet ve type-safe hale getir
- [x] Kritik-path modüller için thorough test (build + ui walkthrough) yap
- [x] Bu iterasyonda: sol menü sırasıyla modülleri tamamlama (Kontrol Paneli -> XML -> Ürünler -> Kategori -> Varyant -> Marka -> Şablon -> Pazaryeri -> Gönderim -> Sipariş -> Rapor -> Ayar -> Log)
- [x] Bu iterasyonda: apps/web/src/types.ts tip genişletmeleri
- [x] Bu iterasyonda: web+server build ve UI/API testleri
- [x] Settings.tsx'e admin paneli eklendi (kullanıcı yönetimi + şifre değiştirme)
- [x] Server.tsx'e `/auth/me` endpoint'i eklendi
- [x] Tüm sayfalar dolduruldu ve işlevsel hale getirildi

## 📋 Mevcut Durum Özeti

### Server (apps/server)
- ✅ Express server, auth (JWT + cookie), RBAC
- ✅ Prisma ORM ile PostgreSQL
- ✅ SSE (Server-Sent Events) canlı güncelleme
- ✅ BullMQ queue + worker altyapısı
- ✅ XML import servisi
- ✅ Pazaryeri API servisi
- ✅ Otomasyon scheduler
- ✅ Tüm route'lar: products, orders, marketplaces, brands, categories, variants, templates, shipments, notifications, settings, finance, messages, audit-logs, users, xml-sources, automation, reports
- ✅ `/auth/login`, `/auth/me`, `/admin/change-password`

### Web UI (apps/web)
- ✅ Dark tema, responsive layout
- ✅ Sidebar menü + Header
- ✅ Tüm sayfalar dolu ve işlevsel:
  - Kontrol Paneli (Dashboard) - KPI kartları, XML hub, pazaryeri durumu
  - XML Kaynakları - Liste, ekleme, silme, import
  - Ürünler - Arama, filtreleme, sayfalama, detay modalı, toplu seçim
  - Kategori Eşleştirme - Liste, CRUD, tekil/toplu/otomatik eşleştirme
  - Marka Eşleştirme - Liste, CRUD
  - Varyant Eşleştirme - Liste, CRUD, toplu ekleme, tip bazlı gruplama
  - Pazaryerleri - Liste, CRUD, bağlantı testi
  - Gönderim Merkezi - Filtreleme, durum takibi
  - Siparişler - Filtreleme, durum takibi
  - Raporlar - Genel özet, finansal raporlar, ürün/pazaryeri analizi
  - Ayarlar - Firma bilgileri, şifre değiştirme, admin paneli (kullanıcı yönetimi)
  - Loglar - Sayfalama, renk kodlu aksiyonlar
- ✅ types.ts tüm tiplerle genişletilmiş

### Veritabanı (Prisma)
- ✅ Tüm migration'lar uygulanmış
- ✅ Otomasyon ve audit log alanları eklenmiş

## 🚀 Sonraki Adımlar (Opsiyonel İyileştirmeler)

- [ ] WebSocket ile gerçek zamanlı bildirimler
- [ ] Mobil uyumluluk iyileştirmeleri
- [ ] Performans optimizasyonu (lazy loading, memoization)
- [ ] E2E testleri (Playwright/Cypress)
- [ ] CI/CD pipeline
- [ ] Docker image optimizasyonu
- [ ] API dokümantasyonu (Swagger/OpenAPI)
