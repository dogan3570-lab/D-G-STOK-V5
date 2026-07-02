type Category = {
  id: string;
  name: string;
  productCount?: number;
};

type CategoriesProps = {
  items?: Category[];
};

export default function Categories({ items = [] }: CategoriesProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Categories</h2>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
          Yeni Kategori
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Kategori bulunamadı.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {items.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <div className="font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-slate-500">{c.productCount ?? 0} ürün</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
