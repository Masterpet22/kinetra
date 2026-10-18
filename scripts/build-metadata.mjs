export function normalizeBuildId(value, fallback = "local") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || fallback;
}

export function deploymentVersion(version, buildId) {
  return `${version}-${normalizeBuildId(buildId)}`;
}

export function stampAssetVersions(html, stamp) {
  return html.replace(/\?v=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, `?v=${stamp}`);
}

export function stampModuleImports(source, stamp) {
  return source.replace(
    /(\b(?:from\s+|import\s*\()(["']))(\.\.?\/[^"']+\.js)(?:\?v=[^"']+)?(\2\)?)/g,
    (_match, prefix, quote, path, suffix) => `${prefix}${path}?v=${stamp}${suffix}`
  );
}
