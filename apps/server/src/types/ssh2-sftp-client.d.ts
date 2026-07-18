declare module 'ssh2-sftp-client' {
  import { Readable } from 'stream';

  interface ConnectOptions {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    readyTimeout?: number;
    algorithms?: { serverHostKey?: string[] };
  }

  class Client {
    constructor();
    connect(options: ConnectOptions): Promise<void>;
    get(path: string): Promise<Readable>;
    list(path: string): Promise<Array<{ name: string; size: number; modifyTime: number }>>;
    end(): Promise<void>;
  }

  export default Client;
}
