type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  status?: 'ACTIVE' | 'PASSIVE' | 'ERROR';
};

type ProductsProps = {
  items?: Product[];
};

export default function Products({ items = [] }: ProductsProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Products</h2>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
          Yeni Ürün
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Ürün bulunamadı.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-12 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            <div className="col-span-4">Ürün</div>
            <div className="col-span-3">SKU</div>
            <div className="col-span-2">Fiyat</div>
            <div className="col-span-3">Durum</div>
          </div>
          {items.map((p) => (
            <div key={p.id} className="grid grid-cols-12 border-t border-slate-200 px-3 py-2 text-sm">
              <div className="col-span-4 font-medium text-slate-800">{p.name}</div>
              <div className="col-span-3 text-slate-600">{p.sku ?? '-'}</div>
              <div className="col-span-2 text-slate-700">{typeof p.price === 'number' ? `${p.price} ₺` : '-'}</div>
              <div className="col-span-3">
                <span className="badge bg-slate-100 text-slate-700">{p.status ?? 'ACTIVE'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
