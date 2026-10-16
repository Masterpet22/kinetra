import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url);
const budgets = JSON.parse(await readFile(new URL("budgets.json", root), "utf8"));

async function files(directory, extensions) {
  const result = [];
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const relative = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) result.push(...(await files(`${relative}/`, extensions)));
    else if (extensions.includes(extname(entry.name))) result.push(relative);
  }
  return result;
}

async function total(paths) {
  return paths.reduce(
    async (sumPromise, path) => (await sumPromise) + (await stat(new URL(path, root))).size,
    Promise.resolve(0)
  );
}

const measurements = {
  javascriptBytes: await total(await files("src/", [".js"])),
  cssBytes: (await stat(new URL("styles.css", root))).size,
  initialAssetBytes: await total(["assets/brand/kinetra-logo.png", "assets/favicon.png"])
};

let failed = false;
for (const [name, value] of Object.entries(measurements)) {
  const limit = budgets[name];
  console.log(`${name}: ${value} / ${limit} bytes`);
  if (value > limit) failed = true;
}
if (failed) process.exitCode = 1;
