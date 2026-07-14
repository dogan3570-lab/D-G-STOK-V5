'use client';

import { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  categories: string[];
}

export default function ExcelManagementPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
        toast.error('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)');
        return;
      }
      setFile(selected); setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) { toast.error('Lütfen bir Excel dosyası seçin'); return; }
    setImporting(true); setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/import/excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Import başarısız');
      const data = await res.json();
      const importResult = data.data || data;
      setResult(importResult);
      if (importResult.success) toast.success(`${importResult.imported} ürün başarıyla aktarıldı`);
      else toast.error(`${importResult.errors.length} hata oluştu`);
    } catch (err: any) {
      toast.error(err.message || 'Excel import hatası');
    } finally { setImporting(false); }
  };

  const downloadSample = () => {
    const sampleData = [
      ['SKU', 'Ürün Adı', 'Kategori', 'Alt Kategori', 'Marka', 'Fiyat', 'Alış Fiyatı', 'Stok', 'Barkod', 'Açıklama', 'Görsel URL'],
      ['ORN-001', 'Örnek Spor Ayakkabı', 'Ayakkabı', 'Spor Ayakkabı', 'Nike', '1500', '800', '100', '8691234567890', 'Premium spor ayakkabı', 'https://example.com/img.jpg'],
      ['ORN-002', 'Örnek Bot', 'Ayakkabı', 'Bot', 'Timberland', '2500', '1200', '50', '8691234567891', 'Deri bot', 'https://example.com/img2.jpg'],
      ['ORN-003', 'Örnek Boxer', 'İç Giyim', 'Boxer', 'Puma', '450', '200', '200', '8691234567892', 'Pamuklu boxer', 'https://example.com/img3.jpg'],
    ];
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ornek-excel-import.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Örnek dosya indiriliyor');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Excel Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">Excel dosyasından ürün aktarımı (.xlsx, .xls)</p>
        </div>
        <button onClick={downloadSample} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" /> Örnek Dosya İndir
        </button>
      </div>

      <div className="bg-white border border-gray-100 p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-50"><FileSpreadsheet className="w-6 h-6 text-green-600" /></div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">Excel İçe Aktar</h2>
            <p className="text-sm text-gray-500">Desteklenen format: .xlsx, .xls (Kategori, Fiyat, Stok, Varyant)</p>
          </div>
        </div>

        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 p-12 text-center cursor-pointer hover:border-gray-400 transition-colors">
          <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-600 mb-1">{file ? file.name : 'Excel dosyası seçmek için tıklayın'}</p>
          <p className="text-xs text-gray-400">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'veya dosyayı sürükleyip bırakın'}</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        </div>

        {file && (
          <div className="mt-6 flex items-center justify-between p-4 bg-gray-50">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              <div><p className="text-sm font-medium text-gray-900">{file.name}</p><p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p></div>
            </div>
            <button onClick={handleImport} disabled={importing}
              className="px-6 py-2.5 bg-black text-white text-sm hover:bg-gray-800 disabled:bg-gray-400 transition-colors flex items-center gap-2">
              {importing ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> Aktarılıyor...</> : <><Upload className="w-4 h-4" /> Excel'i Aktar</>}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                {result.success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                <span className={`text-sm font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.success ? 'Aktarım Başarılı' : 'Aktarımda Hatalar Oluştu'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white p-3 text-center"><p className="text-2xl font-light text-gray-900">{result.totalRows}</p><p className="text-xs text-gray-500">Toplam Ürün</p></div>
                <div className="bg-white p-3 text-center"><p className="text-2xl font-light text-green-600">{result.imported}</p><p className="text-xs text-gray-500">Aktarılan</p></div>
                <div className="bg-white p-3 text-center"><p className={`text-2xl font-light ${result.skipped > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{result.skipped}</p><p className="text-xs text-gray-500">Atlanan</p></div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-600" /><p className="text-sm font-medium text-red-700">Hatalı Kayıtlar ({result.errors.length})</p></div>
                <div className="max-h-40 overflow-y-auto space-y-1">{result.errors.map((err, i) => (<p key={i} className="text-xs text-red-600">• {err}</p>))}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Excel Sütun Adları</h3>
          <ul className="space-y-2 text-xs text-gray-500"><li>• SKU, Ürün Adı (Zorunlu)</li><li>• Kategori, Alt Kategori</li><li>• Fiyat, Alış Fiyatı</li><li>• Stok, Barkod, Marka</li></ul>
        </div>
        <div className="bg-white border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Esnek Sütun Eşleme</h3>
          <ul className="space-y-2 text-xs text-gray-500"><li>• Türkçe/İngilizce sütun adları</li><li>• Farklı yazılışları tanır</li><li>• Örn: fiyat, price, Fiyat</li><li>• Örn: stok, stock, Stok</li></ul>
        </div>
        <div className="bg-white border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Önemli Notlar</h3>
          <ul className="space-y-2 text-xs text-gray-500"><li>• İlk satır başlık satırı</li><li>• Kategoriler otomatik oluşur</li><li>• Aynı SKU varsa güncellenir</li><li>• Varsayılan KDV: %20</li></ul>
        </div>
      </div>
    </div>
  );
}
