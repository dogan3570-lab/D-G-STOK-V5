import { prisma } from '../db/prisma.ts';

export type XmlImportResult = {
  ok: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount?: number;
  failedCount?: number;
  items: Array<{ xmlKey: string; created: boolean; matchedBy?: 'xmlKey' | 'sku'; outcome?: string; errorDetail?: string }>;
  error?: { code: string; message: string };
  runId?: string;
};

export type XmlImportProduct = {
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
};

function parseXmlDocument(xml: string) {
  const source = xml?.trim() ?? '';
  if (!source) {
    return { ok: false as const, error: 'Empty XML payload' };
  }

  const tagRegex = /<!--([\s\S]*?)-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[^>]*\?>|<!DOCTYPE[\s\S]*?>|<\/?([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>/g;
  const stack: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(source)) !== null) {
    const fullTag = match[0];
    if (fullTag.startsWith('<!--') || fullTag.startsWith('<![') || fullTag.startsWith('<?') || fullTag.startsWith('<!DOCTYPE')) {
      continue;
    }

    if (fullTag.startsWith('</')) {
      const tagName = match[3]?.toLowerCase();
      if (!tagName) {
        return { ok: false as const, error: 'Invalid XML: malformed closing tag' };
      }

      if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
        return { ok: false as const, error: `Invalid XML: mismatched closing tag ${tagName}` };
      }

      stack.pop();
      continue;
    }

    if (fullTag.endsWith('/>')) {
      continue;
    }

    const tagName = match[3]?.toLowerCase();
    if (!tagName) {
      return { ok: false as const, error: 'Invalid XML: malformed opening tag' };
    }

    stack.push(tagName);
  }

  if (stack.length > 0) {
    return { ok: false as const, error: `Invalid XML: unclosed tag ${stack[stack.length - 1]}` };
  }

  return { ok: true as const, source };
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '));
}

function extractTagValue(content: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(content);
  if (!match) return null;
  return normalizeText(stripTags(match[1]));
}

export function parseXmlImportPayload(xml: string): XmlImportProduct[] {
  const parsed = parseXmlDocument(xml);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const productRegex = /<(product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = Array.from(parsed.source.matchAll(productRegex));

  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match) => {
      const content = match[2] ?? '';
      const xmlKey = extractTagValue(content, 'xmlKey');
      if (!xmlKey) return null;

      const title = extractTagValue(content, 'title');
      const sku = extractTagValue(content, 'sku');
      const barcode = extractTagValue(content, 'barcode');
      const stockValue = extractTagValue(content, 'stock');
      const minStockValue = extractTagValue(content, 'minStock');

      return {
        xmlKey,
        title,
        sku,
        barcode,
        stock: Number.parseInt(stockValue ?? '0', 10),
        minStock: Number.parseInt(minStockValue ?? '0', 10),
      } satisfies XmlImportProduct;
    })
    .filter((item): item is XmlImportProduct => item != null);
}

export async function importXmlProducts(xml: string, options?: { actorUserId?: string | null; sourceName?: string | null; sourceId?: string | null }) {
  const parsed = parseXmlDocument(xml);
  if (!parsed.ok) {
    return { ok: false, error: { code: 'INVALID_XML', message: parsed.error }, importedCount: 0, updatedCount: 0, items: [] } satisfies XmlImportResult;
  }

  const items = parseXmlImportPayload(xml);

  if (items.length === 0) {
    return { ok: true, importedCount: 0, updatedCount: 0, skippedCount: 0, items: [] } satisfies XmlImportResult;
  }

  let sourceRecord = null as Awaited<ReturnType<typeof prisma.xmlSource.findFirst>> | null;
  if (options?.sourceId) {
    sourceRecord = await prisma.xmlSource.findUnique({ where: { id: options.sourceId } });
  } else if (options?.sourceName) {
    sourceRecord = await prisma.xmlSource.findFirst({ where: { name: options.sourceName } });
  }

  const run = await prisma.xmlImportRun.create({
    data: {
      sourceId: sourceRecord?.id ?? (await prisma.xmlSource.create({ data: { name: options?.sourceName ?? 'manual-import', sourceType: 'MANUAL', active: true, scheduleIntervalMinutes: 60 } })).id,
      status: 'running',
      totalProducts: items.length,
    },
  });

  const results = [] as Array<{ xmlKey: string; created: boolean; matchedBy?: 'xmlKey' | 'sku'; outcome: string; errorDetail?: string }>;
  let failedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const existingByXmlKey = item.xmlKey
      ? await prisma.product.findUnique({ where: { xmlKey: item.xmlKey } })
      : null;

    const existingBySku = item.sku && !existingByXmlKey
      ? await prisma.product.findFirst({ where: { sku: item.sku } })
      : null;

    const existing = existingByXmlKey ?? existingBySku;

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          xmlKey: item.xmlKey,
          title: item.title,
          sku: item.sku,
          barcode: item.barcode,
          stock: Number.isFinite(item.stock) ? item.stock : 0,
          minStock: Number.isFinite(item.minStock) ? item.minStock : 0,
          status: 'XML',
        },
      });

      results.push({
        xmlKey: item.xmlKey,
        created: false,
        matchedBy: existingByXmlKey ? 'xmlKey' : 'sku',
        outcome: 'updated',
      });
      await prisma.xmlImportItemResult.create({
        data: {
          importRunId: run.id,
          xmlKey: item.xmlKey,
          sku: item.sku ?? null,
          outcome: 'updated',
        },
      });
      continue;
    }

    await prisma.product.create({
      data: {
        xmlKey: item.xmlKey,
        title: item.title,
        sku: item.sku,
        barcode: item.barcode,
        stock: Number.isFinite(item.stock) ? item.stock : 0,
        minStock: Number.isFinite(item.minStock) ? item.minStock : 0,
        status: 'XML',
      },
    });
    results.push({ xmlKey: item.xmlKey, created: true, outcome: 'created' });
    await prisma.xmlImportItemResult.create({
      data: {
        importRunId: run.id,
        xmlKey: item.xmlKey,
        sku: item.sku ?? null,
        outcome: 'created',
      },
    });
  }

  const importedCount = results.filter((item) => item.created).length;
  const updatedCount = results.filter((item) => !item.created).length;
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - run.startedAt.getTime();

  await prisma.xmlImportRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      durationMs,
      status: 'completed',
      newProducts: importedCount,
      updatedProducts: updatedCount,
      failedProducts: failedCount,
      skippedProducts: skippedCount,
    },
  });

  await prisma.xmlSource.update({
    where: { id: run.sourceId },
    data: {
      lastRunAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastError: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'xml.import.success',
      actorUserId: options?.actorUserId ?? null,
      meta: JSON.stringify({
        sourceName: options?.sourceName ?? null,
        importedCount,
        updatedCount,
        totalItems: results.length,
      }),
    },
  });

  return {
    ok: true,
    importedCount,
    updatedCount,
    skippedCount,
    failedCount,
    items: results,
    runId: run.id,
  } satisfies XmlImportResult;
}

export async function fetchXmlFromUrl(url: string) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`XML fetch failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('XML content is empty');
  }

  return text;
}
