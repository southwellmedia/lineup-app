/**
 * Tests need a Postgres 15+ server with the btree_gist extension available.
 * Point DATABASE_URL at any database on it; tests create and drop their own.
 */
export const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

export const TEMPLATE_DB = "lineup_test_template";

export function databaseUrl(database: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}
