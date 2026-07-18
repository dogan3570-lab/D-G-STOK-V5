// ==================== API Test Motoru V2.0 - Types ====================

export interface DiagnosticResult {
  /** Her adımın sonucu */
  dns: StepResult;
  https: StepResult;
  authentication: StepResult;
  authorization: StepResult;
  endpoint: StepResult;
  jsonValidation: StepResult;
  /** Genel durum */
  overall: {
    ok: boolean;
    message: string;
    httpStatus?: number;
    latency: number;
    timestamp: string;
  };
}

export interface StepResult {
  ok: boolean;
  message: string;
  detail?: string;
  latency?: number;
}

export interface MarketplaceTestRequest {
  marketplaceId: string;
  apiKey?: string;
  apiSecret?: string;
  sellerId?: string;
  apiUrl?: string;
}

export interface MarketplaceConfig {
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
  sellerId?: string;
  storeId?: string;
  merchantId?: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: number;
  server?: string;
  contentType?: string;
}

export interface AuthConfig {
  type: 'BASIC' | 'HEADER' | 'QUERY' | 'BEARER' | 'SOAP' | 'NONE';
  headers: Record<string, string>;
  body?: string;
  method?: string;
}
