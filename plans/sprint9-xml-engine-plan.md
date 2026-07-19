# Sprint 9: XML Engine Production

## Mevcut Durum

### Var Olan
- `services/xmlImport.ts` (821 satır) - Ana import motoru
- `services/xml-engine/XmlEngineV5.ts` - V5 XML motoru
- `services/xml-engine/DuplicateChecker.ts`, `FieldMapper.ts`, vb.
- `routes/xmlSources.ts` - XML kaynak route
- `routes/xml-engine.ts` - XML Engine route
- `routes/xmlv2.ts` → legacy (taşındı mı kontrol et)

### Eksikler
- EventBus event'i EMIT etmiyor
- Diff engine yok (her seferinde tüm alanlar güncelleniyor)
- Product Pool status işaretlemesi yok
- WorkflowTimeline kaydı yok

## Yapılacaklar

### ADIM 1: Diff Engine
XML import'ta her ürün için eski-yeni karşılaştırması:
- title, description, barcode, sku, brand, category
- price, stock, images, variants
- Sadece değişen alanları güncelle

### ADIM 2: EventBus Entegrasyonu
xmlImport.ts'e EventBus.emit() ekle:
- ProductImportCompleted (toplu)
- ProductUpdated (her ürün)
- ProductStockChanged (stok değiştiyse)
- ProductImageChanged (görsel değiştiyse)

### ADIM 3: Product Pool Status
Her ürün için import sonrası:
- NEW → yeni oluşturuldu
- UPDATED → alan değişti
- UNCHANGED → hiçbir şey değişmedi
- REMOVED → XML'de yok, pasife al

### ADIM 4: SummaryService KPI'ları
Yeni kartlar:
- newProducts, updatedProducts, removedProducts
- xmlErrors, lastSyncAt

### ADIM 5: xmlv2 route legacy kontrol
`routes/xmlv2.ts` legacy'e taşındı mı?
