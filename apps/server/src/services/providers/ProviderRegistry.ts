import type { IDataProvider, SourceType } from './IDataProvider.ts';
import { JsonProvider } from './JsonProvider.ts';
import { CsvProvider } from './CsvProvider.ts';
import { ExcelProvider } from './ExcelProvider.ts';
import { ApiProvider } from './ApiProvider.ts';
import { FtpProvider } from './FtpProvider.ts';
import { SftpProvider } from './SftpProvider.ts';

type ProviderConstructor = new () => IDataProvider;

const providers: Map<SourceType, ProviderConstructor> = new Map();

// Tum provider'lari kaydet
providers.set('json', JsonProvider);
providers.set('csv', CsvProvider);
providers.set('excel', ExcelProvider);
providers.set('api', ApiProvider);
providers.set('ftp', FtpProvider);
providers.set('sftp', SftpProvider);

export function registerProvider(type: SourceType, constructor: ProviderConstructor): void {
  providers.set(type, constructor);
}

export function getProvider(type: SourceType): IDataProvider | null {
  const ctor = providers.get(type);
  if (!ctor) return null;
  return new ctor();
}

export function getAvailableProviders(): Array<{ type: SourceType; info: import('./IDataProvider.ts').ProviderInfo }> {
  const result: Array<{ type: SourceType; info: import('./IDataProvider.ts').ProviderInfo }> = [];
  for (const [type, ctor] of providers) {
    try {
      const instance = new ctor();
      result.push({ type, info: instance.info });
    } catch { /* skip invalid providers */ }
  }
  return result;
}

export function listSupportedTypes(): SourceType[] {
  return Array.from(providers.keys());
}
