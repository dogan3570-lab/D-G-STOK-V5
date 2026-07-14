'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
      toast.success('Giriş başarılı!');
      // Admin kullanıcıyı admin paneline yönlendir
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
      router.refresh();
    } catch (err: any) {
      const message = err.message || 'Giriş yapılırken bir hata oluştu';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <main className="min-h-screen bg-white pt-24">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Giriş Yap</h1>
          <p className="text-sm text-gray-500">
            Hesabınıza giriş yaparak alışverişe başlayın
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded mb-6 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
              placeholder="ornek@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Giriş Yap
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Hesabınız yok mu?{' '}
            <Link href="/auth/register" className="text-black underline hover:text-gray-600">
              Kayıt Ol
            </Link>
          </p>
        </div>

        {/* Demo bilgileri */}
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 font-medium mb-2">🔑 Demo Hesap:</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-400">
              <span className="text-gray-500">E-posta:</span> admin@dgstore.com
            </p>
            <p className="text-xs text-gray-400">
              <span className="text-gray-500">Şifre:</span> admin123
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
