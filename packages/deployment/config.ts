export type Environment = Record<string, string | undefined>;
export function isHosted(env: Environment = process.env) {
  return env.VERCEL === '1' || env.AAR_DEPLOYMENT === 'hosted';
}
export function hasBlobConfiguration(env: Environment = process.env) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
}
export function hostedReadiness(env: Environment = process.env) {
  if (!isHosted(env)) return { ready: true, missing: [] as string[] };
  const missing: string[] = [];
  if (!(env.DATABASE_URL || env.POSTGRES_URL)) missing.push('Hosted PostgreSQL database');
  if (!hasBlobConfiguration(env)) missing.push('Private Vercel Blob storage');
  if (!env.AAR_REGISTRATION_CODE) missing.push('Private registration code (AAR_REGISTRATION_CODE)');
  else if (env.AAR_REGISTRATION_CODE.length < 24 || env.AAR_REGISTRATION_CODE.length > 256)
    missing.push('Private registration code must be 24–256 characters (spaces count)');
  return { ready: missing.length === 0, missing };
}
export function maxUploadBytes(kind: 'pdf' | 'audio', env: Environment = process.env) {
  // Leave headroom below the documented 4.5 MB Vercel Function body limit.
  return (isHosted(env) ? 3 : kind === 'pdf' ? 10 : 25) * 1024 * 1024;
}
