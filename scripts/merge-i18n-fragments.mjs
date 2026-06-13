// Merge messages/fragments/<namespace>.fragment.json files into the five
// locale catalogs (messages/{en,de,fr,it,es}.json), nesting each fragment's
// keys under its namespace (taken from the filename). Idempotent: re-running
// overwrites that namespace from the fragment. Fragments are left in place;
// delete them after a successful merge + review.
//
//   node scripts/merge-i18n-fragments.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "de", "fr", "it", "es"];
const MESSAGES_DIR = path.join(process.cwd(), "messages");
const FRAGMENTS_DIR = path.join(MESSAGES_DIR, "fragments");

if (!existsSync(FRAGMENTS_DIR)) {
  console.error("No messages/fragments directory — nothing to merge.");
  process.exit(1);
}

const fragmentFiles = readdirSync(FRAGMENTS_DIR).filter((f) =>
  f.endsWith(".fragment.json")
);
if (fragmentFiles.length === 0) {
  console.error("No *.fragment.json files found.");
  process.exit(1);
}

// Sanity: every fragment must have all five locales with identical key sets.
function keySet(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") keys.push(...keySet(v, `${prefix}${k}.`));
    else keys.push(`${prefix}${k}`);
  }
  return keys.sort();
}

let failed = false;
const fragments = [];
for (const file of fragmentFiles) {
  const ns = file.replace(/\.fragment\.json$/, "");
  const data = JSON.parse(readFileSync(path.join(FRAGMENTS_DIR, file), "utf8"));
  const missing = LOCALES.filter((l) => !data[l]);
  if (missing.length) {
    console.error(`✗ ${file}: missing locales: ${missing.join(", ")}`);
    failed = true;
    continue;
  }
  const enKeys = JSON.stringify(keySet(data.en));
  for (const l of LOCALES.slice(1)) {
    if (JSON.stringify(keySet(data[l])) !== enKeys) {
      console.error(`✗ ${file}: key set for "${l}" differs from "en"`);
      failed = true;
    }
  }
  fragments.push({ ns, data });
}
if (failed) process.exit(1);

for (const locale of LOCALES) {
  const catalogPath = path.join(MESSAGES_DIR, `${locale}.json`);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  for (const { ns, data } of fragments) {
    catalog[ns] = data[locale];
  }
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(
    `✓ ${locale}.json ← ${fragments.map((f) => f.ns).join(", ")}`
  );
}
