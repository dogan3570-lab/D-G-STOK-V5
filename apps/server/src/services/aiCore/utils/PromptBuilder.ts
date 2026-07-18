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
    };

    const builder = builders[module];
    if (builder) return builder(input);
    return `Modul: ${module}\nGirdi: ${JSON.stringify(input)}\n\nAnaliz et ve JSON cevap ver.`;
  }
}
