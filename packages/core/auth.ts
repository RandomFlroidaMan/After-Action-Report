import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { isHosted } from '../deployment/config';
import { database, id, one, type Database } from '../db/index';
export const hashToken = (s: string) => createHash('sha256').update(s).digest('hex');
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verify(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function login(email: string, password: string, db?: Database) {
  if (isHosted() && ['dm@aar.local', 'player@aar.local'].includes(email.toLowerCase()))
    throw new Error('Invalid email or password');
  const d = db ?? (await database());
  const user = (await d.query('SELECT * FROM accounts WHERE email=$1', [email.toLowerCase()]))
    .rows[0];
  if (!user || !verify(password, user.password_hash)) throw new Error('Invalid email or password');
  const token = randomBytes(32).toString('hex');
  await d.query("INSERT INTO auth_sessions VALUES($1,$2,now()+interval '7 days')", [
    hashToken(token),
    user.id,
  ]);
  return token;
}
export async function authenticate(token?: string, db?: Database) {
  if (!token) throw new Error('Sign in required');
  return one(
    db ?? (await database()),
    'SELECT a.id,a.email,a.name FROM auth_sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hashToken(token)],
  );
}
export function assertRegistrationCode(code?: string) {
  if (!isHosted()) return;
  const expected = process.env.AAR_REGISTRATION_CODE;
  if (
    !expected ||
    expected.length < 24 ||
    expected.length > 256 ||
    !code ||
    !timingSafeEqual(
      createHash('sha256').update(code).digest(),
      createHash('sha256').update(expected).digest(),
    )
  )
    throw new Error('Private registration code is required or invalid');
}
export async function register(
  email: string,
  password: string,
  name: string,
  registrationCode?: string,
) {
  assertRegistrationCode(registrationCode);
  const db = await database();
  const userId = id();
  await db.query('INSERT INTO accounts VALUES($1,$2,$3,$4)', [
    userId,
    email.toLowerCase(),
    name,
    passwordHash(password),
  ]);
  return login(email, password, db);
}
