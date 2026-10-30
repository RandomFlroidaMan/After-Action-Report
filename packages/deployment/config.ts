export type Environment = Record<string, string | undefined>;
export function isHosted(env: Environment = process.env) {
  return env.VERCEL === '1' || env.AAR_DEPLOYMENT === 'hosted';
}
export function hostedReadiness(env: Environment = process.env) {
  if (!isHosted(env)) return { ready: true, missing: [] as string[] };
  const missing: string[] = [];
  if (!(env.DATABASE_URL || env.POSTGRES_URL)) missing.push('Hosted PostgreSQL database');
  if (!env.BLOB_READ_WRITE_TOKEN) missing.push('Private Vercel Blob storage');
  if (
    !env.AAR_REGISTRATION_CODE ||
    env.AAR_REGISTRATION_CODE.length < 24 ||
    env.AAR_REGISTRATION_CODE.length > 256
  )
    missing.push('Private registration code (at least 24 characters)');
  return { ready: missing.length === 0, missing };
}
export function maxUploadBytes(kind: 'pdf' | 'audio', env: Environment = process.env) {
  // Leave headroom below the documented 4.5 MB Vercel Function body limit.
  return (isHosted(env) ? 3 : kind === 'pdf' ? 10 : 25) * 1024 * 1024;
}
