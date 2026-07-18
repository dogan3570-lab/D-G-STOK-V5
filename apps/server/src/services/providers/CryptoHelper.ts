// ==================== SIFRELEME YARDIMCISI ====================
// DG STOK V5.0 - Faz 2
// FTP/SFTP/API sifrelerini sifreler.
// ==============================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Master key - environment variable'dan alinir
function getMasterKey(): Buffer {
  const key: string = process.env.ENCRYPTION_KEY || 'dgstok-default-encryption-key-32chr';
  return crypto.scryptSync(key, 'dgstok-salt', 32) as Buffer;
}

/**
 * Metni sifreler
 */
export function encrypt(text: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  // iv:encrypted:tag formatinda dondur
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Sifrelenmis metni cozer
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getMasterKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) return encryptedText; // Sifrelenmemis
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    // Cozulemezse orijinal metni dondur (geriye uyum)
    return encryptedText;
  }
}

/**
 * Sifrelenmis mi kontrol eder
 */
export function isEncrypted(text: string): boolean {
  return /^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/i.test(text);
}

/**
 * Hassas verileri log'da maskelemek icin
 */
const SENSITIVE_PATTERNS = [
  /\b(\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4})\b/g,        // Kart no
  /\b(\d{11})\b/g,                                          // TC Kimlik
  /\b(TR\d{24})\b/g,                                        // IBAN
  /\b(\d{4,6}[- ]?\d{4,6}[- ]?\d{4,6}[- ]?\d{4,6})\b/g,  // Olası kart
];

export function maskSensitive(text: string): string {
  let masked = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      if (match.length > 6) {
        return match.substring(0, 4) + '****' + match.substring(match.length - 4);
      }
      return '****';
    });
  }
  return masked;
}
