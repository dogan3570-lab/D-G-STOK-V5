import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DG STOK V5.0 | Stok Yönetim Sistemi',
  description: 'Pazaryeri entegrasyonlu stok yönetim sistemi. Trendyol, Hepsiburada, Amazon TR.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-white text-gray-900 antialiased">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="text-xl font-light tracking-widest">DG STOK V5.0</Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/products" className="text-sm text-gray-600 hover:text-black transition-colors">Tüm Ürünler</Link>
              <Link href="/category/mutfak" className="text-sm text-gray-600 hover:text-black transition-colors">Mutfak</Link>
              <Link href="/category/banyo" className="text-sm text-gray-600 hover:text-black transition-colors">Banyo</Link>
              <Link href="/category/dekorasyon" className="text-sm text-gray-600 hover:text-black transition-colors">Dekorasyon</Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/search" className="text-sm text-gray-600 hover:text-black">🔍</Link>
              <Link href="/account" className="text-sm text-gray-600 hover:text-black">👤</Link>
              <Link href="/cart" className="text-sm text-gray-600 hover:text-black">🛒</Link>
            </div>
          </div>
        </header>
        {children}
        <footer className="bg-black text-white py-16">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-light mb-4">D&G STORE</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Premium kalite, modern tasarım. Hayatınıza değer katan ürünler.</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-4">Alışveriş</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <Link href="/products" className="block hover:text-white">Tüm Ürünler</Link>
                <Link href="/collections/new" className="block hover:text-white">Yeni Gelenler</Link>
                <Link href="/collections/best-sellers" className="block hover:text-white">Çok Satanlar</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-4">Yardım</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <Link href="/help/shipping" className="block hover:text-white">Kargo ve Teslimat</Link>
                <Link href="/help/returns" className="block hover:text-white">İade ve Değişim</Link>
                <Link href="/help/faq" className="block hover:text-white">SSS</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-4">İletişim</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <p>info@dgstore.com</p>
                <p>0850 123 45 67</p>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            © 2026 D&G STORE. Tüm hakları saklıdır.
          </div>
        </footer>
      </body>
    </html>
  );
}