// ==================== VCM V6.0 TEST CENTER ====================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  process.stdout.write(`🧪 ${name}... `);
  try {
    await fn();
    console.log('✅');
    passed++;
  } catch (err) {
    console.log('❌', err.message);
    failed++;
  }
}

async function main() {
  console.log('');
  console.log('=== VARYANT EŞLEŞTİRME MERKEZİ V6.0 TEST ===');
  console.log('');

  // Test 1: DB Connection
  await runTest('Veritabanı Bağlantısı', async () => {
    await prisma.$queryRawUnsafe('SELECT 1');
  });

  // Test 2: Product Count
  await runTest('Ürün Sayısı', async () => {
    const count = await prisma.product.count();
    if (count < 0) throw new Error('Geçersiz sayı');
    console.log(`(${count} ürün)`);
  });

  // Test 3: Variant Count
  await runTest('Varyant Sayısı', async () => {
    const count = await prisma.variant.count();
    console.log(`(${count} varyant)`);
  });

  // Test 4: Marketplace Count
  await runTest('Pazaryeri Sayısı', async () => {
    const count = await prisma.marketplace.count();
    console.log(`(${count} pazaryeri)`);
  });

  // Test 5: New Model - VariantMapping
  await runTest('VariantMapping Tablosu', async () => {
    const count = await prisma.variantMapping.count();
    console.log(`(${count} kayıt)`);
  });

  // Test 6: New Model - VariantPool
  await runTest('VariantPool Tablosu', async () => {
    const count = await prisma.variantPool.count();
    console.log(`(${count} kayıt)`);
  });

  // Test 7: New Model - MarketplaceVariantRule
  await runTest('MarketplaceVariantRule Tablosu', async () => {
    const count = await prisma.marketplaceVariantRule.count();
    console.log(`(${count} kayıt)`);
  });

  // Test 8: Variant Validation Log
  await runTest('VariantValidationLog Tablosu', async () => {
    const count = await prisma.variantValidationLog.count();
    console.log(`(${count} kayıt)`);
  });

  // Test 9: Parent SKU Extraction
  await runTest('Parent SKU Çıkarma', async () => {
    const { extractParentSku } = await import('./apps/server/src/services/variantEngine.ts');
    const tests = [
      ['AIRMAX-40-BLACK', 'AIRMAX'],
      ['TSHIRT-XL-RED', 'TSHIRT'],
      ['NK12345', 'NK12345'],
      ['PROD-42-BLUE-XL', 'PROD'],
    ];
    for (const [input, expected] of tests) {
      const result = extractParentSku(input);
      if (result !== expected) throw new Error(`extractParentSku("${input}") = "${result}", beklenen "${expected}"`);
    }
    console.log(`(${tests.length} test geçti)`);
  });

  // Test 10: Color Detection
  await runTest('Renk Tespiti', async () => {
    const { detectVariantsFromText } = await import('./apps/server/src/services/variantEngine.ts');
    const suggestions = detectVariantsFromText('Nike Air Max Black Running Shoes');
    const hasColor = suggestions.some(s => s.name === 'Renk');
    if (!hasColor) throw new Error('Renk tespit edilemedi');
    console.log(`(Renk: ${suggestions.find(s => s.name === 'Renk')?.value})`);
  });

  // Test 11: Size Detection
  await runTest('Beden Tespiti', async () => {
    const { detectVariantsFromText } = await import('./apps/server/src/services/variantEngine.ts');
    const suggestions = detectVariantsFromText('T-Shirt XL Cotton');
    const hasSize = suggestions.some(s => s.name === 'Beden');
    if (!hasSize) throw new Error('Beden tespit edilemedi');
    console.log(`(Beden: ${suggestions.find(s => s.name === 'Beden')?.value})`);
  });

  // Test 12: Number Detection
  await runTest('Numara Tespiti', async () => {
    const { detectVariantsFromText } = await import('./apps/server/src/services/variantEngine.ts');
    const suggestions = detectVariantsFromText('Shoe Size 42');
    const hasNumber = suggestions.some(s => s.name === 'Numara');
    if (!hasNumber) throw new Error('Numara tespit edilemedi');
    console.log(`(Numara: ${suggestions.find(s => s.name === 'Numara')?.value})`);
  });

  // Test 13: Variant Normalization
  await runTest('Varyant Normalizasyonu', async () => {
    const { normalizeVariantValue } = await import('./apps/server/src/services/variantEngine.ts');
    const tests = [
      ['Renk', 'black', 'Siyah'],
      ['Renk', 'RED', 'Kırmızı'],
      ['Beden', 'xl', 'XL'],
      ['Beden', 'medium', 'M'],
      ['Numara', '42', '42'],
    ];
    for (const [name, value, expected] of tests) {
      const result = normalizeVariantValue(name, value);
      if (result !== expected) throw new Error(`normalize("${name}", "${value}") = "${result}", beklenen "${expected}"`);
    }
    console.log(`(${tests.length} test geçti)`);
  });

  // Test 14: Validation Engine
  await runTest('Validation Motoru', async () => {
    const { validateProduct } = await import('./apps/server/src/services/variantEngine.ts');
    const result = validateProduct({
      id: 'test',
      sku: 'TEST-001',
      barcode: '123456789',
      variantMatch: true,
      categoryMatch: true,
      brandMatch: true,
      templateMatch: true,
      status: 'READY',
      variants: [{ name: 'Renk', value: 'Siyah' }, { name: 'Beden', value: 'XL' }],
    }, {
      requiredAttributes: ['Renk', 'Beden'],
      optionalAttributes: [],
    });
    if (result.score < 90) throw new Error(`Skor düşük: ${result.score}`);
    if (result.status !== 'ready') throw new Error(`Status: ${result.status}`);
    console.log(`(Skor: ${result.score}, Status: ${result.status})`);
  });

  // Test 15: Validation - Missing Fields
  await runTest('Validation - Eksik Alanlar', async () => {
    const { validateProduct } = await import('./apps/server/src/services/variantEngine.ts');
    const result = validateProduct({
      id: 'test2',
      sku: null,
      barcode: null,
      variantMatch: false,
      categoryMatch: false,
      brandMatch: false,
      templateMatch: false,
      status: 'XML',
      variants: [],
    });
    if (result.status !== 'blocked') throw new Error(`Blocked olmalı: ${result.status}`);
    if (result.errors.length === 0) throw new Error('Hata olmalı');
    console.log(`(${result.errors.length} hata, Skor: ${result.score})`);
  });

  console.log('');
  console.log('=== TEST RAPORU ===');
  console.log(`✅ Geçen: ${passed}`);
  console.log(`❌ Kalan: ${failed}`);
  console.log(`📊 Toplam: ${passed + failed}`);
  console.log(`🎯 Başarı: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Kritik hata:', err);
  process.exit(1);
});
