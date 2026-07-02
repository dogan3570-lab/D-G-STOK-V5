type Supplier = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'PASSIVE';
};

type SuppliersProps = {
  items?: Supplier[];
};

export default function Suppliers({ items = [] }: SuppliersProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Suppliers</h2>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
          Yeni Tedarikçi
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Tedarikçi bulunamadı.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-800">{s.name}</div>
                <span className="badge bg-slate-100 text-slate-700">{s.status ?? 'ACTIVE'}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{s.email ?? 'E-posta yok'}</div>
              <div className="text-xs text-slate-500">{s.phone ?? 'Telefon yok'}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
