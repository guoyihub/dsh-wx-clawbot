import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import YAML from "yaml";

const skillDir = path.resolve("skills/wx-clawbot");
const skillFile = path.join(skillDir, "SKILL.md");

test("Agent Skill has portable metadata and local references", async () => {
  const source = await readFile(skillFile, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter");

  const metadata = YAML.parse(match[1]);
  assert.equal(metadata.name, path.basename(skillDir));
  assert.match(metadata.description, /DeepSeek Harness/);
  assert.match(metadata.description, /when|Use for/i);
  assert.deepEqual(metadata.metadata.openclaw.requires.bins, [
    "node",
    "npm",
    "git",
  ]);

  for (const reference of ["setup.md", "commands.md"]) {
    assert.match(source, new RegExp(`references/${reference.replace(".", "\\.")}`));
    const contents = await readFile(
      path.join(skillDir, "references", reference),
      "utf8",
    );
    assert.ok(contents.trim().length > 0);
  }

  assert.match(
    await readFile(path.join(skillDir, "LICENSE"), "utf8"),
    /^MIT No Attribution/,
  );
});
