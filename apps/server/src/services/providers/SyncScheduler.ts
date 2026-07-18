import { prisma } from '../../db/prisma.ts';
import { getProvider } from './ProviderRegistry.ts';
import type { ProviderConfig } from './IDataProvider.ts';

const syncLocks = new Map<string, boolean>();
const intervals = new Map<string, ReturnType<typeof setInterval>>();

const INTERVAL_PRESETS = [5, 15, 30, 60, 180, 360, 720, 1440]; // dakika

export function getIntervalPresets(): number[] {
  return INTERVAL_PRESETS;
}

export function isSyncLocked(sourceId: string): boolean {
  return syncLocks.get(sourceId) === true;
}

export async function runSync(sourceId: string): Promise<{ ok: boolean; message: string }> {
  if (syncLocks.get(sourceId)) {
    return { ok: false, message: 'Senkronizasyon zaten calisiyor' };
  }

  syncLocks.set(sourceId, true);
  try {
    const source = await prisma.xmlSource.findUnique({ where: { id: sourceId } });
    if (!source) return { ok: false, message: 'Kaynak bulunamadi' };

    const provider = getProvider(source.sourceType as any);
    if (!provider) return { ok: false, message: 'Provider bulunamadi' };

    const config: ProviderConfig = {
      name: source.name,
      sourceType: source.sourceType as any,
      url: source.url || undefined,
      username: source.username || undefined,
      password: source.password || undefined,
      filePath: undefined,
    };

    const result = await provider.fetch(config);

    await prisma.xmlSource.update({
      where: { id: sourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: result.ok ? new Date() : undefined,
        lastError: result.ok ? null : result.error,
        connectionStatus: result.ok ? 'ok' : 'error',
      },
    });

    return { ok: result.ok, message: `${result.totalCount} urun bulundu` };
  } catch (error: any) {
    return { ok: false, message: error.message };
  } finally {
    syncLocks.set(sourceId, false);
  }
}

export function startScheduledSync(sourceId: string, intervalMinutes: number): void {
  stopScheduledSync(sourceId);
  
  const validInterval = INTERVAL_PRESETS.find(p => p === intervalMinutes) || 60;
  const ms = validInterval * 60 * 1000;

  const id = setInterval(async () => {
    try {
      await runSync(sourceId);
    } catch (error) {
      console.error(`[SyncScheduler] Error for ${sourceId}:`, error);
    }
  }, ms);

  intervals.set(sourceId, id);
  console.log(`[SyncScheduler] Scheduled sync started for ${sourceId} (every ${validInterval} min)`);
}

export function stopScheduledSync(sourceId: string): void {
  const id = intervals.get(sourceId);
  if (id) {
    clearInterval(id);
    intervals.delete(sourceId);
    console.log(`[SyncScheduler] Scheduled sync stopped for ${sourceId}`);
  }
}

export function stopAllSyncs(): void {
  for (const [sourceId] of intervals) {
    stopScheduledSync(sourceId);
  }
}
