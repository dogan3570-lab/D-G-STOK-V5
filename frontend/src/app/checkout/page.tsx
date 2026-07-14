'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('credit');

  return (
    <main className="min-h-screen bg-white pt-32 pb-24">
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-4xl font-light tracking-tight text-gray-900 mb-2">Ödeme</h1>
        <p className="text-gray-500 text-sm mb-12">Güvenli ödeme, hızlı teslimat.</p>

        {/* Adım Göstergesi */}
        <div className="flex items-center justify-between mb-16">
          {[
            { num: 1, label: 'Teslimat' },
            { num: 2, label: 'Ödeme' },
            { num: 3, label: 'Onay' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 ${
                step >= s.num ? 'bg-black text-white' : 'bg-gray-100 text-gray-300'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? 'text-gray-900' : 'text-gray-300'}`}>
                {s.label}
              </span>
              {s.num < 3 && (
                <div className={`w-16 h-px hidden md:block ${step > s.num ? 'bg-black' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Adım 1: Teslimat */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-gray-900">Teslimat Adresi</h2>
            <div className="grid grid-cols-2 gap-5">
              <input name="ad" placeholder="Ad" className="col-span-2 md:col-span-1 border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
              <input name="soyad" placeholder="Soyad" className="col-span-2 md:col-span-1 border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
              <input name="telefon" placeholder="Telefon" className="col-span-2 border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
              <input name="adres" placeholder="Adres" className="col-span-2 border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
              <input name="sehir" placeholder="Şehir" className="border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
              <input name="postaKodu" placeholder="Posta Kodu" className="border-b border-gray-300 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-black bg-transparent" />
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-black text-white py-4 text-sm tracking-widest uppercase hover:bg-gray-900 transition-all mt-8">
              Devam Et
            </button>
          </div>
        )}

        {/* Adım 2: Ödeme */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-gray-900">Ödeme Yöntemi</h2>
            <div className="space-y-3">
              {[
                { id: 'credit', label: 'Kredi Kartı', desc: 'Visa, Mastercard, Troy ile ödeme' },
                { id: 'cod', label: 'Kapıda Ödeme', desc: 'Kapıda nakit veya kart ile ödeme' },
                { id: 'transfer', label: 'Havale / EFT', desc: 'Banka havalesi ile ödeme' },
              ].map((m) => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                  className={`w-full flex items-center gap-4 p-5 border transition-all text-left ${
                    paymentMethod === m.id ? 'border-black bg-black/5' : 'border-gray-100 hover:border-gray-300'
                  }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === m.id ? 'border-black' : 'border-gray-300'
                  }`}>
                    {paymentMethod === m.id && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setStep(1)} className="px-8 py-4 border border-gray-200 text-sm text-gray-600 hover:border-black hover:text-black transition-all">
                Geri
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-black text-white py-4 text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
                Ödemeyi Tamamla
              </button>
            </div>
          </div>
        )}

        {/* Adım 3: Onay */}
        {step === 3 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-8">
              <span className="text-3xl text-white">✓</span>
            </div>
            <h2 className="text-3xl font-light text-gray-900 mb-4">Siparişiniz Alındı!</h2>
            <p className="text-gray-500 mb-2">Sipariş numaranız</p>
            <p className="text-2xl font-light text-gray-900 mb-8 tracking-widest">
              #DG-{Math.random().toString(36).substr(2, 8).toUpperCase()}
            </p>
            <p className="text-gray-500 text-sm mb-12 max-w-md mx-auto leading-relaxed">
              Siparişiniz en kısa sürede hazırlanıp kargoya verilecektir.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/products" className="px-8 py-4 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
                Alışverişe Devam Et
              </Link>
              <Link href="/account" className="px-8 py-4 border border-gray-200 text-sm text-gray-600 hover:border-black hover:text-black transition-all">
                Siparişlerim
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}