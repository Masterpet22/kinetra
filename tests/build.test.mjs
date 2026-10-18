import assert from "node:assert/strict";
import {
  deploymentVersion,
  normalizeBuildId,
  stampAssetVersions,
  stampModuleImports
} from "../scripts/build-metadata.mjs";

assert.equal(normalizeBuildId(" ABC_123 "), "abc-123");
assert.equal(deploymentVersion("0.13.0", "ABC123"), "0.13.0-abc123");
const stamped = stampAssetVersions(
  '<link href="./styles.css?v=0.13.0"><script src="./editor.js?v=0.13.0"></script>',
  "0.13.0-abc123"
);
assert.match(stamped, /styles\.css\?v=0\.13\.0-abc123/);
assert.match(stamped, /editor\.js\?v=0\.13\.0-abc123/);
assert.doesNotMatch(stamped, /\?v=0\.13\.0["']/);

const modules = stampModuleImports(
  'import { one } from "../one.js"; import("./two.js"); import("https://example.com/three.js");',
  "0.13.0-abc123"
);
assert.match(modules, /\.\.\/one\.js\?v=0\.13\.0-abc123/);
assert.match(modules, /\.\/two\.js\?v=0\.13\.0-abc123/);
assert.match(modules, /https:\/\/example\.com\/three\.js/);
assert.doesNotMatch(modules, /example\.com\/three\.js\?v=/);

console.log("Pruebas de identificación de despliegue superadas.");
