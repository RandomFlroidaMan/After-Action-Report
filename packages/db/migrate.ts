import { database } from './index';
const db = await database();
console.log('Migrations applied');
await db.close();
