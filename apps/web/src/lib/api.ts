// ==================== GELİŞMİŞ API HELPER ====================
// Tüm API isteklerinde oturum bilgisini gönderir.
// 401 alınırsa oturumu temizleyip login sayfasına yönlendirir.
// Hata durumlarında retry ve kullanıcıya bildirim desteği.

import { showToast } from '../components/ui/Toast';

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Geriye dönük uyumluluk için Response benzeri wrapper
class ApiResponseWrapper<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  status: number;

  constructor(response: { ok: boolean; data?: T; error?: ApiError; status: number }) {
    this.ok = response.ok;
    this.data = response.data;
    this.error = response.error;
    this.status = response.status;
  }

  // Geriye dönük uyumluluk: eski kodlar await res.json() çağırıyordu
  async json(): Promise<any> {
    return this.data;
  }
}

export type ApiResponse<T = unknown> = ApiResponseWrapper<T>;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dgstok_token');
}

function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('dgstok_token');
  localStorage.removeItem('dgstok_loggedin');
  localStorage.removeItem('user');
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  retries = 2,
): Promise<ApiResponseWrapper<T>> {
  const existingHeaders = (options.headers as Record<string, string>) || {};
  const hasContentType = Object.keys(existingHeaders).some(
    k => k.toLowerCase() === 'content-type',
  );

  const headers: Record<string, string> = {
    ...existingHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers['x-auth-token'] = token;
  }

  if (options.body && !hasContentType && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers,
      });

      // 401 Unauthorized → session expired, logout
      // 401 Unauthorized → session expired, logout
      if (response.status === 401) {
        clearSession();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return new ApiResponseWrapper({ ok: false, error: { code: 'SESSION_EXPIRED', message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.' }, status: 401 });
      }

      // 204 No Content
      if (response.status === 204) {
        return new ApiResponseWrapper({ ok: true, status: 204 });
      }

      const text = await response.text();
      let data: T;

      try {
        data = JSON.parse(text);
      } catch {
        // JSON değilse raw text döndür
        data = text as unknown as T;
      }

      if (!response.ok) {
        const errorData = (data as any)?.error || {};
        return new ApiResponseWrapper({
          ok: false,
          error: {
            code: errorData.code || 'UNKNOWN_ERROR',
            message: errorData.message || `Sunucu hatası (${response.status})`,
            details: errorData,
          },
          status: response.status,
        });
      }

      return new ApiResponseWrapper({ ok: true, data, status: response.status });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
    }
  }

  return new ApiResponseWrapper({
    ok: false,
    error: {
      code: 'NETWORK_ERROR',
      message: lastError?.message || 'Ağ bağlantısı kurulamadı',
    },
    status: 0,
  });
}

// ==================== API HOOK ====================
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  url: string,
  options?: { immediate?: boolean; retries?: number; onError?: (error: string) => void },
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options?.immediate !== false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await apiFetch<T>(url, {}, options?.retries ?? 2);

    if (!mountedRef.current) return;

    if (result.ok && result.data !== undefined) {
      setData(result.data);
    } else {
      const errorMsg = result.error?.message || 'Bilinmeyen hata';
      setError(errorMsg);
      // options?.onError?.(errorMsg);
      if (options?.onError) {
        options.onError(errorMsg);
      } else {
        showToast('error', errorMsg);
      }
    }
    setLoading(false);
  }, [url, options?.retries]);

  useEffect(() => {
    mountedRef.current = true;
    if (options?.immediate !== false) {
      fetchData();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
