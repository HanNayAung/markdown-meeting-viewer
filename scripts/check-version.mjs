// Checks that the version is the same everywhere before a release:
// src/manifest.json, package.json, the newest CHANGELOG.md entry,
// and (in GitHub Actions) the git tag "v<version>".
//
//   node scripts/check-version.mjs           → check
//   node scripts/check-version.mjs --notes   → print this version's CHANGELOG section
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const changelog = readFileSync("CHANGELOG.md", "utf8");
const version = manifest.version;

const sections = changelog.split(/^## /m).slice(1);
const newest = sections[0] || "";
const newestVersion = newest.split(/\s/)[0];

if (process.argv.includes("--notes")) {
  const mine = sections.find((s) => s.split(/\s/)[0] === version) || "";
  console.log(mine.split("\n").slice(1).join("\n").trim());
  process.exit(0);
}

const problems = [];
if (pkg.version !== version) {
  problems.push(`package.json says ${pkg.version}, manifest.json says ${version}`);
}
if (newestVersion !== version) {
  problems.push(`newest CHANGELOG entry is "${newestVersion}", manifest.json says ${version}`);
}
const ref = process.env.GITHUB_REF || "";
if (ref.startsWith("refs/tags/") && ref !== `refs/tags/v${version}`) {
  problems.push(`tag is ${ref.replace("refs/tags/", "")}, but the version is ${version} (tag should be v${version})`);
}

if (problems.length) {
  console.error("Version check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Version ${version} ✓`);
