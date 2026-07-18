# DG STOK V5.0 — GitHub Main Branch Analiz Raporu

**Tarih:** 2026-07-18
**Commit:** `0d2e035`
**Analiz Türü:** Yapısal Kod Analizi (Sadece Okuma, Değişiklik Yok)

---

## 1. PROJE KLASÖR AĞACI (GitHub'daki hali)

```
DG STOK V5.0/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.app.yml
├── nginx.conf
├── package.json
├── package-lock.json
│
├── apps/
│   ├── server/                    # Express API sunucusu (ANA)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts           # Entry point
│   │       ├── server.ts          # Express server kurulumu
│   │       ├── bootstrap.ts       # Başlangıç işlemleri
│   │       ├── env.ts             # Çevre değişkenleri
│   │       ├── db/
│   │       │   ├── prisma.ts      # Prisma client
│   │       │   └── ensureDb.ts    # DB hazırlık
│   │       ├── auth/
│   │       │   └── authMiddleware.ts
│   │       ├── middleware/
│   │       │   └── errorHandler.ts
│   │       ├── queue/             # BullMQ kuyruk
│   │       │   ├── index.ts
│   │       │   └── jobTypes.ts
│   │       ├── workers/
│   │       │   └── index.ts
│   │       ├── sse/
│   │       │   ├── events.ts
│   │       │   └── websocket.ts
│   │       ├── actions/
│   │       │   └── marketplaceSync.ts
│   │       ├── types/
│   │       │   └── ssh2-sftp-client.d.ts
│   │       ├── routes/            # 50+ route dosyası
│   │       │   ├── index.ts       # Route registry (26 route bağlı)
│   │       │   ├── actions.ts
│   │       │   ├── ai.ts
│   │       │   ├── automation.ts
│   │       │   ├── bi.ts          ★ REGISTER EDİLMEMİŞ
│   │       │   ├── brands.ts
│   │       │   ├── brands-policy.ts
│   │       │   ├── brandsV3.ts
│   │       │   ├── categories.ts
│   │       │   ├── contentEngine.ts
│   │       │   ├── dashboard.ts   ★ REGISTER EDİLMEMİŞ
│   │       │   ├── dispatch.ts    ★ REGISTER EDİLMEMİŞ
│   │       │   ├── dqc.ts
│   │       │   ├── finance.ts     ★ REGISTER EDİLMEMİŞ
│   │       │   ├── forensic.ts    ★ REGISTER EDİLMEMİŞ
│   │       │   ├── hepsiburada.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── listingV2.ts   ★ REGISTER EDİLMEMİŞ
│   │       │   ├── listings.ts
│   │       │   ├── marketplaceTest.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── mdm.ts
│   │       │   ├── n11.ts         ★ REGISTER EDİLMEMİŞ
│   │       │   ├── operations.ts  ★ REGISTER EDİLMEMİŞ
│   │       │   ├── orders.ts      ★ REGISTER EDİLMEMİŞ
│   │       │   ├── pipeline.ts
│   │       │   ├── plm.ts
│   │       │   ├── products.ts
│   │       │   ├── providers.ts   ★ REGISTER EDİLMEMİŞ
│   │       │   ├── recalculation.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── reconciliation.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── reports.ts
│   │       │   ├── rules.ts
│   │       │   ├── stockProtection.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── system.ts      ★ REGISTER EDİLMEMİŞ
│   │       │   ├── title.ts
│   │       │   ├── transform.ts
│   │       │   ├── trendyol.ts    ★ REGISTER EDİLMEMİŞ
│   │       │   ├── twin.ts
│   │       │   ├── variant-consistency.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── variants.ts
│   │       │   ├── variantsV2.ts
│   │       │   ├── variantsV4.ts
│   │       │   ├── variantsV5.ts
│   │       │   ├── workflow.ts
│   │       │   ├── workflow-v2.ts ★ REGISTER EDİLMEMİŞ
│   │       │   ├── workflowState.ts
│   │       │   ├── xml-engine.ts  ★ REGISTER EDİLMEMİŞ
│   │       │   ├── xmlSources.ts
│   │       │   └── xmlv2.ts       ★ REGISTER EDİLMEMİŞ
│   │       └── services/          # 40+ servis modülü
│   │           ├── aiCore/
│   │           ├── aiEngine.ts
│   │           ├── audit/
│   │           ├── automationScheduler.ts
│   │           ├── autoRecalculation/
│   │           ├── barcode/
│   │           ├── brandPolicy.ts
│   │           ├── contentEngine/
│   │           ├── dashboard/
│   │           ├── dqcEngine.ts
│   │           ├── eventBus/
│   │           ├── finance/
│   │           ├── financeEngine.ts
│   │           ├── forensicEngine.ts
│   │           ├── listingEngine.ts
│   │           ├── listingEngineV2/
│   │           ├── logger.ts
│   │           ├── marketplace/
│   │           ├── marketplaceApi.ts
│   │           ├── marketplaces/     (trendyol/, n11/, core/)
│   │           ├── operation/
│   │           ├── productAnalysis.ts
│   │           ├── providers/        (Api, Csv, Excel, Ftp, Json, Sftp)
│   │           ├── publishingEngine.ts
│   │           ├── reconciliationEngine.ts
│   │           ├── stockMonitor.ts
│   │           ├── stockProtection/
│   │           ├── titleEngine.ts
│   │           ├── transformationEngine.ts
│   │           ├── trendyol/
│   │           ├── variant/
│   │           ├── variantEngine.ts         ★ ESKİ V1
│   │           ├── variantEngineV2.ts       ★ ESKİ V2
│   │           ├── variantEngineV4/         ★ ESKİ V4
│   │           ├── variantEngineV5/         ★ GÜNCEL V5
│   │           ├── workflow/
│   │           ├── workflowEngine.ts
│   │           ├── xml-engine/
│   │           ├── xmlImport.ts
│   │           └── xmlv2/
│   │
│   └── web/                        # React + Vite frontend (ANA)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx             # Router (10 sayfa kullanıyor)
│           ├── types.ts
│           ├── index.css
│           ├── styles/
│           │   └── theme.css
│           ├── hooks/
│           │   ├── useDebounce.ts
│           │   ├── useKeyboard.ts
│           │   └── useTheme.ts
│           ├── lib/
│           │   ├── api.ts
│           │   ├── constants.ts
│           │   ├── design-system.tsx
│           │   ├── theme-context.tsx
│           │   ├── theme-styles.ts
│           │   └── utils.ts
│           ├── components/
│           │   ├── Categories.tsx
│           │   ├── Dashboard.tsx
│           │   ├── ErrorBoundary.tsx
│           │   ├── Marketplaces.tsx
│           │   ├── Products.tsx
│           │   ├── Suppliers.tsx
│           │   ├── Layout/
│           │   │   ├── Header.tsx
│           │   │   └── Sidebar.tsx
│           │   └── ui/
│           │       ├── KpiCard.tsx
│           │       ├── Modal.tsx
│           │       └── Toast.tsx
│           └── pages/
│               ├── Dashboard.tsx          ✓ KULLANILIYOR
│               ├── XmlSources.tsx         ✓ KULLANILIYOR
│               ├── ProductPool.tsx        ✓ KULLANILIYOR
│               ├── ProductPreparation.tsx ✓ KULLANILIYOR
│               ├── ReadyToSend.tsx        ✓ KULLANILIYOR
│               ├── MarketplaceManagement.tsx ✓ KULLANILIYOR
│               ├── Login.tsx              ✓ KULLANILIYOR
│               ├── Orders.tsx             ✓ KULLANILIYOR
│               ├── Reports.tsx            ✓ KULLANILIYOR
│               ├── Settings.tsx           ✓ KULLANILIYOR
│               ├── VariantExceptionScreen.tsx ✓ KULLANILIYOR
│               ├── AuditLogs.tsx          ✗ KULLANILMIYOR
│               ├── Automation.tsx         ✗ KULLANILMIYOR
│               ├── Brands.tsx             ✗ KULLANILMIYOR
│               ├── Categories.tsx         ✗ KULLANILMIYOR
│               ├── DataHealthCenter.tsx   ✗ KULLANILMIYOR
│               ├── Finance.tsx            ✗ KULLANILMIYOR
│               ├── ListingEngineV2.tsx    ✗ KULLANILMIYOR
│               ├── Marketplace.tsx        ✗ KULLANILMIYOR
│               ├── MarketplaceIntegration.tsx ✗ KULLANILMIYOR
│               ├── MarketplaceOperations.tsx ✗ KULLANILMIYOR
│               ├── Messages.tsx           ✗ KULLANILMIYOR
│               ├── Notifications.tsx      ✗ KULLANILMIYOR
│               ├── Orchestrator.tsx       ✗ KULLANILMIYOR
│               ├── Products.tsx           ✗ KULLANILMIYOR
│               ├── ProviderTestCenter.tsx ✗ KULLANILMIYOR
│               ├── Shipments.tsx          ✗ KULLANILMIYOR
│               ├── Templates.tsx          ✗ KULLANILMIYOR
│               ├── Users.tsx              ✗ KULLANILMIYOR
│               ├── Variants.tsx           ✗ KULLANILMIYOR
│               ├── VariantReviewV5.tsx    ✗ KULLANILMIYOR
│               ├── XmlEnginePanel.tsx     ✗ KULLANILMIYOR
│               └── prep/                  (alt bileşenler)
│                   ├── BrandMatchTab.tsx
│                   ├── CategoryMatchTab.tsx
│                   ├── ListingTemplateTab.tsx
│                   ├── PrepProductRow.tsx
│                   ├── PrepStatusBadge.tsx
│                   ├── PrepSummary.tsx
│                   ├── VariantMatchTab.tsx
│                   └── types.ts
│
├── backend/                        # NESTJS (Alternatif API)
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── common/
│       ├── database/
│       ├── modules/
│       │   ├── audit-logs/
│       │   ├── auth/
│       │   ├── automation/
│       │   ├── brands/
│       │   ├── categories/
│       │   ├── discounts/
│       │   ├── finance/
│       │   ├── health/
│       │   ├── import/
│       │   ├── inventory/
│       │   ├── marketplaces/
│       │   ├── messages/
│       │   ├── notifications/
│       │   ├── orders/
│       │   ├── products/
│       │   ├── reports/
│       │   ├── self-healing/
│       │   ├── shipments/
│       │   ├── suppliers/
│       │   ├── templates/
│       │   ├── users/
│       │   └── variants/
│       └── ...
│
├── frontend/                       # NEXT.JS (Alternatif Storefront)
│   ├── package.json
│   ├── next.config.ts
│   ├── Dockerfile
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Ana sayfa
│       │   ├── layout.tsx
│       │   ├── auth/
│       │   ├── account/
│       │   ├── admin/              # 20+ admin sayfası
│       │   ├── cart/
│       │   ├── checkout/
│       │   └── products/
│       ├── components/
│       └── lib/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/                 # 11 migration
│
├── docs/                           # B grubu (isteğe bağlı)
├── plans/                          # B grubu (isteğe bağlı)
└── temp-n11/                       # C grubu (commit dışı)
```

---

## 2. KULLANILAN MODÜLLER

### 2.1 Express API — Aktif Route'lar (`routes/index.ts`)

| Route | Dosya | Durum |
|-------|-------|-------|
| `/actions` | `routes/actions.ts` | ✅ Aktif |
| `/xml-sources` | `routes/xmlSources.ts` | ✅ Aktif |
| `/categories` | `routes/categories.ts` | ✅ Aktif |
| `/variants` | `routes/variants.ts` | ✅ Aktif |
| `/automation` | `routes/automation.ts` | ✅ Aktif |
| `/reports` | `routes/reports.ts` | ✅ Aktif |
| `/products` | `routes/products.ts` | ✅ Aktif |
| `/brands` | `routes/brands.ts` | ✅ Aktif |
| `/brand-policies` | `routes/brands-policy.ts` | ✅ Aktif |
| `/transform` | `routes/transform.ts` | ✅ Aktif |
| `/title` | `routes/title.ts` | ✅ Aktif |
| `/workflow` | `routes/workflow.ts` | ✅ Aktif |
| `/ai` | `routes/ai.ts` | ✅ Aktif |
| `/plm` | `routes/plm.ts` | ✅ Aktif |
| `/rules` | `routes/rules.ts` | ✅ Aktif |
| `/dqc` | `routes/dqc.ts` | ✅ Aktif |
| `/twin` | `routes/twin.ts` | ✅ Aktif |
| `/mdm` | `routes/mdm.ts` | ✅ Aktif |
| `/pipeline` | `routes/pipeline.ts` | ✅ Aktif |
| `/listings` | `routes/listings.ts` | ✅ Aktif |
| `/variants/v2` | `routes/variantsV2.ts` | ✅ Aktif |
| `/variants/v4` | `routes/variantsV4.ts` | ✅ Aktif |
| `/content` | `routes/contentEngine.ts` | ✅ Aktif |
| `/brands/v3` | `routes/brandsV3.ts` | ✅ Aktif |
| `/variants/v5` | `routes/variantsV5.ts` | ✅ Aktif |
| `/workflow-state` | `routes/workflowState.ts` | ✅ Aktif |
| `/marketplaces` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/orders` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/notifications` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/settings` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/finance` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/messages` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/shipments` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/templates` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/audit-logs` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/users` | (inline, `routes/index.ts`) | ✅ Aktif |
| `/dashboard/summary` | (inline) | ✅ Aktif |
| `/dashboard/stats` | (inline) | ✅ Aktif |
| `/xml/import` | (inline) | ✅ Aktif |
| `/admin/change-password` | (inline) | ✅ Aktif |

### 2.2 React Frontend — Kullanılan Sayfalar (`App.tsx`)

| Sayfa | Bileşen | Route Key |
|-------|---------|-----------|
| Kontrol Paneli | `Dashboard.tsx` | `kontrol` |
| XML Kaynakları | `XmlSources.tsx` | `xml` |
| Ürün Havuzu | `ProductPool.tsx` | `urunhavuzu` |
| Ürün Hazırlama | `ProductPreparation.tsx` | `urunhazirlama` |
| Gönderime Hazır | `ReadyToSend.tsx` | `gonderimehazir` |
| Varyant İstisnaları | `VariantExceptionScreen.tsx` | `varyant` |
| Pazaryeri Yönetimi | `MarketplaceManagement.tsx` | `pazaryeri` |
| Siparişler | `Orders.tsx` | `siparis` |
| Raporlar | `Reports.tsx` | `rapor` |
| Ayarlar | `Settings.tsx` | `ayar` |

---

## 3. KULLANILMAYAN MODÜLLER

### 3.1 Register Edilmemiş Route Dosyaları (ÖLÜ KOD)

Bu dosyalar diskte var ancak `routes/index.ts`'e import edilmemiş ve register edilmemiş:

| Route Dosyası | Tahmini Kapsamı | Risk |
|---------------|----------------|------|
| `routes/bi.ts` | Business Intelligence | 🟡 Orta |
| `routes/dashboard.ts` | Dashboard API | 🔴 Yüksek — dashboard.ts servisi de var |
| `routes/dispatch.ts` | Sevk/İrsaliye | 🟢 Düşük |
| `routes/finance.ts` | Finans | 🟡 Orta — `financeEngine.ts` ile çakışma |
| `routes/forensic.ts` | Adli bilişim | 🟢 Düşük |
| `routes/hepsiburada.ts` | Hepsiburada API | 🟡 Orta |
| `routes/listingV2.ts` | Listing V2 | 🟡 Orta |
| `routes/marketplaceTest.ts` | Marketplace test | 🟢 Düşük |
| `routes/n11.ts` | N11 API | 🟡 Orta |
| `routes/operations.ts` | Operasyon | 🟡 Orta |
| `routes/orders.ts` | Siparişler | 🔴 Yüksek — inline `/orders` ile çakışma |
| `routes/providers.ts` | Sağlayıcılar | 🟡 Orta |
| `routes/recalculation.ts` | Yeniden hesaplama | 🟡 Orta |
| `routes/reconciliation.ts` | Mutabakat | 🟡 Orta |
| `routes/stockProtection.ts` | Stok koruma | 🟡 Orta |
| `routes/system.ts` | Sistem | 🟡 Orta |
| `routes/trendyol.ts` | Trendyol API | 🟡 Orta |
| `routes/variant-consistency.ts` | Varyant tutarlılık | 🟢 Düşük |
| `routes/workflow-v2.ts` | Workflow V2 | 🟡 Orta |
| `routes/xml-engine.ts` | XML Motoru | 🟡 Orta |
| `routes/xmlv2.ts` | XML V2 | 🟡 Orta |

### 3.2 React Frontend — Kullanılmayan Sayfalar

Bu sayfalar `App.tsx`'te import edilmemiş ve switch-case'te kullanılmamış:

| Sayfa | Durum | Açıklama |
|-------|-------|----------|
| `AuditLogs.tsx` | 🟢 Ölü kod | Denetim logları sayfası |
| `Automation.tsx` | 🟢 Ölü kod | Otomasyon sayfası |
| `Brands.tsx` | 🟢 Ölü kod | Marka yönetimi |
| `Categories.tsx` | 🟢 Ölü kod | Kategori yönetimi |
| `DataHealthCenter.tsx` | 🟢 Ölü kod | Veri sağlığı merkezi |
| `Finance.tsx` | 🟢 Ölü kod | Finans sayfası |
| `ListingEngineV2.tsx` | 🟢 Ölü kod | Listing motoru (1212 satır!) |
| `Marketplace.tsx` | 🟢 Ölü kod | Marketplace sayfası |
| `MarketplaceIntegration.tsx` | 🟢 Ölü kod | Entegrasyon sayfası |
| `MarketplaceOperations.tsx` | 🟢 Ölü kod | Operasyon sayfası |
| `Messages.tsx` | 🟢 Ölü kod | Mesaj sayfası |
| `Notifications.tsx` | 🟢 Ölü kod | Bildirim sayfası |
| `Orchestrator.tsx` | 🟢 Ölü kod | Orkestratör sayfası |
| `Products.tsx` | 🟢 Ölü kod | Ürün sayfası |
| `ProviderTestCenter.tsx` | 🟢 Ölü kod | Sağlayıcı test merkezi |
| `Shipments.tsx` | 🟢 Ölü kod | Sevkiyat sayfası |
| `Templates.tsx` | 🟢 Ölü kod | Şablon sayfası |
| `Users.tsx` | 🟢 Ölü kod | Kullanıcı yönetimi |
| `Variants.tsx` | 🟢 Ölü kod | Varyant sayfası |
| `VariantReviewV5.tsx` | 🟢 Ölü kod | Varyant inceleme (138 satır) |
| `XmlEnginePanel.tsx` | 🟢 Ölü kod | XML motor paneli (712 satır!) |

### 3.3 Kullanılmayan Componentler (`components/`)

| Bileşen | Kullanım |
|---------|----------|
| `components/Categories.tsx` | 🔴 App.tsx'te import edilmemiş |
| `components/Dashboard.tsx` | 🔴 App.tsx'te import edilmemiş |
| `components/Marketplaces.tsx` | 🔴 App.tsx'te import edilmemiş |
| `components/Products.tsx` | 🔴 App.tsx'te import edilmemiş |
| `components/Suppliers.tsx` | 🔴 App.tsx'te import edilmemiş |

---

## 4. ESKİ / ÇAKIŞAN MOTORLAR (VARYANT ENGINE)

### 4.1 Varyant Engine Sürümleri

| Motor | Dosya | Satır | Durum | Kullanılıyor mu? |
|-------|-------|-------|-------|-----------------|
| **variantEngine.ts** (V1) | `services/variantEngine.ts` | ~150 | 🟢 ESKİ | `routes/variants.ts` hala V1'i import ediyor olabilir |
| **variantEngineV2.ts** (V2) | `services/variantEngineV2.ts` | ~200 | 🟢 ESKİ | `routes/variantsV2.ts` tarafından kullanılıyor |
| **variantEngineV4/** (V4) | `services/variantEngineV4/` | 2 dosya | 🟢 ESKİ | `routes/variantsV4.ts` tarafından kullanılıyor |
| **variantEngineV5/** (V5) | `services/variantEngineV5/` | 15 dosya | ✅ GÜNCEL | `routes/variantsV5.ts` tarafından kullanılıyor |
| **xmlv2/VariantEngineV2.ts** | `services/xmlv2/VariantEngineV2.ts` | 332 satır | 🟢 ESKİ/ÇAKIŞAN | XML motoru ile bağlantılı |

**⚠️ Uyarı:** `variantEngineV2.ts` (tekil dosya) ile `xmlv2/VariantEngineV2.ts` aynı isimde ancak farklı amaçlarla. Bu karışıklığa yol açabilir.

### 4.2 Listing Engine Çakışması

| Motor | Dosya | Durum |
|-------|-------|-------|
| **listingEngine.ts** (V1) | `services/listingEngine.ts` | 🟢 ESKİ |
| **listingEngineV2/** (V2) | `services/listingEngineV2/` | ✅ GÜNCEL |

### 4.3 Workflow Engine Çakışması

| Motor | Dosya | Durum |
|-------|-------|-------|
| **workflowEngine.ts** (inline) | `services/workflowEngine.ts` | 🟢 ESKİ |
| **workflow/** (modüler) | `services/workflow/` | ✅ GÜNCEL |

---

## 5. DUPLICATE KODLAR / ÇAKIŞAN YAPILAR

### 5.1 İkili API Sunucuları (Monolit vs NestJS)

| Özellik | `apps/server/` (Express) | `backend/` (NestJS) |
|---------|------------------------|---------------------|
| Framework | Express.js | NestJS |
| Modüller | Tüm modüller mevcut | Aynı modüller tekrar yazılmış |
| Durum | ✅ ANA sunucu | 🔴 TERK EDİLMİŞ olabilir |

**NestJS (`backend/`)** içindeki modüllerin neredeyse tamamı `apps/server/` ile aynı işi yapıyor:
- `auth` → `authMiddleware.ts`
- `brands` → `routes/brands.ts`
- `categories` → `routes/categories.ts`
- `finance` → `routes/finance.ts` + `financeEngine.ts`
- `marketplaces` → `routes/index.ts` (inline)
- `orders` → `routes/orders.ts` (inline)
- `products` → `routes/products.ts`
- `users` → `routes/index.ts` (inline)
- `variants` → `routes/variants*.ts`
- `shipments` → `routes/index.ts` (inline)
- `templates` → `routes/index.ts` (inline)

### 5.2 İkili Frontend'ler (React vs Next.js)

| Özellik | `apps/web/` (React+Vite) | `frontend/` (Next.js) |
|---------|------------------------|----------------------|
| Framework | React + Vite | Next.js 14 |
| Sayfalar | 10 aktif + 22 ölü | 20+ admin sayfası + storefront |
| Durum | ✅ ANA frontend | 🔴 İKİNCİL (storefront) |

### 5.3 Marketplace Servis Çakışması

İKİ FARKLI marketplace servis katmanı var:

1. **`services/marketplace/`** — Eski yapı (N11Provider, TrendyolStageProvider, ApiDiagnosticEngine, vb.)
2. **`services/marketplaces/`** — Yeni yapı (core/ adaptör deseni, trendyol/ entegrasyonu, n11/ adaptörü)

Bu iki dizin neredeyse aynı işi yapıyor.

### 5.4 XML Motor Çakışması

1. **`services/xmlImport.ts`** — Eski XML import
2. **`services/xml-engine/`** — Yeni XML Engine V5 (XmlEngineV5, XmlImportWorker, adaptörler)
3. **`services/xmlv2/`** — XML V2 (QualityEngine, VariantEngineV2, DecisionLogger)

### 5.5 Providers (Veri Sağlayıcı) Çakışması

1. **`services/providers/`** — ProviderRegistry ile (Api, Csv, Excel, Ftp, Json, Sftp)
2. **`services/xml-engine/adapters/`** — XML Engine adaptörleri (Csv, Excel, Ftp, Json, Sftp, Xml)

İkisi de aynı adaptör desenini kullanıyor ancak ayrı implementasyonlar.

---

## 6. SİLİNEBİLECEK DOSYALAR (Öneri)

### 🔴 Yüksek Öncelikli (Kullanılmadığı Kesin)

| Dosya | Nedeni |
|-------|--------|
| `backend/` (tümü) | NestJS alternatifi, `apps/server/` ile tam çakışma |
| `frontend/` (tümü) | Next.js alternatifi, `apps/web/` ile çakışma |
| `apps/web/src/pages/AuditLogs.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Automation.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Brands.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Categories.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Finance.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Marketplace.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Messages.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Notifications.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Orchestrator.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Products.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Shipments.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Templates.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Users.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/pages/Variants.tsx` | App.tsx'te kullanılmıyor |
| `apps/web/src/components/Categories.tsx` | Import edilmemiş |
| `apps/web/src/components/Dashboard.tsx` | Import edilmemiş |
| `apps/web/src/components/Marketplaces.tsx` | Import edilmemiş |
| `apps/web/src/components/Products.tsx` | Import edilmemiş |
| `apps/web/src/components/Suppliers.tsx` | Import edilmemiş |

### 🟡 Orta Öncelikli (Register Edilmemiş Route'lar)

| Route Dosyası |
|---------------|
| `apps/server/src/routes/bi.ts` |
| `apps/server/src/routes/dashboard.ts` |
| `apps/server/src/routes/dispatch.ts` |
| `apps/server/src/routes/finance.ts` |
| `apps/server/src/routes/forensic.ts` |
| `apps/server/src/routes/hepsiburada.ts` |
| `apps/server/src/routes/listingV2.ts` |
| `apps/server/src/routes/marketplaceTest.ts` |
| `apps/server/src/routes/n11.ts` |
| `apps/server/src/routes/operations.ts` |
| `apps/server/src/routes/orders.ts` |
| `apps/server/src/routes/providers.ts` |
| `apps/server/src/routes/recalculation.ts` |
| `apps/server/src/routes/reconciliation.ts` |
| `apps/server/src/routes/stockProtection.ts` |
| `apps/server/src/routes/system.ts` |
| `apps/server/src/routes/trendyol.ts` |
| `apps/server/src/routes/variant-consistency.ts` |
| `apps/server/src/routes/workflow-v2.ts` |
| `apps/server/src/routes/xml-engine.ts` |
| `apps/server/src/routes/xmlv2.ts` |

### 🟢 Düşük Öncelikli (Eski Motorlar — Servis Olarak Kalabilir)

| Servis | Alternatifi |
|--------|-------------|
| `services/variantEngine.ts` (V1) | `services/variantEngineV5/` |
| `services/listingEngine.ts` | `services/listingEngineV2/` |
| `services/workflowEngine.ts` | `services/workflow/` |
| `services/marketplace/` (eski) | `services/marketplaces/` (yeni) |
| `services/providers/` | `services/xml-engine/adapters/` |

---

## 7. RİSKLİ DOSYALAR

### 🔴 Kritik Riskler

| Dosya | Risk | Açıklama |
|-------|------|----------|
| `routes/index.ts` | 🔴 **KARİSHANE** | 685 satır, inline route'lar + import'lar — bakımı zor |
| `server.ts` | 🔴 **KARİSHANE** | Auth, seed, route attach, static serve tek dosyada |
| `services/stockProtection/StockProtectionEngine.ts` | 🔴 **1060 SATIR** | Devasa tek dosya, modüllere ayrılmalı |
| `apps/web/src/pages/ListingEngineV2.tsx` | 🔴 **1212 SATIR** | Aşırı büyük React bileşeni |

### 🟡 Orta Riskler

| Dosya | Risk | Açıklama |
|-------|------|----------|
| `apps/web/src/pages/Reports.tsx` | 🟡 859 satır | Büyük bileşen |
| `apps/web/src/pages/XmlEnginePanel.tsx` | 🟡 712 satır | Kullanılmıyor ama büyük |
| `apps/web/src/pages/ProductPreparation.tsx` | 🟡 Orta | 304 satır, `prep/` alt bileşenleri var |
| `services/forensicEngine.ts` | 🟡 605 satır | Büyük servis |
| `services/xml-engine/XmlEngineV5.ts` | 🟡 659 satır | Büyük servis |

### 🔵 Mimari Riskler

| Sorun | Açıklama |
|-------|----------|
| **Çift API** | Express (`apps/server/`) + NestJS (`backend/`) — hangisi production'da? |
| **Çift Frontend** | React+Vite (`apps/web/`) + Next.js (`frontend/`) — hangisi aktif? |
| **Servis Katmanı Dağınıklığı** | Marketplace servisleri 2 ayrı dizinde (`marketplace/` + `marketplaces/`) |
| **XML Motoru Dağınıklığı** | 3 ayrı XML implementasyonu (`xmlImport.ts`, `xml-engine/`, `xmlv2/`) |
| **Route Kayıtları Eksik** | 21 route dosyası `routes/index.ts`'e eklenmemiş |
| **Varyant Motoru Karmaşası** | V1, V2, V4, V5 aynı anda var — hangisi kullanılıyor? |

---

## 8. ÖZET İSTATİSTİKLER

| Metrik | Değer |
|--------|-------|
| Toplam dosya (commit) | 196 |
| Express route dosyası | 50+ (26 register edilmiş, 21+ register edilmemiş) |
| Servis modülü | 40+ |
| React sayfası | 33 (10 kullanılıyor, 23 ölü) |
| React bileşeni | 13 (5 ölü, 8 aktif) |
| Eski motor sürümü | 4 varyant + 2 listing + 2 workflow |
| Çakışan proje | `backend/` (NestJS) + `frontend/` (Next.js) |
| Riskli büyük dosya | 5 dosya (500+ satır) |

---

## 9. SONUÇ

### Yapısal Sorunlar

1. **İkili sistem:** İki API (Express + NestJS) ve iki frontend (React + Next.js) aynı projede. Bu, hangisinin production'da kullanıldığı sorusunu doğuruyor.

2. **Ölü kod oranı yüksek:** React sayfalarının %70'i (23/33) App.tsx'te kullanılmıyor. Route'ların %42'si (21/50) register edilmemiş.

3. **Eski motor birikimi:** Varyant motorunun 4 ayrı sürümü (V1, V2, V4, V5) aynı kod tabanında. Listing ve workflow'da da benzer durum.

4. **Servis dağınıklığı:** Marketplace, XML ve Provider servisleri birden fazla dizine yayılmış durumda, duplicate implementasyonlar mevcut.

### Önerilen Aksiyonlar

1. **Hangi sistemin kullanılacağına karar ver:** Express+React (apps/) mi, NestJS+Next.js (backend/ + frontend/) mi?
2. **Ölü route dosyalarını temizle:** 21 route dosyası ya register edilmeli ya da silinmeli.
3. **Ölü React sayfalarını temizle:** 23 sayfa ya App.tsx'e eklenmeli ya da silinmeli.
4. **Eski motorları kaldır:** V1, V2, V4 varyant motorları arşivlenmeli.
5. **Servisleri birleştir:** `marketplace/` + `marketplaces/`, `xmlImport.ts` + `xml-engine/` + `xmlv2/` birleştirilmeli.
6. **Büyük dosyaları böl:** `StockProtectionEngine.ts` (1060 satır), `routes/index.ts` (685 satır), `ListingEngineV2.tsx` (1212 satır) modüllere ayrılmalı.
