import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of [
  "index.html",
  "styles.css",
  "LICENSE",
  "README.md",
  "src",
  "assets",
  "docs/kinetra-v2.schema.json"
]) {
  const source = new URL(path, root);
  const destination = new URL(path, output);
  await mkdir(new URL("./", destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
await writeFile(
  new URL("version.json", output),
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version }, null, 2)}\n`
);
console.log(`Artefacto de producción ${packageJson.version} creado en dist/`);
