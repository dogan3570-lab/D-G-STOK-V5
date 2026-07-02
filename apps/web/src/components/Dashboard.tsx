type DashboardProps = {
  title?: string;
  stats?: Array<{ label: string; value: number | string }>;
};

export default function Dashboard({ title = 'Dashboard', stats = [] }: DashboardProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <span className="badge bg-blue-100 text-blue-700">{stats.length} marketplace</span>
      </div>

      {stats.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Gösterilecek istatistik yok.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((s, i) => (
            <div key={`${s.label}-${i}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
