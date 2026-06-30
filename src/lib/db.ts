// lib/db.ts
// Minimal Postgres client. Uses `pg` (node-postgres).
// Connection string comes from DATABASE_URL.
//
// Two notes for the team:
//   - We intentionally avoid an ORM for the MVP. SQL is fine for two tables.
//   - In serverless (Vercel), instantiate the pool lazily and reuse across
//     invocations. `globalThis` cache prevents the connection count from
//     blowing up on cold starts.

import { Pool, type PoolClient } from "pg";

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

export async function query<T = unknown>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  return pool().query<T>(text, params as never);
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
