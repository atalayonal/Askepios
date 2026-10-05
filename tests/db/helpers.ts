import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(__dirname, "../..");
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/postgres";

function sqlFiles(): string[] {
  const dir = path.join(ROOT, "supabase/migrations");
  const migrations = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
  return [path.join(ROOT, "supabase/tests/supabase-shim.sql"), ...migrations];
}

/** Boş bir test veritabanı oluşturur, şemayı kurar ve bağlı bir istemci döner. */
export async function createTestDatabase(): Promise<{ db: Client; drop: () => Promise<void> }> {
  const name = `askepios_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  for (const file of sqlFiles()) {
    await db.query(readFileSync(file, "utf8"));
  }

  return {
    db,
    drop: async () => {
      await db.end();
      await admin.query(`drop database ${name} with (force)`);
      await admin.end();
    },
  };
}

/** fn'i, verilen kullanıcı oturum açmış gibi (authenticated rolü + JWT sub) çalıştırır. */
export async function asUser<T>(db: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    const result = await fn();
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

export async function createUser(
  db: Client,
  email: string,
  role: "admin" | "clinic_user",
  clinicId: string | null = null,
): Promise<string> {
  const { rows } = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  const id: string = rows[0].id;
  await db.query("insert into public.profiles (id, full_name, role, clinic_id) values ($1, $2, $3, $4)", [
    id,
    email,
    role,
    clinicId,
  ]);
  return id;
}

export async function insertReturningId(db: Client, sql: string, params: unknown[] = []): Promise<string> {
  const { rows } = await db.query(sql, params);
  return rows[0].id;
}
