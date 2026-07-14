import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Bölümü */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white pt-16">
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-6xl md:text-8xl font-light tracking-tight text-gray-900 mb-6">DG STOK V5.0</h1>
          <p className="text-xl md:text-2xl text-gray-500 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
            Pazaryeri entegrasyonlu stok yönetim sistemi. Trendyol, Hepsiburada, Amazon TR.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/products" className="px-10 py-4 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-800 transition-all duration-300">Alışverişe Başla</Link>
            <Link href="/collections/new" className="px-10 py-4 border border-gray-300 text-gray-700 text-sm tracking-widest uppercase hover:border-black hover:text-black transition-all duration-300">Yeni Sezon</Link>
          </div>
        </div>
      </section>

      {/* Kategori Vitrini */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-light text-gray-900 mb-12 text-center">Kategoriler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {['Mutfak', 'Banyo', 'Dekorasyon', 'Saklama'].map((cat) => (
            <Link key={cat} href={`/category/${cat.toLowerCase()}`} 
              className="group relative h-64 bg-gray-100 overflow-hidden">
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-lg font-medium text-gray-900">{cat}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Öne Çıkanlar */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-light text-gray-900 mb-12 text-center">Öne Çıkan Ürünler</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-square bg-gray-200 mb-4 overflow-hidden">
                  <div className="w-full h-full bg-gray-300 animate-pulse" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">Ürün Adı</h3>
                <p className="text-sm text-gray-500">₺199,99</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Güven Alanı */}
      <section className="py-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { title: 'Güvenli Ödeme', icon: '🔒' },
            { title: 'Hızlı Kargo', icon: '🚚' },
            { title: 'Kolay İade', icon: '↩️' },
            { title: 'Müşteri Desteği', icon: '💬' },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-sm font-medium text-gray-900">{item.title}</h3>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}