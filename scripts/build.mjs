import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { deploymentVersion, normalizeBuildId, stampAssetVersions, stampModuleImports } from "./build-metadata.mjs";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
const execFileAsync = promisify(execFile);

async function resolveBuildId() {
  if (process.env.KINETRA_BUILD_ID) return normalizeBuildId(process.env.KINETRA_BUILD_ID);
  if (process.env.GITHUB_SHA) return normalizeBuildId(process.env.GITHUB_SHA.slice(0, 12));
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root });
    return normalizeBuildId(stdout);
  } catch {
    return "local";
  }
}

async function javascriptFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) result.push(...(await javascriptFiles(new URL(`${entry.name}/`, directory))));
    else if (entry.name.endsWith(".js")) result.push(url);
  }
  return result;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of [
  "index.html",
  "styles.css",
  "LICENSE",
  "README.md",
  "src",
  "assets",
  "landing",
  "docs/kinetra-v2.schema.json"
]) {
  const source = new URL(path, root);
  const destination = new URL(path, output);
  await mkdir(new URL("./", destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const buildId = await resolveBuildId();
const deployedVersion = deploymentVersion(packageJson.version, buildId);
const builtIndexPath = new URL("index.html", output);
const builtIndex = await readFile(builtIndexPath, "utf8");
await writeFile(builtIndexPath, stampAssetVersions(builtIndex, deployedVersion));
for (const modulePath of await javascriptFiles(new URL("src/", output))) {
  const source = await readFile(modulePath, "utf8");
  await writeFile(modulePath, stampModuleImports(source, deployedVersion));
}
await writeFile(
  new URL("version.json", output),
  `${JSON.stringify({ name: packageJson.name, version: packageJson.version, buildId, deployedVersion }, null, 2)}\n`
);
console.log(`Artefacto de producción ${deployedVersion} creado en dist/`);
