import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll } from "vitest";
import { ADMIN_URL, TEMPLATE_DB, databaseUrl } from "./config";

export type Db = {
  /** Superuser access, for fixtures and assertions that must see everything. */
  pool: pg.Pool;
  /** Runs `fn` in a transaction as the server (service_role, bypasses RLS). */
  asService: <T>(fn: (client: pg.PoolClient) => Promise<T>) => Promise<T>;
  /** Runs `fn` in a transaction as a signed-in user, with RLS applied. */
  asUser: <T>(
    userId: string,
    fn: (client: pg.PoolClient) => Promise<T>,
    claims?: Record<string, string>,
  ) => Promise<T>;
  /** Runs `fn` in a transaction as an anonymous visitor. */
  asAnon: <T>(fn: (client: pg.PoolClient) => Promise<T>) => Promise<T>;
};

/**
 * Gives the calling test file its own freshly migrated database, cloned from
 * the template built in global setup, and drops it when the file finishes.
 */
export function useTestDb(): Db {
  const name = `lineup_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  let pool: pg.Pool | undefined;

  beforeAll(async () => {
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB}`);
    pool = new pg.Pool({ connectionString: databaseUrl(name), max: 8 });
    // Dropping the database at teardown terminates any connection the pool
    // is still closing (57P01). Anything else is a real error.
    pool.on("error", (error: Error & { code?: string }) => {
      if (error.code !== "57P01") throw error;
    });
  });

  afterAll(async () => {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });

  const getPool = () => {
    if (!pool) throw new Error("useTestDb() pool used before beforeAll ran");
    return pool;
  };

  async function inRole<T>(
    role: "service_role" | "authenticated" | "anon",
    claims: Record<string, string>,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role, ...claims }),
      ]);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    get pool() {
      return getPool();
    },
    asService: (fn) => inRole("service_role", {}, fn),
    asUser: (userId, fn, claims = {}) => inRole("authenticated", { ...claims, sub: userId }, fn),
    asAnon: (fn) => inRole("anon", {}, fn),
  };
}

/** Postgres error code of a rejected promise, for asserting on LU* and constraint errors. */
export async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  throw new Error("Expected the query to fail, but it succeeded");
}
