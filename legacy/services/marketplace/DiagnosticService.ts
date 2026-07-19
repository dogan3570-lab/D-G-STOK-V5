// ==================== Pazaryeri Baglanti Tani Merkezi V1.0 ====================
// 8 adim: Internet -> DNS -> HTTPS -> Sunucu -> Auth -> API -> JSON -> Sonuc
// Her pazaryeri icin ortak calisir, provider'lar uzerinden gercek API cagrisi yapar

import * as dns from 'dns/promises';
import tls from 'tls';
import { N11Provider } from './N11Provider.ts';

export interface DiagnosticStep {
  ok: boolean;
  label: string;
  detail: string;
  latency: number;
}

export interface DiagnosticReport {
  internet: DiagnosticStep;
  dns: DiagnosticStep;
  https: DiagnosticStep;
  server: DiagnosticStep & { httpStatus?: number; contentType?: string };
  authentication: DiagnosticStep;
  api: DiagnosticStep;
  json: DiagnosticStep;
  result: {
    ok: boolean;
    message: string;
    totalLatency: number;
  };
}

export class DiagnosticService {
  static async run(marketplaceKey: string, marketplaceId: string): Promise<DiagnosticReport> {
    const baseUrl = DiagnosticService.getBaseUrl(marketplaceKey);
    const hostname = new URL(baseUrl).hostname;
    const totalStart = Date.now();

    // Adim 1 - Internet
    const internet = await DiagnosticService.checkInternet();

    // Adim 2 - DNS
    const dnsResult = await DiagnosticService.checkDns(hostname);

    // Adim 3 - HTTPS/TLS
    const httpsResult = await DiagnosticService.checkTls(hostname);

    // Adim 4 - Sunucu (provider uzerinden gercek API cagrisi)
    const serverResult = await DiagnosticService.checkServer(marketplaceKey, marketplaceId);

    // Adim 5 - Authentication
    const authResult: DiagnosticStep = {
      ok: serverResult.ok || (serverResult.httpStatus !== undefined && serverResult.httpStatus !== 401 && serverResult.httpStatus !== 403),
      label: serverResult.ok ? 'Gecerli' : 'Gecersiz',
      detail: serverResult.ok ? 'Kimlik dogrulama basarili' : `Kimlik dogrulama basarisiz (HTTP ${serverResult.httpStatus})`,
      latency: serverResult.latency,
    };

    // Adim 6 - API (serverResult zaten gercek API cagrisi)
    const apiResult: DiagnosticStep = {
      ok: serverResult.ok,
      label: serverResult.ok ? 'Calisiyor' : 'Calismiyor',
      detail: serverResult.ok ? 'API yanit verdi' : `API hatasi: ${serverResult.detail}`,
      latency: serverResult.latency,
    };

    // Adim 7 - JSON
    const isJson = serverResult.contentType?.includes('application/json') ?? false;
    const jsonResult: DiagnosticStep = {
      ok: isJson,
      label: isJson ? 'JSON' : (serverResult.contentType || 'Bilinmiyor'),
      detail: isJson ? 'Yanit formati JSON' : `Yanit formati: ${serverResult.contentType || 'bilinmiyor'}`,
      latency: 0,
    };

    // Adim 8 - Sonuc
    const allOk = internet.ok && dnsResult.ok && httpsResult.ok && serverResult.ok && authResult.ok;
    const totalLatency = Date.now() - totalStart;

    return {
      internet,
      dns: dnsResult,
      https: httpsResult,
      server: serverResult,
      authentication: authResult,
      api: apiResult,
      json: jsonResult,
      result: {
        ok: allOk,
        message: allOk ? 'Baglanti basarili' : 'Baglanti hatasi',
        totalLatency,
      },
    };
  }

  private static getBaseUrl(key: string): string {
    const urls: Record<string, string> = {
      trendyol: 'https://api.trendyol.com',
      tt: 'https://api.trendyol.com',
      hepsiburada: 'https://api.hepsiburada.com',
      he: 'https://api.hepsiburada.com',
      n11: 'https://api.n11.com',
      amazon: 'https://sellingpartnerapi.amazon.com',
    };
    return urls[key] || 'https://api.' + key + '.com';
  }

  private static async checkInternet(): Promise<DiagnosticStep> {
    const start = Date.now();
    try {
      await fetch('https://www.google.com', { signal: AbortSignal.timeout(5000) });
      return { ok: true, label: 'Bagli', detail: 'Internet baglantisi var', latency: Date.now() - start };
    } catch {
      return { ok: false, label: 'Kesik', detail: 'Internet baglantisi yok', latency: Date.now() - start };
    }
  }

  private static async checkDns(hostname: string): Promise<DiagnosticStep> {
    const start = Date.now();
    try {
      const addresses = await dns.resolve4(hostname);
      return { ok: true, label: 'Bulundu', detail: `IP: ${addresses[0]}`, latency: Date.now() - start };
    } catch {
      return { ok: false, label: 'Bulunamadi', detail: `DNS cozulemedi: ${hostname}`, latency: Date.now() - start };
    }
  }

  private static async checkTls(hostname: string): Promise<DiagnosticStep> {
    const start = Date.now();
    return new Promise((resolve) => {
      const socket = tls.connect(443, hostname, { servername: hostname }, () => {
        const cipher = socket.getCipher();
        const version = socket.getProtocol();
        socket.end();
        resolve({ ok: true, label: 'Kuruldu', detail: `${version} (${cipher?.name || 'N/A'})`, latency: Date.now() - start });
      });
      socket.on('error', () => {
        resolve({ ok: false, label: 'Hata', detail: 'TLS baglantisi kurulamadi', latency: Date.now() - start });
      });
      setTimeout(() => resolve({ ok: false, label: 'Zaman Asimi', detail: 'TLS baglantisi zaman asimi', latency: Date.now() - start }), 5000);
    });
  }

  private static async checkServer(key: string, marketplaceId: string): Promise<DiagnosticStep & { httpStatus?: number; contentType?: string }> {
    const start = Date.now();
    
    try {
      if (key === 'n11') {
        const provider = await N11Provider.fromMarketplaceId(marketplaceId);
        if (!provider) return { ok: false, label: 'Hata', detail: 'Provider olusturulamadi', latency: Date.now() - start, httpStatus: 0 };
        
        const result = await provider.getProducts(0, 1);
        return {
          ok: result.ok,
          label: `HTTP ${result.status}`,
          detail: result.body.substring(0, 200),
          latency: result.timing,
          httpStatus: result.status,
          contentType: result.headers['content-type'],
        };
      } else {
        // Trendyol ve digerleri icin genel HTTP kontrol
        const baseUrl = DiagnosticService.getBaseUrl(key);
        const r = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
        const body = await r.text();
        return {
          ok: r.ok,
          label: `HTTP ${r.status}`,
          detail: body.substring(0, 200),
          latency: Date.now() - start,
          httpStatus: r.status,
          contentType: r.headers.get('content-type') || undefined,
        };
      }
    } catch (error: any) {
      return {
        ok: false,
        label: 'Hata',
        detail: error.message || 'Baglanti hatasi',
        latency: Date.now() - start,
      };
    }
  }
}
