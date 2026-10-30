import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
const rootEnv = path.resolve(
  process.cwd(),
  path.basename(process.cwd()) === 'web' ? '../../.env' : '.env',
);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const config: NextConfig = {
  outputFileTracingRoot: path.resolve(
    process.cwd(),
    path.basename(process.cwd()) === 'web' ? '../..' : '.',
  ),
  outputFileTracingIncludes: { '/api/*': ['../../packages/db/migrations/*.sql'] },
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'pdf-parse', 'pdf-lib'],
  experimental: { cpus: 2 },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' " +
              (process.env.NODE_ENV === 'development' ? "'unsafe-eval' " : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
