// ==================== AI CONTENT COMPLIANCE ENGINE ====================
// DG STOK V5.0 - 12 asamali icerik uyum motoru
// ===================================================================
import { prisma } from '../../db/prisma.ts';

// ==================== SABITLER ====================

const FORBIDDEN_PATTERNS = {
  // Iletisim
  PHONE: /(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  URL: /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  SOCIAL: /(@\w+)|(t\.me\/\w+)|(wa\.me\/\w+)|(instagram\.com\/\w+)/gi,
  
  // Gereksiz
  EMOJI: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
  EXCESS_PUNCTUATION: /([!?.,;:])\1{2,}/g,
  DOUBLE_SPACE: /\s{2,}/g,
  HTML_TAGS: /<[^>]*>/g,
  
  // Rakip markalar
  COMPETITOR_BRANDS: /\b(Nike|Adidas|Skechers|New Balance|Asics|Reebok|Converse|Puma|Under Armour|Vans|Columbia|The North Face)\b/gi,
  
  // Marketing (riskli)
  MARKETING_HIGH: /\b(en ucuz|şok fiyat|kaçırmayın|bedava|sınırlı stok|yüzde 100 garanti|%100 garanti|garantili sonuç)\b/gi,
  MARKETING_MEDIUM: /\b(muhteşem|en kaliteli|en iyi|hediye|süper kampanya|inanılmaz|mükemmel|olağanüstü|eşsiz|benzersiz|harika)\b/gi,
};

const COMPETITOR_BRAND_LIST = [
  'nike', 'adidas', 'skechers', 'new balance', 'asics',
  'reebok', 'converse', 'puma', 'under armour', 'vans',
  'columbia', 'the north face', 'tommy hilfiger', 'guess',
  'boss', 'armani', 'versace', 'gucci', 'prada', 'chanel',
  'louis vuitton', 'zara', 'hm', 'mango', 'bershka',
];

// ==================== TYPES ====================

interface CheckResult {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  autoFix?: string | null;
}

interface ContentCheckReport {
  productId: string;
  title: string | null;
  description: string | null;
  
  // Her kontrol
  titleCheck: CheckResult;
  brandCheck: CheckResult;
  categoryCheck: CheckResult;
  descCheck: CheckResult;
  htmlCheck: CheckResult;
  forbiddenCheck: CheckResult;
  competitorCheck: CheckResult;
  communicationCheck: CheckResult;
  
  // Genel
  totalScore: number;
  status: 'PASSED' | 'AUTO_FIXED' | 'AWAITING_APPROVAL' | 'FAILED';
  allIssues: string[];
  allSuggestions: string[];
  fixLog: Record<string, string>;
}

// ==================== 1. BASLIK KONTROLU ====================

function checkTitle(
  title: string | null,
  profile: { maxTitleLength: number; minTitleLength: number; maxUppercaseRatio: number }
): CheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!title || title.trim().length === 0) {
    return { passed: false, score: 0, issues: ['Başlık boş'], suggestions: ['Başlık girin'], autoFix: null };
  }

  if (title.length > profile.maxTitleLength) {
    issues.push(`Başlık çok uzun (${title.length}/${profile.maxTitleLength})`);
    score -= 20;
    suggestions.push(`Başlığı ${profile.maxTitleLength} karaktere kısaltın`);
  }

  if (title.length < profile.minTitleLength) {
    issues.push(`Başlık çok kısa (${title.length}/${profile.minTitleLength})`);
    score -= 15;
    suggestions.push('Başlığı en az 10 karakter yapın');
  }

  // Büyük harf oranı
  const upperCount = (title.match(/[A-ZİĞÜŞÖÇ]/g) || []).length;
  const upperRatio = upperCount / title.length;
  if (upperRatio > profile.maxUppercaseRatio) {
    issues.push(`Büyük harf oranı çok yüksek (%${Math.round(upperRatio * 100)})`);
    score -= 15;
    suggestions.push('Büyük harf kullanımını azaltın');
  }

  // Gereksiz tekrar
  const words = title.toLowerCase().split(/\s+/);
  const wordCount = new Map<string, number>();
  for (const w of words) wordCount.set(w, (wordCount.get(w) || 0) + 1);
  for (const [w, c] of wordCount) {
    if (c > 2 && w.length > 2) {
      issues.push(`"${w}" kelimesi ${c} kez tekrarlanmış`);
      score -= 10;
      break;
    }
  }

  // Emoji
  const emojiMatch = title.match(FORBIDDEN_PATTERNS.EMOJI);
  if (emojiMatch) {
    issues.push(`${emojiMatch.length} emoji tespit edildi`);
    score -= 10;
    suggestions.push('Emojileri kaldırın');
  }

  // Fazla noktalama
  const punctMatch = title.match(FORBIDDEN_PATTERNS.EXCESS_PUNCTUATION);
  if (punctMatch) {
    issues.push('Gereksiz noktalama işareti');
    score -= 5;
  }

  return {
    passed: score >= 70,
    score: Math.max(0, score),
    issues,
    suggestions,
    autoFix: score < 70 ? autoFixTitle(title, profile) : null,
  };
}

function autoFixTitle(title: string, profile: { maxTitleLength: number }): string {
  let fixed = title;
  // Emoji kaldır
  fixed = fixed.replace(FORBIDDEN_PATTERNS.EMOJI, '').trim();
  // Fazla noktalama
  fixed = fixed.replace(FORBIDDEN_PATTERNS.EXCESS_PUNCTUATION, '$1');
  // Çift boşluk
  fixed = fixed.replace(FORBIDDEN_PATTERNS.DOUBLE_SPACE, ' ');
  // Kısalt
  if (fixed.length > profile.maxTitleLength) {
    fixed = fixed.slice(0, profile.maxTitleLength - 3) + '...';
  }
  return fixed;
}

// ==================== 2. MARKA KONTROLU ====================

async function checkBrand(productId: string, brandName: string | null | undefined): Promise<CheckResult> {
  if (!brandName) {
    return { passed: false, score: 50, issues: ['Marka belirtilmemiş'], suggestions: ['Marka bilgisi girin'], autoFix: null };
  }
  return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };
}

// ==================== 3. KATEGORI KONTROLU ====================

async function checkCategory(categoryId: string | null | undefined): Promise<CheckResult> {
  if (!categoryId) {
    return { passed: false, score: 50, issues: ['Kategori belirtilmemiş'], suggestions: ['Kategori seçin'], autoFix: null };
  }
  return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };
}

// ==================== 4. ACIKLAMA KONTROLU ====================

function checkDescription(description: string | null): CheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!description || description.trim().length === 0) {
    return { passed: false, score: 30, issues: ['Açıklama boş'], suggestions: ['Ürün açıklaması girin'], autoFix: null };
  }

  if (description.length < 20) {
    issues.push('Açıklama çok kısa');
    score -= 20;
  }

  // HTML kontrol
  const htmlMatch = description.match(FORBIDDEN_PATTERNS.HTML_TAGS);
  if (htmlMatch && htmlMatch.length > 5) {
    issues.push('Çok fazla HTML etiketi');
    score -= 10;
  }

  // Spam kontrol
  const wordCount = new Map<string, number>();
  const words = description.toLowerCase().split(/\s+/);
  for (const w of words) {
    if (w.length > 2) wordCount.set(w, (wordCount.get(w) || 0) + 1);
  }
  for (const [, c] of wordCount) {
    if (c > 5) {
      issues.push('Anahtar kelime doldurma tespit edildi');
      score -= 15;
      break;
    }
  }

  return {
    passed: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    autoFix: score < 60 ? autoFixDescription(description) : null,
  };
}

function autoFixDescription(desc: string): string {
  let fixed = desc;
  // HTML temizle
  fixed = fixed.replace(FORBIDDEN_PATTERNS.HTML_TAGS, '');
  // Fazla boşluk
  fixed = fixed.replace(FORBIDDEN_PATTERNS.DOUBLE_SPACE, ' ');
  return fixed.trim();
}

// ==================== 5-6. HTML KONTROLU ====================

function checkHtml(description: string | null): CheckResult {
  if (!description) return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };
  
  const issues: string[] = [];
  let score = 100;
  const htmlTags = description.match(FORBIDDEN_PATTERNS.HTML_TAGS);

  if (htmlTags && htmlTags.length > 0) {
    const tagCount = htmlTags.length;
    if (tagCount > 20) {
      issues.push(`Çok fazla HTML etiketi (${tagCount})`);
      score -= 20;
    }
  }

  return {
    passed: score >= 70,
    score: Math.max(0, score),
    issues,
    suggestions: issues.length > 0 ? ['HTML etiketlerini temizleyin'] : [],
    autoFix: score < 70 ? description.replace(FORBIDDEN_PATTERNS.HTML_TAGS, '') : null,
  };
}

// ==================== 7. YASAK KELIME KONTROLU ====================

async function checkForbiddenWords(
  text: string | null,
  marketplaceKey?: string
): Promise<CheckResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  const found: string[] = [];

  if (!text) return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };

  const lower = text.toLowerCase();

  // Veritabanından yasak kelimeleri al
  const forbiddenWords = await prisma.forbiddenWord.findMany({
    where: {
      isActive: true,
      OR: [
        { marketplaces: { contains: marketplaceKey || '' } },
        { marketplaces: null },
      ],
    },
  });

  for (const fw of forbiddenWords) {
    if (lower.includes(fw.word.toLowerCase())) {
      found.push(fw.word);
      const riskPenalty = fw.riskLevel === 'CRITICAL' ? 40 : fw.riskLevel === 'HIGH' ? 25 : fw.riskLevel === 'MEDIUM' ? 15 : 5;
      score -= riskPenalty;
      
      if (fw.autoFix) {
        suggestions.push(`"${fw.word}" → "${fw.autoFix}"`);
      } else {
        suggestions.push(`"${fw.word}" kaldırılmalı`);
      }
    }
  }

  // Marketing ifadeleri
  const marketingHigh = text.match(FORBIDDEN_PATTERNS.MARKETING_HIGH);
  if (marketingHigh) {
    issues.push(`Riskli pazarlama ifadeleri: ${marketingHigh.join(', ')}`);
    score -= 25;
  }
  const marketingMedium = text.match(FORBIDDEN_PATTERNS.MARKETING_MEDIUM);
  if (marketingMedium) {
    issues.push(`Abartılı ifadeler: ${marketingMedium.join(', ')}`);
    score -= 10;
  }

  if (found.length > 0) {
    issues.push(`Yasak kelimeler: ${found.join(', ')}`);
  }

  return {
    passed: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    autoFix: null,
  };
}

// ==================== 8. RAKIP MARKA KONTROLU ====================

function checkCompetitorBrands(
  text: string | null,
  ownBrandName?: string | null
): CheckResult {
  const issues: string[] = [];
  let score = 100;
  let fixed = text || '';

  if (!text) return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };

  const ownLower = (ownBrandName || '').toLowerCase();
  const lower = text.toLowerCase();

  for (const competitor of COMPETITOR_BRAND_LIST) {
    if (competitor === ownLower) continue; // Kendi markasıysa atla
    
    const regex = new RegExp(`\\b${competitor}\\b`, 'gi');
    if (regex.test(lower)) {
      issues.push(`Rakip marka tespiti: "${competitor}"`);
      score -= 30;
      fixed = fixed.replace(regex, '');
    }
  }

  return {
    passed: score >= 70,
    score: Math.max(0, score),
    issues,
    suggestions: issues.length > 0 ? ['Rakip marka adlarını kaldırın'] : [],
    autoFix: issues.length > 0 ? fixed.replace(FORBIDDEN_PATTERNS.DOUBLE_SPACE, ' ').trim() : null,
  };
}

// ==================== 9. ILETISIM BILGISI KONTROLU ====================

function checkCommunicationInfo(text: string | null): CheckResult {
  const issues: string[] = [];
  let score = 100;
  let fixed = text || '';

  if (!text) return { passed: true, score: 100, issues: [], suggestions: [], autoFix: null };

  const phoneMatch = text.match(FORBIDDEN_PATTERNS.PHONE);
  if (phoneMatch) {
    issues.push(`Telefon numarası: ${phoneMatch.length} adet`);
    score -= 25;
    fixed = fixed.replace(FORBIDDEN_PATTERNS.PHONE, '');
  }

  const emailMatch = text.match(FORBIDDEN_PATTERNS.EMAIL);
  if (emailMatch) {
    issues.push(`E-posta adresi: ${emailMatch.length} adet`);
    score -= 25;
    fixed = fixed.replace(FORBIDDEN_PATTERNS.EMAIL, '');
  }

  const urlMatch = text.match(FORBIDDEN_PATTERNS.URL);
  if (urlMatch) {
    issues.push(`URL: ${urlMatch.length} adet`);
    score -= 20;
    fixed = fixed.replace(FORBIDDEN_PATTERNS.URL, '');
  }

  const socialMatch = text.match(FORBIDDEN_PATTERNS.SOCIAL);
  if (socialMatch) {
    issues.push(`Sosyal medya: ${socialMatch.length} adet`);
    score -= 20;
    fixed = fixed.replace(FORBIDDEN_PATTERNS.SOCIAL, '');
  }

  return {
    passed: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions: issues.length > 0 ? ['İletişim bilgilerini kaldırın'] : [],
    autoFix: issues.length > 0 ? fixed.replace(FORBIDDEN_PATTERNS.DOUBLE_SPACE, ' ').trim() : null,
  };
}

// ==================== ANA PIPELINE ====================

export async function checkProductContent(
  productId: string,
  marketplaceKey?: string
): Promise<ContentCheckReport> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true, xmlSource: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const mpKey = marketplaceKey || 'trendyol';
  const profile = await prisma.marketplaceContentProfile.findUnique({
    where: { marketplaceKey: mpKey },
  }) || {
    maxTitleLength: 150,
    minTitleLength: 10,
    maxUppercaseRatio: 0.3,
  };

  // 12 asamali pipeline
  const titleResult = checkTitle(product.title, profile);
  const brandResult = await checkBrand(productId, product.brand?.name);
  const categoryResult = await checkCategory(product.categoryId);
  const descResult = checkDescription(product.description);
  const htmlResult = checkHtml(product.description);
  const forbiddenResult = await checkForbiddenWords(
    [product.title, product.description].filter(Boolean).join(' '),
    mpKey
  );
  const competitorResult = checkCompetitorBrands(
    [product.title, product.description].filter(Boolean).join(' '),
    product.brand?.name
  );
  const communicationResult = checkCommunicationInfo(
    [product.title, product.description].filter(Boolean).join(' ')
  );

  // Tum sorunlari topla
  const allIssues = [
    ...titleResult.issues,
    ...brandResult.issues,
    ...categoryResult.issues,
    ...descResult.issues,
    ...htmlResult.issues,
    ...forbiddenResult.issues,
    ...competitorResult.issues,
    ...communicationResult.issues,
  ];

  const allSuggestions = [
    ...titleResult.suggestions,
    ...brandResult.suggestions,
    ...descResult.suggestions,
    ...forbiddenResult.suggestions,
    ...competitorResult.suggestions,
    ...communicationResult.suggestions,
  ];

  // Toplam skor (agirlikli ortalama)
  const totalScore = Math.round(
    (titleResult.score * 0.20) +
    (brandResult.score * 0.10) +
    (categoryResult.score * 0.10) +
    (descResult.score * 0.15) +
    (htmlResult.score * 0.05) +
    (forbiddenResult.score * 0.20) +
    (competitorResult.score * 0.10) +
    (communicationResult.score * 0.10)
  );

  // Fix log
  const fixLog: Record<string, string> = {};
  if (titleResult.autoFix) fixLog.title = titleResult.autoFix;
  if (competitorResult.autoFix) fixLog.brand = competitorResult.autoFix;
  if (communicationResult.autoFix) fixLog.communication = communicationResult.autoFix;

  // Status belirle
  let status: ContentCheckReport['status'] = 'PASSED';
  if (totalScore >= 95 && allIssues.length === 0) {
    status = 'PASSED';
  } else if (totalScore >= 70 && Object.keys(fixLog).length > 0) {
    status = 'AUTO_FIXED';
  } else if (totalScore >= 50) {
    status = 'AWAITING_APPROVAL';
  } else {
    status = 'FAILED';
  }

  // Sonucu veritabanina kaydet
  await prisma.contentAnalysisResult.upsert({
    where: { id: `ca_${productId}` },
    create: {
      id: `ca_${productId}`,
      productId,
      marketplaceKey: mpKey,
      totalScore,
      titleScore: titleResult.score,
      descScore: descResult.score,
      issues: JSON.stringify(allIssues),
      aiSuggestions: JSON.stringify(allSuggestions),
      autoFixed: status === 'AUTO_FIXED',
      fixLog: JSON.stringify(fixLog),
      aiConfidence: totalScore,
      aiSuggestedTitle: titleResult.autoFix || null,
      aiSuggestedDesc: descResult.autoFix || null,
      status,
    },
    update: {
      totalScore,
      titleScore: titleResult.score,
      descScore: descResult.score,
      issues: JSON.stringify(allIssues),
      aiSuggestions: JSON.stringify(allSuggestions),
      autoFixed: status === 'AUTO_FIXED',
      fixLog: JSON.stringify(fixLog),
      aiConfidence: totalScore,
      aiSuggestedTitle: titleResult.autoFix || null,
      aiSuggestedDesc: descResult.autoFix || null,
      status,
    },
  });

  return {
    productId,
    title: product.title,
    description: product.description,
    titleCheck: titleResult,
    brandCheck: brandResult,
    categoryCheck: categoryResult,
    descCheck: descResult,
    htmlCheck: htmlResult,
    forbiddenCheck: forbiddenResult,
    competitorCheck: competitorResult,
    communicationCheck: communicationResult,
    totalScore,
    status,
    allIssues,
    allSuggestions,
    fixLog,
  };
}

// ==================== TOPLU KONTROL ====================

export async function batchCheckProducts(
  productIds: string[],
  marketplaceKey?: string
): Promise<{ checked: number; reports: ContentCheckReport[] }> {
  const reports: ContentCheckReport[] = [];

  for (const pid of productIds) {
    try {
      const report = await checkProductContent(pid, marketplaceKey);
      reports.push(report);
    } catch (err) {
      console.error(`[ContentEngine] Product ${pid} check failed:`, err);
    }
  }

  return { checked: reports.length, reports };
}

// ==================== İSTATİSTİK ====================

export async function getContentStats(): Promise<{
  totalChecked: number;
  autoFixed: number;
  awaitingApproval: number;
  passed: number;
  failed: number;
  apiErrors: number;
}> {
  const [totalChecked, autoFixed, awaitingApproval, passed, failed, apiErrors] = await Promise.all([
    prisma.contentAnalysisResult.count(),
    prisma.contentAnalysisResult.count({ where: { status: 'AUTO_FIXED' } }),
    prisma.contentAnalysisResult.count({ where: { status: 'AWAITING_APPROVAL' } }),
    prisma.contentAnalysisResult.count({ where: { status: 'PASSED' } }),
    prisma.contentAnalysisResult.count({ where: { status: 'FAILED' } }),
    prisma.apiErrorLog.count(),
  ]);

  return { totalChecked, autoFixed, awaitingApproval, passed, failed, apiErrors };
}

// ==================== API HATA OGRENME ====================

export async function logApiError(params: {
  productId: string;
  marketplaceKey: string;
  errorCode: string;
  errorMessage: string;
  rejectedField?: string;
}): Promise<void> {
  // AI ogrenme: hatadan kural cikar
  let aiLearnedRule: string | null = null;
  const lowerMsg = params.errorMessage.toLowerCase();

  if (lowerMsg.includes('title') || lowerMsg.includes('baslik') || lowerMsg.includes('başlık')) {
    aiLearnedRule = `title: ${params.errorMessage}`;
  } else if (lowerMsg.includes('description') || lowerMsg.includes('aciklama') || lowerMsg.includes('açıklama')) {
    aiLearnedRule = `description: ${params.errorMessage}`;
  } else if (lowerMsg.includes('image') || lowerMsg.includes('gorsel') || lowerMsg.includes('görsel')) {
    aiLearnedRule = `image: ${params.errorMessage}`;
  }

  await prisma.apiErrorLog.create({
    data: {
      productId: params.productId,
      marketplaceKey: params.marketplaceKey,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      rejectedField: params.rejectedField,
      aiLearnedRule,
    },
  });

  if (aiLearnedRule) {
    console.log(`[ContentEngine] AI ogrenilen kural: ${aiLearnedRule}`);
  }
}

// ==================== YASAK KELIME YONETIMI ====================

export async function seedDefaultForbiddenWords(): Promise<number> {
  const defaults = [
    // Marketing YUKSEK
    { word: 'en ucuz', category: 'MARKETING', riskLevel: 'HIGH', autoFix: null },
    { word: 'şok fiyat', category: 'MARKETING', riskLevel: 'HIGH', autoFix: null },
    { word: 'kaçırmayın', category: 'MARKETING', riskLevel: 'HIGH', autoFix: null },
    { word: 'bedava', category: 'MARKETING', riskLevel: 'HIGH', autoFix: null },
    { word: 'sınırlı stok', category: 'MARKETING', riskLevel: 'HIGH', autoFix: null },
    { word: '%100 garanti', category: 'MARKETING', riskLevel: 'HIGH', autoFix: 'garantili' },
    // Marketing ORTA
    { word: 'muhteşem', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'en kaliteli', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'en iyi', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'hediye', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'inanılmaz', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'mükemmel', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'eşsiz', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    { word: 'benzersiz', category: 'MARKETING', riskLevel: 'MEDIUM', autoFix: null },
    // Iletisim
    { word: 'whatsapp', category: 'COMMUNICATION', riskLevel: 'HIGH', autoFix: null },
    { word: 'instagram', category: 'COMMUNICATION', riskLevel: 'HIGH', autoFix: null },
    { word: 'facebook', category: 'COMMUNICATION', riskLevel: 'HIGH', autoFix: null },
    { word: 'tiktok', category: 'COMMUNICATION', riskLevel: 'HIGH', autoFix: null },
    { word: 'telegram', category: 'COMMUNICATION', riskLevel: 'HIGH', autoFix: null },
  ];

  let count = 0;
  for (const w of defaults) {
    try {
      await prisma.forbiddenWord.upsert({
        where: { word: w.word },
        create: w,
        update: { isActive: true },
      });
      count++;
    } catch { /* ignore */ }
  }
  return count;
}

// ==================== PAZARYERI PROFILLERI ====================

export async function seedMarketplaceProfiles(): Promise<number> {
  const profiles = [
    {
      marketplaceKey: 'trendyol',
      marketplaceName: 'Trendyol',
      maxTitleLength: 150,
      minTitleLength: 10,
      emojiPolicy: 'REMOVE',
      maxUppercaseRatio: 0.3,
      allowHtml: false,
      minImageWidth: 800,
      minImageHeight: 800,
      whiteBackground: true,
      barcodeRequired: true,
    },
    {
      marketplaceKey: 'hepsiburada',
      marketplaceName: 'Hepsiburada',
      maxTitleLength: 128,
      minTitleLength: 10,
      emojiPolicy: 'REMOVE',
      maxUppercaseRatio: 0.4,
      allowHtml: true,
      allowedHtmlTags: JSON.stringify(['b', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li']),
      minImageWidth: 600,
      minImageHeight: 600,
      whiteBackground: false,
      barcodeRequired: true,
    },
    {
      marketplaceKey: 'n11',
      marketplaceName: 'N11',
      maxTitleLength: 120,
      minTitleLength: 10,
      emojiPolicy: 'REMOVE',
      maxUppercaseRatio: 0.3,
      allowHtml: false,
      minImageWidth: 400,
      minImageHeight: 400,
      whiteBackground: false,
      barcodeRequired: false,
    },
    {
      marketplaceKey: 'amazon',
      marketplaceName: 'Amazon',
      maxTitleLength: 200,
      minTitleLength: 20,
      emojiPolicy: 'REMOVE',
      maxUppercaseRatio: 0.2,
      allowHtml: false,
      minImageWidth: 1000,
      minImageHeight: 1000,
      whiteBackground: true,
      barcodeRequired: true,
      barcodeFormat: 'EAN13',
    },
  ];

  let count = 0;
  for (const p of profiles) {
    try {
      await prisma.marketplaceContentProfile.upsert({
        where: { marketplaceKey: p.marketplaceKey },
        create: p,
        update: { marketplaceName: p.marketplaceName },
      });
      count++;
    } catch { /* ignore */ }
  }
  return count;
}
