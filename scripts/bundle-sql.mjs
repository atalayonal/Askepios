// supabase/migrations dosyalarını ve seed.sql'i, Supabase SQL Editor'a tek seferde
// yapıştırılabilecek tek bir dosyada birleştirir: supabase/kurulum.sql
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => `supabase/migrations/${f}`);
files.push("supabase/seed.sql");

const parts = [
  "-- Askepios: Supabase SQL Editor'a yapıştırılacak kurulum dosyası (sadece boş bir projede, bir kez).",
  "-- Bu dosya otomatik üretilir: npm run db:bundle",
  ...files.map((f) => `\n-- ===== ${f}\n${readFileSync(f, "utf8").replace(/^begin;$|^commit;$/gm, "")}`),
];
writeFileSync("supabase/kurulum.sql", parts.join("\n"));
console.log(`supabase/kurulum.sql yazıldı (${files.length} dosya).`);
