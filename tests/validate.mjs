// Offline validation for the Full-Chatgipiti-Agents repository.
// No dependencies, no network. Run: node tests/validate.mjs

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
let passes = 0;

function check(name, fn) {
  try {
    const detail = fn();
    passes += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name} — ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function listFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => statSync(join(abs, name)).isFile())
    .map((name) => `${dir}/${name}`)
    .sort();
}

function unquote(value) {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^"(.*)"$/) || trimmed.match(/^'(.*)'$/);
  return quoted ? quoted[1] : trimmed;
}

// ---------------------------------------------------------------------------
// Minimal frontmatter parser for the subset used by these agent files.
// ---------------------------------------------------------------------------
function parseFrontmatter(raw, relPath) {
  const lines = raw.split(/\r?\n/);
  assert(lines[0] === "---", `${relPath}: missing opening frontmatter delimiter`);
  const end = lines.indexOf("---", 1);
  assert(end > 0, `${relPath}: missing closing frontmatter delimiter`);

  const data = { permissions: [] };
  let currentPermission = null;

  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const item = line.match(/^(\s*)-\s+([A-Za-z_]+):\s*(.*)$/);
    const pair = line.match(/^(\s*)([A-Za-z_]+):\s*(.*)$/);

    if (item) {
      currentPermission = { [item[2]]: unquote(item[3]) };
      data.permissions.push(currentPermission);
      continue;
    }
    if (!pair) throw new Error(`${relPath}: unparsable frontmatter line: ${line}`);
    const [, indent, key, value] = pair;
    if (currentPermission && indent.length > 0) {
      currentPermission[key] = unquote(value);
      continue;
    }
    currentPermission = null;
    if (key === "permissions") {
      // Declared as a block list: keep the array we are collecting into.
      if (value !== "") throw new Error(`${relPath}: permissions must be a list`);
      continue;
    }
    data[key] = unquote(value);
  }
  return data;
}

function hasPermission(fm, action, resource, effect) {
  return fm.permissions.some(
    (p) => p.action === action && p.resource === resource && p.effect === effect,
  );
}

// ---------------------------------------------------------------------------
// 1. Repository shape
// ---------------------------------------------------------------------------
const agentFiles = listFiles("agent");
const profileFiles = listFiles("full-chatgipiti-profiles");

check("expected agent definition files exist", () => {
  const expected = ["agent/builder.md", "agent/designer.md", "agent/judge.md", "agent/orchestrator.md"];
  for (const file of expected) assert(agentFiles.includes(file), `missing ${file}`);
  assert(agentFiles.length === expected.length, `unexpected agent files: ${agentFiles.join(", ")}`);
  return `${agentFiles.length} files`;
});

check("expected profile files exist (and only those)", () => {
  const expected = [
    "full-chatgipiti-profiles/FAST.json",
    "full-chatgipiti-profiles/Full-Codex.json",
    "full-chatgipiti-profiles/Opencode-GO.json",
  ];
  for (const file of expected) assert(profileFiles.includes(file), `missing ${file}`);
  assert(profileFiles.length === expected.length, `unexpected profiles: ${profileFiles.join(", ")}`);
  return `${profileFiles.length} profiles`;
});

check("no excluded Slim artifact is shipped", () => {
  const all = [...agentFiles, ...profileFiles];
  const slimNamed = all.filter((file) => /slim/i.test(file));
  assert(slimNamed.length === 0, `excluded file present: ${slimNamed.join(", ")}`);
  return "no file or profile named after the excluded variant";
});

// ---------------------------------------------------------------------------
// 2. Profile JSON validity and roster coherence
// ---------------------------------------------------------------------------
const KNOWN_AGENTS = new Set(["orchestrator", "explore", "builder", "judge", "build", "designer"]);
const profiles = {};

check("every profile is valid JSON with an agents object", () => {
  for (const file of profileFiles) {
    let parsed;
    try {
      parsed = JSON.parse(read(file));
    } catch (error) {
      throw new Error(`${file}: invalid JSON (${error.message})`);
    }
    assert(parsed && typeof parsed === "object", `${file}: root must be an object`);
    assert(parsed.agents && typeof parsed.agents === "object", `${file}: missing "agents" object`);
    assert(Object.keys(parsed.agents).length > 0, `${file}: "agents" is empty`);
    profiles[file] = parsed;
  }
  return `${Object.keys(profiles).length} profiles parsed`;
});

check("every profile entry assigns a model and a variant", () => {
  let entries = 0;
  for (const [file, parsed] of Object.entries(profiles)) {
    for (const [agent, config] of Object.entries(parsed.agents)) {
      entries += 1;
      assert(KNOWN_AGENTS.has(agent), `${file}: unknown agent "${agent}"`);
      assert(typeof config.model === "string" && /^[a-z0-9._-]+\/[A-Za-z0-9._#-]+$/.test(config.model),
        `${file}: agent "${agent}" has an unexpected model identifier`);
      assert(typeof config.variant === "string" && config.variant.length > 0,
        `${file}: agent "${agent}" is missing a variant`);
    }
  }
  return `${entries} agent assignments`;
});

check("roster is consistent: orchestrator everywhere, designer only where declared", () => {
  for (const [file, parsed] of Object.entries(profiles)) {
    assert("orchestrator" in parsed.agents, `${file}: orchestrator missing`);
  }
  const noDesigner = ["full-chatgipiti-profiles/FAST.json", "full-chatgipiti-profiles/Full-Codex.json"];
  for (const file of noDesigner) {
    assert(!("designer" in profiles[file].agents),
      `${file}: designer should be intentionally absent, not assigned`);
  }
  assert("designer" in profiles["full-chatgipiti-profiles/Opencode-GO.json"].agents,
    "Opencode-GO.json: designer assignment expected");
  return "designer absent in 2 profiles by design, present in Opencode-GO";
});

// ---------------------------------------------------------------------------
// 3. Agent frontmatter and preserved permissions
// ---------------------------------------------------------------------------
const agents = {};

check("every agent has complete, parseable frontmatter", () => {
  for (const file of agentFiles) {
    const fm = parseFrontmatter(read(file), file);
    assert(typeof fm.description === "string" && fm.description.length > 0, `${file}: missing description`);
    assert(["primary", "subagent"].includes(fm.mode), `${file}: unexpected mode "${fm.mode}"`);
    assert(typeof fm.model === "string" && /^[a-z0-9._-]+\/[A-Za-z0-9._#-]+$/.test(fm.model),
      `${file}: unexpected model identifier`);
    assert(fm.permissions.length > 0, `${file}: no permissions declared`);
    for (const permission of fm.permissions) {
      assert(["read", "edit", "glob", "shell", "subagent", "webfetch", "websearch", "skill",
        "external_directory", "*"].includes(permission.action), `${file}: unknown permission action`);
      assert(["allow", "deny", "ask"].includes(permission.effect), `${file}: unknown effect`);
      assert(typeof permission.resource === "string" && permission.resource.length > 0,
        `${file}: permission without resource`);
    }
    agents[file] = fm;
  }
  return `${Object.keys(agents).length} agents parsed`;
});

check("orchestrator stays read-only and only delegates to the declared roster", () => {
  const fm = agents["agent/orchestrator.md"];
  assert(fm.mode === "primary", "orchestrator must be a primary agent");
  assert(hasPermission(fm, "edit", "*", "deny"), "orchestrator must deny edits");
  assert(hasPermission(fm, "subagent", "*", "deny"), "orchestrator must deny subagents by default");
  for (const target of ["explore", "builder", "judge", "designer"]) {
    assert(hasPermission(fm, "subagent", target, "allow"), `orchestrator must allow subagent ${target}`);
  }
  return "edit denied, 4 subagents allowed";
});

check("builder cannot delegate", () => {
  const fm = agents["agent/builder.md"];
  assert(fm.mode === "subagent", "builder must be a subagent");
  assert(hasPermission(fm, "subagent", "*", "deny"), "builder must deny subagent delegation");
  return "subagent delegation denied";
});

check("judge remains read-only for files and shell", () => {
  const fm = agents["agent/judge.md"];
  assert(hasPermission(fm, "edit", "*", "deny"), "judge must deny edits");
  assert(hasPermission(fm, "shell", "*", "deny"), "judge must deny shell by default");
  assert(hasPermission(fm, "subagent", "*", "deny"), "judge must deny subagents");
  for (const cmd of ["git status*", "git diff*", "git log*"]) {
    assert(hasPermission(fm, "shell", cmd, "allow"), `judge must allow read-only ${cmd}`);
  }
  return "edits denied, 3 git read commands allowed";
});

check("designer blocks read/edit of env and opencode.json, and cannot delegate", () => {
  const fm = agents["agent/designer.md"];
  assert(hasPermission(fm, "read", "*.env*", "deny"), "designer must deny reading .env");
  assert(hasPermission(fm, "edit", "*.env*", "deny"), "designer must deny editing .env");
  assert(hasPermission(fm, "read", "*opencode.json*", "deny"), "designer must deny reading opencode.json");
  assert(hasPermission(fm, "edit", "*opencode.json*", "deny"), "designer must deny editing opencode.json");
  assert(hasPermission(fm, "subagent", "*", "deny"), "designer must deny subagents");
  return "secrets and global config denied";
});

check("profiles stay within known providers and agree on the designer model", () => {
  const KNOWN_PROVIDERS = new Set(["openai", "opencode-go", "xai"]);
  for (const [file, parsed] of Object.entries(profiles)) {
    for (const [agent, config] of Object.entries(parsed.agents)) {
      const provider = config.model.split("/")[0];
      assert(KNOWN_PROVIDERS.has(provider),
        `${file}: agent "${agent}" uses unexpected provider "${provider}"`);
    }
  }
  // Where a profile assigns designer, it must not silently disagree with the agent file.
  const designerModel = agents["agent/designer.md"].model.split("#")[0];
  for (const [file, parsed] of Object.entries(profiles)) {
    const assigned = parsed.agents.designer;
    if (!assigned) continue;
    assert(assigned.model === designerModel,
      `${file}: designer assigned ${assigned.model}, frontmatter declares ${designerModel}`);
  }
  return "providers known, designer assignment consistent where present";
});

// ---------------------------------------------------------------------------
// 4. Documentation contract
// ---------------------------------------------------------------------------
check("README documents the /team dependency, activation risks and exclusions", () => {
  const readme = read("README.md");
  const required = [
    "https://github.com/Thiago-P05/Team-Profiles",
    "~/.config/opencode/agent/",
    "~/.config/opencode/full-chatgipiti-profiles/",
    "opencode.jsonc",
    "default_agent",
    "respaldo",
    "explore",
    "build",
    "nativos",
    "Linux",
    "OH-MY-OPENCODE-SLIM",
  ];
  for (const needle of required) assert(readme.includes(needle), `README.md: missing "${needle}"`);
  assert(/no (está|incluido)|no incluye/i.test(readme), "README.md must state what is not included");
  return `${required.length} documented anchors`;
});

// ---------------------------------------------------------------------------
// 5. Secret and personal-data sweep over everything that will be published
// ---------------------------------------------------------------------------
const published = ["README.md", "package.json", ...agentFiles, ...profileFiles];

check("no credentials, tokens or auth material in published files", () => {
  const patterns = [
    [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
    [/\bsk-[A-Za-z0-9-_]{16,}/, "API key"],
    [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
    [/\bBearer\s+[A-Za-z0-9._-]{20,}/, "bearer token"],
    [/\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][^"']{8,}["']/i, "inline credential"],
  ];
  const hits = [];
  for (const file of published) {
    const content = read(file);
    for (const [pattern, label] of patterns) {
      if (pattern.test(content)) hits.push(`${file}: ${label}`);
    }
  }
  assert(hits.length === 0, `possible secret material: ${hits.join("; ")}`);
  return `${published.length} files scanned, no credential patterns`;
});

check("no personal identifiers or absolute local paths in published files", () => {
  const patterns = [
    [/[A-Za-z]:\\Users\\[^\\\s]+/i, "absolute Windows user path"],
    [/(^|\s)\/home\/[a-z0-9._-]+/i, "absolute home directory path"],
    [/(^|\s)\/Users\/[A-Za-z0-9._-]+/i, "absolute macOS user path"],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "email address"],
  ];
  const hits = [];
  for (const file of published) {
    const content = read(file);
    for (const [pattern, label] of patterns) {
      const match = content.match(pattern);
      if (match) hits.push(`${file}: ${label}`);
    }
  }
  assert(hits.length === 0, `possible personal data: ${hits.join("; ")}`);
  return "no local user paths or email addresses";
});

check("no reference to the excluded profile or plugin survives", () => {
  const hits = [];
  for (const file of published) {
    const content = read(file);
    // The README is allowed to name the exclusion explicitly, nowhere else.
    if (file === "README.md") continue;
    if (/oh[-_ ]?my[-_ ]?opencode/i.test(content) || /\bslim\b/i.test(content)) {
      hits.push(file);
    }
  }
  assert(hits.length === 0, `excluded references found in: ${hits.join(", ")}`);
  return "only the README documents the exclusion";
});

// ---------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
