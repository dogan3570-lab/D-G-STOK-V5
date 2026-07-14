'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  sku: string;
  stock: number;
  category?: { name: string };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-white pt-24">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-4xl font-light text-gray-900 mb-8">Tüm Ürünler</h1>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {products.map(product => (
              <Link href={`/products/${product.id}`} key={product.id} className="group">
                <div className="aspect-square bg-gray-100 mb-4 overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">Görsel Yok</div>
                  )}
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1 group-hover:text-gray-600">{product.name}</h3>
                <p className="text-sm text-gray-500">₺{Number(product.price).toFixed(2)}</p>
                {product.stock <= 0 && <p className="text-xs text-red-500 mt-1">Stokta Yok</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}