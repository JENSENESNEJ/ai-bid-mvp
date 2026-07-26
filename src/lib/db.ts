import { Pool } from "pg";
const globalForDb=globalThis as unknown as {pool?:Pool};
export const db=globalForDb.pool??new Pool({connectionString:process.env.DATABASE_URL,max:8,idleTimeoutMillis:30000});
if(process.env.NODE_ENV!=="production")globalForDb.pool=db;