import { put, get, del } from '@vercel/blob';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '../db/index';
import { hasBlobConfiguration, isHosted } from '../deployment/config';
export interface PrivateStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<string>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
function validKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.(pdf|audio)$/.test(key) || key.includes('..'))
    throw new Error('Invalid private storage key');
  return key;
}
export class LocalPrivateStorage implements PrivateStorage {
  constructor(private directory = path.join(dataDir, 'uploads')) {}
  async put(key: string, bytes: Uint8Array, _mime?: string) {
    const file = path.join(this.directory, validKey(key));
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    return key;
  }
  async read(key: string) {
    return new Uint8Array(await readFile(path.join(this.directory, validKey(key))));
  }
  async remove(key: string) {
    await unlink(path.join(this.directory, validKey(key)));
  }
}
export interface BlobSDK {
  put: typeof put;
  get: typeof get;
  del: typeof del;
}
export interface BlobAuth {
  token?: string;
  storeId?: string;
}
export class VercelPrivateStorage implements PrivateStorage {
  private auth: BlobAuth;
  constructor(
    auth: string | BlobAuth,
    private sdk: BlobSDK = { put, get, del },
  ) {
    this.auth = typeof auth === 'string' ? { token: auth } : auth;
  }
  async put(key: string, bytes: Uint8Array, mime: string) {
    await this.sdk.put(validKey(key), Buffer.from(bytes), {
      access: 'private',
      ...this.auth,
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return key;
  }
  async read(key: string) {
    const result = await this.sdk.get(validKey(key), {
      access: 'private',
      ...this.auth,
      useCache: false,
    });
    if (!result || result.statusCode !== 200) throw new Error('Private source not found');
    if (result.blob.size > 26 * 1024 * 1024) {
      await result.stream.cancel();
      throw new Error('Private source exceeds size limit');
    }
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  async remove(key: string) {
    await this.sdk.del(validKey(key), { ...this.auth });
  }
}
export function privateStorage(): PrivateStorage {
  if (hasBlobConfiguration())
    return new VercelPrivateStorage({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      storeId: process.env.BLOB_STORE_ID,
    });
  if (isHosted()) throw new Error('Private Blob storage is not configured');
  return new LocalPrivateStorage();
}
