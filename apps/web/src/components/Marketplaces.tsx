type Marketplace = {
  id: string;
  name: string;
  key: string;
  apiStatus?: string | null;
};

type MarketplacesProps = {
  items?: Marketplace[];
  onSync?: (key: string) => void;
  syncingKeys?: Record<string, boolean>;
};

export default function Marketplaces({ items = [], onSync, syncingKeys = {} }: MarketplacesProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Marketplaces</h2>
        <span className="badge bg-blue-100 text-blue-700">{items.length} kayıt</span>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No marketplaces yet.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="font-medium text-slate-800">{m.name}</div>
              <div className="mt-1 text-xs text-slate-500">key: {m.key}</div>
              <div className="mt-1 text-xs text-slate-500">apiStatus: {String(m.apiStatus ?? '-')}</div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onSync?.(m.key)}
                disabled={Boolean(syncingKeys[m.key])}
              >
                {syncingKeys[m.key] ? 'Syncing…' : 'Sync enqueue'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
