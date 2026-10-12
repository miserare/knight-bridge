import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync("release", { recursive: true });
const files = readdirSync(".output").filter(
  (name) =>
    name.startsWith(`knight-bridge-${version}-`) &&
    name.endsWith(".zip") &&
    !name.includes("sources"),
);
for (const name of files) cpSync(`.output/${name}`, `release/${name}`);
const source = `knight-bridge-${version}-source.zip`;
// An allowlist keeps personal files, caches, and earlier releases out of the source archive.
rmSync(`release/${source}`, { force: true });
execFileSync("zip", [
  "-q",
  "-r",
  `release/${source}`,
  "src",
  "tests",
  "public",
  "scripts",
  "docs",
  ".github",
  ".gitignore",
  "README.md",
  "AGENTS.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "wxt.config.ts",
]);
files.push(source);
writeFileSync(
  "release/SHA256SUMS.txt",
  files
    .sort()
    .map(
      (name) =>
        `${createHash("sha256")
          .update(readFileSync(`release/${name}`))
          .digest("hex")}  ${name}`,
    )
    .join("\n") + "\n",
);
