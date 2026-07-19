# DG STOK V5.0 – Pilot Sürüme Geri Dönüş Analiz Raporu

## 1. Pilot Testte Çalışan Commit

| Başlık | Detay |
|--------|-------|
| **Commit** | `0d2e035` - "DG STOK V5.0 - Stable Pilot Release" |
| **Tarih** | 18 Temmuz 2026, 20:41 |
| **Author** | Dogan Gılavuz |

## 2. Son Çalışan Tarih

**18 Temmuz 2026, saat 20:41** - Bu commit'te Ürün Hazırlama, Gönderime Hazır ve tüm UI ekranları çalışır durumdaydı.

## 3. Bozulan Commit

| Başlık | Detay |
|--------|-------|
| **Commit** | `890b496` - "Pilot test stabil sürüm - referans" |
| **Tarih** | 19 Temmuz 2026, 02:11 |
| **Sorun** | Prep alt bileşenleri silinmiş, ProductPreparation.tsx yeniden yazılmış |

## 4. Etkilenen Dosyalar (0d2e035 ↔ 890b496 arası)

### 🔴 Silinen / Kaybolan Dosyalar (Geri Getirilecek)
| Dosya | Durum | Etki |
|-------|-------|------|
| `apps/web/src/pages/prep/PrepProductRow.tsx` | ❌ Silinmiş | Ürün satırı kart yapısı çalışmıyor |
| `apps/web/src/pages/prep/PrepStatusBadge.tsx` | ❌ Silinmiş | Durum rozetleri görüntülenmiyor |
| `apps/web/src/pages/prep/PrepSummary.tsx` | ❌ Silinmiş | KPI özet kartları çalışmıyor |
| `apps/web/src/pages/prep/types.ts` | ❌ Silinmiş | Tip tanımları eksik |

### 🔧 Değiştirilen Dosyalar (Geri Alınacak)
| Dosya | Değişiklik | Etki |
|-------|-----------|------|
| `apps/web/src/pages/ProductPreparation.tsx` | 304 satır değişmiş | Alt bileşen referansları kırık, kart yapısı bozuk |
| `apps/web/src/pages/VariantExceptionScreen.tsx` | 27 satır değişmiş | Varyant istisna ekranı etkilenmiş |

### ✅ Korunacak Backend Dosyaları (Dokunulmayacak)
| Dosya | Açıklama |
|-------|----------|
| `apps/server/src/routes/brands.ts` | Brand API - AI geliştirmeleri korunacak |
| `apps/server/src/routes/categories.ts` | Kategori API - AI geliştirmeleri korunacak |
| `apps/server/src/routes/variantsV5.ts` | V5 Varyant Engine - korunacak |
| `apps/server/src/routes/index.ts` | Ana router - minor değişiklik |
| `apps/server/src/services/aiCore/utils/PromptBuilder.ts` | AI Prompt Builder - yeni dosya, korunacak |
| `apps/server/src/services/aiEngine.ts` | AI Engine - geliştirmeler korunacak |
| `apps/server/src/services/xmlImport.ts` | XML Import - minor değişiklik |

## 5. Geri Alınacak Dosyalar (Özet)

```
Geri getirilecek (restore from commit 0d2e035):
  apps/web/src/pages/prep/PrepProductRow.tsx
  apps/web/src/pages/prep/PrepStatusBadge.tsx
  apps/web/src/pages/prep/PrepSummary.tsx
  apps/web/src/pages/prep/types.ts
  apps/web/src/pages/ProductPreparation.tsx  (önceki çalışan versiyon)
  apps/web/src/pages/VariantExceptionScreen.tsx (önceki çalışan versiyon)
```

## 6. Korunacak Dosyalar (Hiç Dokunulmayacak)

```
apps/server/src/routes/brands.ts
apps/server/src/routes/categories.ts
apps/server/src/routes/variantsV5.ts
apps/server/src/routes/index.ts
apps/server/src/services/aiCore/utils/PromptBuilder.ts
apps/server/src/services/aiEngine.ts
apps/server/src/services/xmlImport.ts
apps/server/src/services/aiCore/AICore.ts
apps/server/src/services/variantEngineV5/
apps/server/src/services/xml-engine/
apps/server/src/services/xmlv2/
prisma/schema.prisma
```

## 7. Uygulama Planı

```bash
# 1. Prep alt bileşenlerini stable release'den geri getir
git checkout 0d2e035 -- apps/web/src/pages/prep/PrepProductRow.tsx
git checkout 0d2e035 -- apps/web/src/pages/prep/PrepStatusBadge.tsx
git checkout 0d2e035 -- apps/web/src/pages/prep/PrepSummary.tsx
git checkout 0d2e035 -- apps/web/src/pages/prep/types.ts

# 2. ProductPreparation.tsx'in stable versiyonunu geri getir
git checkout 0d2e035 -- apps/web/src/pages/ProductPreparation.tsx

# 3. VariantExceptionScreen.tsx'in stable versiyonunu geri getir
git checkout 0d2e035 -- apps/web/src/pages/VariantExceptionScreen.tsx

# 4. Backend dosyalarına dokunma (AI geliştirmeleri korunsun)
```

## 8. Risk Değerlendirmesi

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| ProductPreparation.tsx eski versiyonu yeni API'lerle uyumsuz olabilir | Orta | Yüksek | Geri alma sonrası test edilecek, küçük uyum düzeltmeleri yapılabilir |
| Prep alt bileşenleri yeni import yapısıyla çalışmayabilir | Düşük | Orta | Bileşenler bağımsız olduğu için sorun beklenmiyor |
| AI/Category/Brand backend değişiklikleri kaybolabilir | Düşük | Kritik | Sadece frontend dosyaları geri alınacak, backend'e dokunulmayacak |
