import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile("package.json", "utf8"));

test("package declares a discoverable and installable DSH Bundle", async () => {
  assert.ok(manifest.keywords.includes("dsh-plugin"));
  assert.equal(manifest.dsh?.bundle?.patch, "./cordis.patch.yml");
  assert.ok(manifest.files.includes("cordis.patch.yml"));
  assert.ok(manifest.files.includes("docs"));
  assert.ok(manifest.files.includes("skills/wx-clawbot"));
  await access(manifest.dsh.bundle.patch);
});

test("release metadata and separate bilingual docs stay aligned", async () => {
  assert.equal(manifest.version, "0.5.12");
  assert.equal(manifest.name, "dsh-wx-clawbot");
  assert.equal(manifest.bin["wx-clawbot"], "./src/setup.js");
  for (const file of [
    "README.md",
    "docs/README.en.md",
    "docs/COMMANDS.md",
    "docs/COMMANDS.zh.md",
    "docs/ARCHITECTURE.md",
    "docs/ARCHITECTURE.zh.md",
    "SECURITY.md",
    "SECURITY.zh.md",
  ]) await access(file);

  assert.match(await readFile("README.md", "utf8"), /COMMANDS\.zh\.md/);
  assert.match(await readFile("docs/README.en.md", "utf8"), /COMMANDS\.md/);
});

test("official DSH packages remain host-provided peer dependencies", () => {
  const peers = Object.entries(manifest.peerDependencies);
  const dshPeers = peers.filter(([name]) => name.startsWith("@deepseek-ai/dsh-"));

  assert.ok(dshPeers.length > 0);
  for (const [name, range] of dshPeers) {
    assert.notEqual(range, "*", `${name} must declare the tested prerelease line`);
    assert.match(range, />=0\.1\.0-rc\.8/);
    assert.match(range, />=0\.1\.1-rc\.1/);
    assert.equal(manifest.dependencies?.[name], undefined);
  }
});
