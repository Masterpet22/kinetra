import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.env.GITHUB_REF_NAME || process.argv[2] || "";
if (tag !== `v${packageJson.version}`) {
  throw new Error(`El tag ${tag || "(vacío)"} no coincide con package.json v${packageJson.version}`);
}
console.log(`Tag ${tag} y paquete ${packageJson.version} coinciden.`);
