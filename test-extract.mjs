import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeText(value) {
  if (value == null) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/"/gi, '"');
}

function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '));
}

function extractTagValue(content, tagName) {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(content);
  if (!match) return null;
  const raw = match[1];
  console.log(`  Raw ${tagName}:`, JSON.stringify(raw.substring(0, 100)));
  const stripped = stripTags(raw);
  console.log(`  Stripped ${tagName}:`, JSON.stringify(stripped.substring(0, 100)));
  return normalizeText(stripped);
}

async function main() {
  const source = await prisma.xmlSource.findFirst();
  
  const response = await fetch(source.url, { redirect: 'follow' });
  const xml = await response.text();
  
  const productRegex = /<(product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = Array.from(xml.matchAll(productRegex));
  
  const content = matches[0][2];
  console.log('First 200 chars of content:', JSON.stringify(content.substring(0, 200)));
  console.log('');
  
  console.log('Testing extractTagValue:');
  const id = extractTagValue(content, 'id');
  console.log('  id result:', id);
  
  const name = extractTagValue(content, 'name');
  console.log('  name result:', name);
  
  const productCode = extractTagValue(content, 'productCode');
  console.log('  productCode result:', productCode);
  
  const barcode = extractTagValue(content, 'barcode');
  console.log('  barcode result:', barcode);
  
  const brand = extractTagValue(content, 'brand');
  console.log('  brand result:', brand);
  
  await prisma.$disconnect();
}

main().catch(console.error);
