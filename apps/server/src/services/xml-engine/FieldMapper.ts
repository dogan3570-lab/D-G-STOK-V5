// ==================== ALAN EŞLEŞTİRME V5 ====================
// Kullanıcı tanımlı XML alanlarını sistem alanlarına eşler
// =========================================================

export class FieldMapper {
  /**
   * Kullanıcı tanımlı mapping'i uygular
   * @param raw - Ham veri
   * @param mapping - Kullanıcı tanımlı alan eşleştirme { 'xml_alan': 'sistem_alan' }
   * @returns Eşlenmiş veri
   */
  apply(raw: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = { ...raw };

    for (const [xmlField, systemField] of Object.entries(mapping)) {
      if (raw[xmlField] !== undefined && xmlField !== systemField) {
        result[systemField] = raw[xmlField];
        // Orijinal alanı temizleme (koru)
      }
    }

    return result;
  }

  /**
   * XML kaynağına kayıtlı mapping'i getirir
   */
  async getMapping(sourceId: string): Promise<Record<string, string>> {
    const { prisma } = await import('../../db/prisma.ts');
    const source = await prisma.xmlSource.findUnique({
      where: { id: sourceId },
      select: { fieldMapping: true },
    });

    if (!source?.fieldMapping) return {};

    try {
      return JSON.parse(source.fieldMapping);
    } catch {
      return {};
    }
  }

  /**
   * XML kaynağına mapping kaydeder
   */
  async saveMapping(sourceId: string, mapping: Record<string, string>): Promise<void> {
    const { prisma } = await import('../../db/prisma.ts');
    await prisma.xmlSource.update({
      where: { id: sourceId },
      data: { fieldMapping: JSON.stringify(mapping) },
    });
  }
}
