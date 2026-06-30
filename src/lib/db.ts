// lib/db.ts
// Minimal Postgres client. Uses `pg` (node-postgres).
// Connection string comes from DATABASE_URL.
//
// Two notes for the team:
//   - We intentionally avoid an ORM for the MVP. SQL is fine for two tables.
//   - In serverless (Vercel), instantiate the pool lazily and reuse across
//     invocations. `globalThis` cache prevents the connection count from
//     blowing up on cold starts.

import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __productpop_pg_pool__: Pool | undefined;
}

function pool(): Pool {
  if (!globalThis.__productpop_pg_pool__) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    globalThis.__productpop_pg_pool__ = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      ssl: connectionString.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return globalThis.__productpop_pg_pool__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  // Cast through `any` because pg's overloaded query<R, I> generics
  // don't always flow T through the constraint cleanly. The runtime
  // behaviour is identical — `pg` forwards `values` straight to libpq.
  const result = await (pool().query as any)(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

export async function withClient<T>(
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
