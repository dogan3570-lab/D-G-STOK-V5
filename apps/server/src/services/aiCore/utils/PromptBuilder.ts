export class PromptBuilder {
  build(module: string, input: any): string {
    const builders: Record<string, (input: any) => string> = {
      ErrorAnalyzer: (data) => `
Asagidaki API hatasini analiz et ve cozum onerisi sun.

Hata Kodu: ${data.errorCode || 'Bilinmiyor'}
Hata Mesaji: ${data.errorMessage || 'Yok'}
Pazaryeri: ${data.marketplaceKey || 'Bilinmiyor'}
Urun ID: ${data.productId || 'Bilinmiyor'}
Reddedilen Alan: ${data.rejectedField || 'Bilinmiyor'}

Analiz:
- Hata tipi nedir?
- Cozum onerisi nedir?
- Otomatik duzeltilebilir mi?
- Guven skoru (0-100):

JSON formatinda cevap ver.`,
      
      ForbiddenWordEngine: (data) => `
Asagidaki metni yasakli kelimeler acisindan analiz et.

Metin: ${data.text || ''}
Pazaryeri: ${data.marketplaceKey || 'Genel'}

Analiz:
- Yasakli kelime var mi?
- Onerilen alternatif nedir?
- Guven skoru (0-100):

JSON formatinda cevap ver.`,
      
      PreflightChecker: (data) => `
Asagidaki urunu gonderime hazirlik acisindan degerlendir.

Urun: ${data.title || 'Bilinmiyor'}
Kategori: ${data.category || 'Bilinmiyor'}
Marka: ${data.brand || 'Bilinmiyor'}
Fiyat: ${data.price || 'Belirtilmemis'}
Stok: ${data.stock || 'Belirtilmemis'}

Degerlendir:
- Urun gonderime hazir mi?
- Varsa eksikler neler?
- Guven skoru (0-100):
- Oneriler:

JSON formatinda cevap ver.`,

      CategoryMatcher: (data) => `
Sen bir kategori eşleştirme uzmanısın. Verilen ürün bilgilerine göre en uygun sistem kategorisini belirle.

Ürün Bilgileri:
- Ürün Adı: ${data.title || 'Bilinmiyor'}
- XML Kategorisi: ${data.supplierCategory || 'Bilinmiyor'}
- Açıklama: ${data.description || 'Bilinmiyor'}
- Marka: ${data.brandName || 'Bilinmiyor'}
- XML Kaynağı: ${data.xmlSourceName || 'Bilinmiyor'}

Mevcut Sistem Kategorileri:
${(data.systemCategories || []).map((cat: any) => `- ${cat.id}: ${cat.name} (${cat.fullPath || cat.name})`).join('\n')}

Analiz et ve aşağıdaki JSON formatında cevap ver:
{
  "categoryId": "en uygun kategori ID'si veya null",
  "categoryName": "kategori adı",
  "confidence": 0-100 arası güven skoru,
  "reasoning": "kısa gerekçe"
}

NOT:
- Confidence >= 95 ise otomatik eşleştirilir
- Confidence 80-94 arası öneri olarak sunulur
- Confidence < 80 ise manuel incelemeye gönderilir
- Emin değilsen categoryId: null ve confidence: 0 döndür`,

      BrandMatcher: (data) => `
Sen bir marka eşleştirme uzmanısın. Verilen ürün bilgilerine göre en uygun sistem markasını belirle.

Ürün Bilgileri:
- Ürün Adı: ${data.title || 'Bilinmiyor'}
- XML Markası: ${data.xmlBrandName || 'Bilinmiyor'}
- Açıklama: ${data.description || 'Bilinmiyor'}
- Barkod: ${data.barcode || 'Bilinmiyor'}
- Tedarikçi: ${data.supplierName || 'Bilinmiyor'}
- Mevcut Marka ID: ${data.currentBrandId || 'Yok'}

Mevcut Sistem Markaları:
${(data.systemBrands || []).map((b: any) => `- ${b.id}: ${b.name}`).join('\n')}

Analiz et ve aşağıdaki JSON formatında cevap ver:
{
  "brandId": "en uygun marka ID'si veya null",
  "brandName": "marka adı",
  "confidence": 0-100 arası güven skoru,
  "reasoning": "kısa gerekçe"
}

NOT:
- Confidence >= 95 ise otomatik eşleştirilir
- Confidence 80-94 arası öneri olarak sunulur
- Confidence < 80 ise manuel incelemeye gönderilir
- Emin değilsen brandId: null ve confidence: 0 döndür`,
    };

    const builder = builders[module];
    if (builder) return builder(input);
    return `Modul: ${module}\nGirdi: ${JSON.stringify(input)}\n\nAnaliz et ve JSON cevap ver.`;
  }
}
