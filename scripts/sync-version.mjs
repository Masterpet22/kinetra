import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const packagePath = new URL("package.json", root);
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const version = String(packageJson.version || "").trim();
const checkOnly = process.argv.includes("--check");
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!versionPattern.test(version)) {
  throw new Error(`package.json contiene una versión no compatible: ${version || "(vacía)"}`);
}

async function collectFiles(relativePath) {
  const absolutePath = new URL(relativePath, root);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(relativePath, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) files.push(...await collectFiles(`${child}/`));
    else if ([".html", ".js", ".mjs", ".css"].includes(extname(entry.name))) files.push(child);
  }
  return files;
}

const files = ["index.html", ...await collectFiles("src/"), ...await collectFiles("tests/")];
const stale = [];
let replacements = 0;

for (const file of files) {
  const url = new URL(file, root);
  const source = await readFile(url, "utf8");
  const updated = source.replace(/\?v=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, (match) => {
    replacements += 1;
    return `?v=${version}`;
  });
  if (updated === source) continue;
  stale.push(file);
  if (!checkOnly) await writeFile(url, updated);
}

if (checkOnly && stale.length) {
  console.error(`Versión desactualizada en: ${stale.join(", ")}`);
  console.error("Ejecuta npm run version:sync para sincronizarla con package.json.");
  process.exitCode = 1;
} else {
  const action = checkOnly ? "verificada" : "sincronizada";
  console.log(`Versión ${version} ${action} en ${replacements} referencia(s).`);
}
