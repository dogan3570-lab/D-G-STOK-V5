import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXmlImportPayload, importXmlProducts } from '../src/services/xmlImport.ts';
import { prisma } from '../src/db/prisma.ts';

test('parseXmlImportPayload extracts product nodes from XML', () => {
  const xml = `
    <products>
      <product>
        <xmlKey>SKU-100</xmlKey>
        <title>Test Ürün</title>
        <sku>SKU-100</sku>
        <barcode>123456</barcode>
        <stock>12</stock>
        <minStock>3</minStock>
      </product>
      <product>
        <xmlKey>SKU-200</xmlKey>
        <title>İkinci Ürün</title>
      </product>
    </products>
  `;

  const parsed = parseXmlImportPayload(xml);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    xmlKey: 'SKU-100',
    title: 'Test Ürün',
    sku: 'SKU-100',
    barcode: '123456',
    stock: 12,
    minStock: 3,
  });
  assert.deepEqual(parsed[1], {
    xmlKey: 'SKU-200',
    title: 'İkinci Ürün',
    sku: null,
    barcode: null,
    stock: 0,
    minStock: 0,
  });
});

test('parseXmlImportPayload throws for malformed XML', () => {
  const xml = '<products><product><xmlKey>BAD</xmlKey><title>Broken</title></products>';

  assert.throws(() => parseXmlImportPayload(xml), /Invalid XML/i);
});

test('importXmlProducts writes an audit log for successful imports', async () => {
  await prisma.auditLog.deleteMany({ where: { action: 'xml.import.success' } });

  const result = await importXmlProducts(`
    <products>
      <product>
        <xmlKey>audit-${Date.now()}</xmlKey>
        <title>Audit Ürün</title>
        <sku>audit-sku-${Date.now()}</sku>
        <stock>4</stock>
        <minStock>1</minStock>
      </product>
    </products>
  `);

  assert.equal(result.ok, true);
  const auditLogs = await prisma.auditLog.findMany({ where: { action: 'xml.import.success' } });
  assert.ok(auditLogs.length >= 1);
});

test('importXmlProducts creates an import run and item results', async () => {
  const source = await prisma.xmlSource.create({
    data: {
      name: `source-${Date.now()}`,
      sourceType: 'MANUAL',
      active: true,
      scheduleIntervalMinutes: 60,
    },
  });

  try {
    const result = await importXmlProducts(`
      <products>
        <product>
          <xmlKey>run-${Date.now()}</xmlKey>
          <title>Run Ürün</title>
          <sku>run-sku-${Date.now()}</sku>
          <stock>2</stock>
          <minStock>1</minStock>
        </product>
      </products>
    `, { sourceId: source.id, sourceName: source.name });

    assert.equal(result.ok, true);

    const runs = await prisma.xmlImportRun.findMany({ where: { sourceId: source.id } });
    assert.ok(runs.length >= 1);

    const itemResults = await prisma.xmlImportItemResult.findMany({ where: { importRunId: runs[0].id } });
    assert.ok(itemResults.length >= 1);
  } finally {
    await prisma.xmlImportItemResult.deleteMany({ where: { importRunId: { in: (await prisma.xmlImportRun.findMany({ where: { sourceId: source.id } })).map((run) => run.id) } } });
    await prisma.xmlImportRun.deleteMany({ where: { sourceId: source.id } });
    await prisma.xmlSource.delete({ where: { id: source.id } });
  }
});

test('importXmlProducts merges products by SKU when xmlKey differs', async () => {
  const existingXmlKey = `existing-${Date.now()}`;
  const incomingXmlKey = `incoming-${Date.now()}`;
  const sku = `sku-merge-${Date.now()}`;

  const created = await prisma.product.create({
    data: {
      xmlKey: existingXmlKey,
      sku,
      title: 'Old title',
      stock: 1,
      minStock: 0,
      status: 'XML',
    },
  });

  try {
    const result = await importXmlProducts(`
      <products>
        <product>
          <xmlKey>${incomingXmlKey}</xmlKey>
          <title>Updated title</title>
          <sku>${sku}</sku>
          <barcode>999</barcode>
          <stock>7</stock>
          <minStock>2</minStock>
        </product>
      </products>
    `);

    assert.equal(result.updatedCount, 1);
    assert.equal(result.importedCount, 0);

    const mergedProduct = await prisma.product.findUnique({ where: { id: created.id } });
    assert.equal(mergedProduct?.xmlKey, incomingXmlKey);
    assert.equal(mergedProduct?.title, 'Updated title');
    assert.equal(mergedProduct?.sku, sku);
  } finally {
    await prisma.product.deleteMany({ where: { sku } });
  }
});
