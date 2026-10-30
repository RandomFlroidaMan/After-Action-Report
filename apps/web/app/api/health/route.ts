import { database } from '../../../../../packages/db/index';
import { hostedReadiness } from '../../../../../packages/deployment/config';
export const runtime = 'nodejs';
export async function GET() {
  const readiness = hostedReadiness();
  if (!readiness.ready)
    return Response.json(
      { status: 'setup_required', missing: readiness.missing },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  try {
    await (await database()).query('SELECT 1');
    return Response.json({
      status: 'ok',
      storage:
        process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'postgresql' : 'embedded-postgresql',
    });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
