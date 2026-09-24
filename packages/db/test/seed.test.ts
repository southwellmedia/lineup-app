import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { useTestDb } from "./db";

const db = useTestDb();
const seedPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/seed.sql",
);

describe("seed.sql", () => {
  it("applies cleanly on top of the migrations", async () => {
    await db.pool.query(await readFile(seedPath, "utf8"));

    const { rows } = await db.pool.query(`
      SELECT
        (SELECT count(*)::int FROM shops) AS shops,
        (SELECT count(*)::int FROM staff) AS staff,
        (SELECT count(*)::int FROM staff_services) AS staff_services,
        (SELECT count(*)::int FROM working_hours) AS working_hours,
        (SELECT count(*)::int FROM clients) AS clients
    `);
    expect(rows[0]).toEqual({
      shops: 1,
      staff: 2,
      staff_services: 10,
      working_hours: 18,
      clients: 3,
    });
  });
});
