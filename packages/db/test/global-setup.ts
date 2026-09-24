import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ADMIN_URL, TEMPLATE_DB, databaseUrl } from "./config";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../../supabase/migrations");

// Roles are cluster-wide, so they are created once, outside any database.
const ROLES_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;
`;

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function dropTemplate(admin: pg.Client) {
  await admin.query(`ALTER DATABASE ${TEMPLATE_DB} IS_TEMPLATE false`).catch(() => undefined);
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)`);
}

/** Builds a template database with every migration applied; test files clone it. */
export async function setup() {
  await withClient(ADMIN_URL, async (admin) => {
    await admin.query(ROLES_SQL);
    await dropTemplate(admin);
    await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  });

  await withClient(databaseUrl(TEMPLATE_DB), async (db) => {
    const hasAuth = await db.query("SELECT 1 FROM pg_namespace WHERE nspname = 'auth'");
    if (hasAuth.rowCount === 0) {
      await db.query(await readFile(path.join(here, "supabase-shim.sql"), "utf8"));
    }

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      try {
        await db.query(sql);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
  });

  await withClient(ADMIN_URL, async (admin) => {
    await admin.query(`ALTER DATABASE ${TEMPLATE_DB} IS_TEMPLATE true`);
  });
}

export async function teardown() {
  await withClient(ADMIN_URL, dropTemplate);
}
