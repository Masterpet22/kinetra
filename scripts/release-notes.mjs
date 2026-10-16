import { readFile } from "node:fs/promises";

const version = String(process.argv[2] || process.env.GITHUB_REF_NAME || "").replace(/^v/, "");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const match = changelog.match(new RegExp(`## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
if (!match) throw new Error(`CHANGELOG.md no contiene una sección para ${version}`);
process.stdout.write(match[1].trim() + "\n");
