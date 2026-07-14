'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function CartPage() {
  const [items, setItems] = useState([]);

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white pt-24">
        <div className="max-w-7xl mx-auto px-6 text-center py-24">
          <h1 className="text-3xl font-light mb-4">Sepetiniz Boş</h1>
          <p className="text-gray-500 mb-8">Alışverişe başlamak için ürünleri keşfedin.</p>
          <Link href="/products" className="inline-block px-8 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-800">Alışverişe Başla</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pt-24">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-3xl font-light text-gray-900 mb-8">Sepetim</h1>
      </div>
    </main>
  );
}