#!/usr/bin/env node
/*
 * build.js - assembles strike-zero.rbxlx from map.js + src/**.lua
 * Dependency-free (Node stdlib only). Run: node build.js
 *
 * Includes its own verification suite:
 *   - XML well-formedness (balanced tags + entity validation)
 *   - unique, non-reserved referents
 *   - Lua block/delimiter balance for every embedded source
 *   - expected instance tree (script parents) assertions
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_FILE = path.join(ROOT, "strike-zero.rbxlx");

/* ------------------------------------------------------------------ */
/* XML helpers                                                         */
/* ------------------------------------------------------------------ */

let refCounter = 0;
const seenReferents = new Set();

function nextReferent() {
  const r = "RBX" + refCounter++;
  if (seenReferents.has(r)) throw new Error("referent collision: " + r);
  seenReferents.add(r);
  return r;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Color3uint8 packs FF_RR_GG_BB (spec example: 96,64,32 -> 4284497952)
function color3uint8([r, g, b]) {
  return ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0);
}

// Single-axis rotation only (validated): returns [R00..R22]
function rotMatrix(rot) {
  if (!rot) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const axes = rot.filter((v) => v !== 0 && v !== undefined);
  if (axes.length > 1) {
    throw new Error("map rotation must use a single axis, got: " + JSON.stringify(rot));
  }
  const [rx, ry, rz] = rot;
  if (rx) {
    const a = (rx * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, c, -s, 0, s, c];
  }
  if (ry) {
    const a = (ry * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  }
  if (rz) {
    const a = (rz * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

// property element builders (name attr drives Roblox reflection)
const P = {
  string: (n, v) => `<string name="${n}">${esc(v)}</string>`,
  bool: (n, v) => `<bool name="${n}">${v ? "true" : "false"}</bool>`,
  float: (n, v) => `<float name="${n}">${v}</float>`,
  int: (n, v) => `<int name="${n}">${v}</int>`,
  token: (n, v) => `<token name="${n}">${v}</token>`,
  color: (rgb) =>
    `<Color3uint8 name="Color3uint8">${color3uint8(rgb)}</Color3uint8>` +
    `<Color3uint8 name="Color">${color3uint8(rgb)}</Color3uint8>`,
  vector3: (n, [x, y, z]) => `<Vector3 name="${n}"><X>${x}</X><Y>${y}</Y><Z>${z}</Z></Vector3>`,
  cframe: ([x, y, z], m) =>
    `<CoordinateFrame name="CFrame">` +
    `<X>${x}</X><Y>${y}</Y><Z>${z}</Z>` +
    `<R00>${m[0]}</R00><R01>${m[1]}</R01><R02>${m[2]}</R02>` +
    `<R10>${m[3]}</R10><R11>${m[4]}</R11><R12>${m[5]}</R12>` +
    `<R20>${m[6]}</R20><R21>${m[7]}</R21><R22>${m[8]}</R22>` +
    `</CoordinateFrame>`,
  source: (lua) => `<string name="Source">${esc(lua)}</string>`,
};

// Item node: { class, props: string[], children: Item[] }
function Item(cls, props, children = []) {
  return { class: cls, props, children };
}

function serialize(item, depth) {
  const pad = "  ".repeat(depth);
  const ref = nextReferent();
  let out = `${pad}<Item class="${item.class}" referent="${ref}">\n`;
  out += `${pad}  <Properties>\n`;
  for (const p of item.props) out += `${pad}    ${p}\n`;
  out += `${pad}  </Properties>\n`;
  for (const c of item.children) out += serialize(c, depth + 1) + "\n";
  out += `${pad}</Item>`;
  return out;
}

/* ------------------------------------------------------------------ */
/* Lua sanity analyzer                                                 */
/* ------------------------------------------------------------------ */
// Strips strings/comments (line-accurate) then checks:
//   - balanced () {} []
//   - balanced block keywords: function/if/do/repeat ... end/until
// Good enough to catch truncation, swapped keywords, unclosed functions.

function stripLua(src, errors) {
  let out = "";
  let i = 0, line = 1;
  const n = src.length;
  const blank = (from, to) => {
    // replace with spaces, keeping newlines so line numbers stay accurate
    for (let k = from; k < to && k < n; k++) {
      if (src[k] === "\n") { line++; out += "\n"; }
      else out += " ";
    }
  };
  const longAt = (str, start) => {
    if (str[start] !== "[") return -1;
    let j = start + 1, eq = 0;
    while (str[j] === "=") { eq++; j++; }
    return str[j] === "[" ? eq : -1;
  };
  const readLong = (start, eq) => {
    const close = "]" + "=".repeat(eq) + "]";
    const idx = src.indexOf(close, start);
    return idx === -1 ? -1 : idx + close.length;
  };

  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);
    if (c2 === "--") {
      const eq = longAt(src, i + 2);
      if (eq !== -1) {
        const end = readLong(i + 3 + eq, eq); // position after the opener
        if (end === -1) { errors.push({ line, msg: "unterminated long comment" }); return out; }
        blank(i, end);
        i = end;
      } else {
        let j = i;
        while (j < n && src[j] !== "\n") j++;
        blank(i, j);
        i = j;
      }
      continue;
    }
    if (c === "[") {
      const eq = longAt(src, i);
      if (eq !== -1) {
        const end = readLong(i + 1 + eq + 1, eq);
        if (end === -1) { errors.push({ line, msg: "unterminated long string" }); return out; }
        blank(i, end);
        i = end;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      const startLine = line;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) { closed = true; j++; break; }
        if (src[j] === "\n") break; // Lua short strings cannot span lines
        j++;
      }
      if (!closed) errors.push({ line: startLine, msg: "unterminated string" });
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "\n") line++;
    out += c;
    i++;
  }
  return out;
}

function analyzeLua(src, fileLabel) {
  const errors = [];
  const code = stripLua(src, errors);

  // tokenize
  const delims = []; // {ch, line}
  const blocks = []; // {kw, line}
  let line = 1;
  let prevSignificant = "";
  let i = 0;
  const n = code.length;
  const pairs = { ")": "(", "]": "[", "}": "{" };

  while (i < n) {
    const c = code[i];
    if (c === "\n") { line++; i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const isField = prevSignificant === "." || prevSignificant === ":";
      if (!isField) {
        if (word === "function" || word === "if" || word === "do") {
          blocks.push({ kw: word, line });
        } else if (word === "repeat") {
          blocks.push({ kw: word, line });
        } else if (word === "end") {
          const top = blocks.pop();
          if (!top || top.kw === "repeat") {
            errors.push({ line, msg: "unexpected 'end'" + (top ? " (open repeat from line " + top.line + " needs 'until')" : "") });
          }
        } else if (word === "until") {
          const top = blocks.pop();
          if (!top || top.kw !== "repeat") {
            errors.push({ line, msg: "'until' without matching 'repeat'" });
          }
        }
      }
      prevSignificant = word;
      i = j;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      delims.push({ ch: c, line });
      prevSignificant = c;
      i++;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      const top = delims.pop();
      if (!top || top.ch !== pairs[c]) {
        errors.push({ line, msg: "mismatched '" + c + "'" });
      }
      prevSignificant = c;
      i++;
      continue;
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }

  for (const d of delims) errors.push({ line: d.line, msg: "unclosed '" + d.ch + "'" });
  for (const b of blocks) errors.push({ line: b.line, msg: "unclosed block '" + b.kw + "' (missing 'end'/until)" });

  return { ok: errors.length === 0, errors, lines: src.split("\n").length };
}

/* ------------------------------------------------------------------ */
/* Source loading                                                      */
/* ------------------------------------------------------------------ */

const MAP = require(path.join(ROOT, "map.js"));

function readLua(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const SOURCES = [
  { rel: "src/shared/Config.lua", name: "Config", parent: ["ReplicatedStorage", "Shared"], cls: "ModuleScript" },
  { rel: "src/shared/WeaponConfig.lua", name: "WeaponConfig", parent: ["ReplicatedStorage", "Shared"], cls: "ModuleScript" },
  { rel: "src/shared/CombatConfig.lua", name: "CombatConfig", parent: ["ReplicatedStorage", "Shared"], cls: "ModuleScript" },
  { rel: "src/shared/Utility.lua", name: "Utility", parent: ["ReplicatedStorage", "Shared"], cls: "ModuleScript" },
  { rel: "src/server/Bootstrap.lua", name: "Bootstrap", parent: ["ServerScriptService"], cls: "Script" },
  { rel: "src/server/PlayerService.lua", name: "PlayerService", parent: ["ServerScriptService", "Services"], cls: "ModuleScript" },
  { rel: "src/server/WeaponService.lua", name: "WeaponService", parent: ["ServerScriptService", "Services"], cls: "ModuleScript" },
  { rel: "src/server/CombatService.lua", name: "CombatService", parent: ["ServerScriptService", "Services"], cls: "ModuleScript" },
  { rel: "src/server/MatchService.lua", name: "MatchService", parent: ["ServerScriptService", "Services"], cls: "ModuleScript" },
  { rel: "src/server/AdminService.lua", name: "AdminService", parent: ["ServerScriptService", "Services"], cls: "ModuleScript" },
  { rel: "src/client/ClientMain.lua", name: "ClientMain", parent: ["StarterPlayer", "StarterPlayerScripts"], cls: "LocalScript" },
  { rel: "src/client/MovementController.lua", name: "MovementController", parent: ["StarterPlayer", "StarterPlayerScripts", "Controllers"], cls: "ModuleScript" },
  { rel: "src/client/WeaponController.lua", name: "WeaponController", parent: ["StarterPlayer", "StarterPlayerScripts", "Controllers"], cls: "ModuleScript" },
  { rel: "src/client/CombatController.lua", name: "CombatController", parent: ["StarterPlayer", "StarterPlayerScripts", "Controllers"], cls: "ModuleScript" },
  { rel: "src/client/UIController.lua", name: "UIController", parent: ["StarterPlayer", "StarterPlayerScripts", "Controllers"], cls: "ModuleScript" },
];

const REMOTES = ["Fire", "Reload", "Switch", "Melee", "Notify"];

function scriptItem(src) {
  return Item(src.cls, [P.string("Name", src.name), P.source(readLua(src.rel))]);
}

function folder(name, children) {
  return Item("Folder", [P.string("Name", name)], children);
}

function mapPart(def) {
  const cls = def.f || "Part";
  const props = [
    P.string("Name", def.n),
    P.cframe(def.p, rotMatrix(def.r)),
    P.vector3("size", def.s),
    P.vector3("Size", def.s), // legacy/canonical alias hedge: both reflect to Size
    P.color(def.c),
    P.bool("Anchored", true),
    P.bool("CanCollide", def.k === false ? false : true),
  ];
  if (def.t !== undefined) props.push(P.float("Transparency", def.t));
  if (def.m) {
    const token = MAP.materials[def.m];
    if (token === undefined) throw new Error("unknown material: " + def.m);
    props.push(P.token("Material", token));
  }
  return Item(cls, props);
}

function buildTree() {
  const byName = (name) => {
    const found = SOURCES.filter((s) => s.name === name);
    if (found.length !== 1) throw new Error("source entry not found: " + name);
    return found[0];
  };
  const sourcesFor = (parentPath) =>
    SOURCES.filter(
      (s) => s.parent.length === parentPath.length && s.parent.every((p, i) => p === parentPath[i])
    );

  const shared = folder("Shared", sourcesFor(["ReplicatedStorage", "Shared"]).map(scriptItem));
  const remotes = folder("Remotes", REMOTES.map((r) => Item("RemoteEvent", [P.string("Name", r)])));
  const services = folder("Services", sourcesFor(["ServerScriptService", "Services"]).map(scriptItem));
  const bootstrap = scriptItem(byName("Bootstrap"));
  const controllers = folder(
    "Controllers",
    sourcesFor(["StarterPlayer", "StarterPlayerScripts", "Controllers"]).map(scriptItem)
  );
  const clientMain = scriptItem(byName("ClientMain"));

  const strikeMap = Item("Model", [P.string("Name", MAP.name)], MAP.parts.map(mapPart));
  const workspaceItem = Item("Workspace", [P.string("Name", "Workspace")], [strikeMap]);
  const lighting = Item("Lighting", [
    P.string("Name", "Lighting"),
    P.float("Brightness", 2),
    P.float("ClockTime", 14),
    P.bool("GlobalShadows", true),
    `<Color3 name="Ambient"><R>0.32</R><G>0.32</G><B>0.36</B></Color3>`,
    `<Color3 name="OutdoorAmbient"><R>0.5</R><G>0.5</G><B>0.55</B></Color3>`,
  ]);

  const repStorage = Item("ReplicatedStorage", [P.string("Name", "ReplicatedStorage")], [shared, remotes]);
  const server = Item("ServerScriptService", [P.string("Name", "ServerScriptService")], [bootstrap, services]);
  const sps = Item("StarterPlayerScripts", [P.string("Name", "StarterPlayerScripts")], [clientMain, controllers]);
  const starterPlayer = Item("StarterPlayer", [P.string("Name", "StarterPlayer")], [sps]);

  // top-level Items that go under the <roblox> root
  return [workspaceItem, lighting, repStorage, server, starterPlayer];
}

/* ------------------------------------------------------------------ */
/* Validations                                                         */
/* ------------------------------------------------------------------ */

function validateWellFormed(xml) {
  const errors = [];
  const stack = [];
  const entityRe = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;
  let i = 0;
  const n = xml.length;

  const checkText = (text, at) => {
    for (let k = 0; k < text.length; k++) {
      if (text[k] === "&") {
        const m = entityRe.exec(text.slice(k));
        if (!m) {
          errors.push("invalid entity near offset " + at + ": " + JSON.stringify(text.slice(k, k + 24)));
          return;
        }
        k += m[0].length - 1;
      }
      if (text[k] === "<") {
        errors.push("raw '<' in text near offset " + at);
        return;
      }
    }
  };

  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      checkText(xml.slice(i), i);
      break;
    }
    checkText(xml.slice(i, lt), i);
    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt);
      if (end === -1) {
        errors.push("unterminated XML declaration");
        break;
      }
      i = end + 2;
      continue;
    }
    const gt = xml.indexOf(">", lt);
    if (gt === -1) {
      errors.push("unterminated tag near offset " + lt);
      break;
    }
    const tag = xml.slice(lt + 1, gt);
    if (tag.startsWith("/")) {
      const name = tag.slice(1).trim();
      const top = stack.pop();
      if (top !== name) {
        errors.push("close </" + name + "> does not match open <" + (top || "nothing") + ">");
      }
    } else if (!tag.endsWith("/")) {
      stack.push(tag.split(/[\s>]/)[0]);
    }
    i = gt + 1;
  }
  if (stack.length) errors.push("unclosed tags at EOF: " + stack.join(", "));
  return errors;
}

function nameOf(item) {
  for (const p of item.props) {
    const m = /<string name="Name">([^<]*)<\/string>/.exec(p);
    if (m) return m[1];
  }
  return null;
}

function childOf(item, name) {
  return item.children.find((c) => nameOf(c) === name);
}

function resolvePath(root, parts) {
  let cur = root;
  for (const p of parts) {
    if (!cur) return null;
    cur = childOf(cur, p);
  }
  return cur;
}

function countItems(item) {
  let n = 1;
  for (const c of item.children) n += countItems(c);
  return n;
}

function assertStructure(topItems, failures) {
  const expect = (cond, msg) => {
    if (!cond) failures.push("structure: " + msg);
  };
  const virtual = { children: topItems };

  for (const s of SOURCES) {
    const node = resolvePath(virtual, [...s.parent, s.name]);
    expect(node, "missing " + [...s.parent, s.name].join("/") );
    if (node) expect(node.class === s.cls, s.name + " has class " + node.class + ", expected " + s.cls);
  }

  const map = resolvePath(virtual, ["Workspace", MAP.name]);
  expect(map && map.class === "Model", "Workspace/" + MAP.name + " model missing");
  if (map) {
    expect(map.children.length === MAP.parts.length, "map part count mismatch");
    expect(map.children.length >= 45, "map looks too small");
  }

  for (const r of REMOTES) {
    const node = resolvePath(virtual, ["ReplicatedStorage", "Remotes", r]);
    expect(node && node.class === "RemoteEvent", "remote missing: " + r);
  }

  const sharedNames = SOURCES.filter((s) => s.parent[1] === "Shared").map((s) => s.name).sort();
  expect(sharedNames.join(",") === "CombatConfig,Config,Utility,WeaponConfig", "shared module set changed");

  const bootstrap = resolvePath(virtual, ["ServerScriptService", "Bootstrap"]);
  expect(bootstrap && bootstrap.class === "Script", "Bootstrap must be a Script (only executable server script)");
  const clientMain = resolvePath(virtual, ["StarterPlayer", "StarterPlayerScripts", "ClientMain"]);
  expect(clientMain && clientMain.class === "LocalScript", "ClientMain must be a LocalScript");
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  console.log("STRIKE//ZERO build");
  const failures = [];

  // 1. Lua sources: block + delimiter balance
  let luaLines = 0;
  for (const s of SOURCES) {
    const src = readLua(s.rel);
    luaLines += src.split("\n").length;
    const res = analyzeLua(src);
    if (!res.ok) {
      for (const e of res.errors) failures.push("lua " + s.rel + ":" + e.line + ": " + e.msg);
    }
  }
  if (!failures.length) {
    console.log("  ok  lua   " + SOURCES.length + " sources, " + luaLines + " lines - block/delimiter balance valid");
  }

  // 2. Serialize
  const topItems = buildTree();
  const body = topItems.map((it) => serialize(it, 1)).join("\n");
  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n' +
    '  <Meta name="ExplicitAutoJoints">true</Meta>\n' +
    body + "\n</roblox>\n";

  // 3. Well-formedness
  const xmlErrors = validateWellFormed(xml);
  const itemCount = topItems.reduce((acc, it) => acc + countItems(it), 0);
  if (xmlErrors.length) {
    for (const e of xmlErrors.slice(0, 10)) failures.push("xml: " + e);
  } else {
    console.log("  ok  xml   well-formed: balanced tags, all entities valid - " + itemCount + " items");
  }

  // 4. Referents unique + non-reserved
  const reserved = seenReferents.has("null");
  if (seenReferents.size !== itemCount || reserved) {
    failures.push(
      "referents: unique=" + seenReferents.size + " items=" + itemCount + " reservedNull=" + reserved
    );
  } else {
    console.log("  ok  refs  " + seenReferents.size + " unique referents, none reserved (null)");
  }

  // 5. Structure (script parents)
  const structErrors = [];
  assertStructure(topItems, structErrors);
  failures.push(...structErrors);
  if (!structErrors.length) {
    console.log(
      "  ok  tree  1 Script + 1 LocalScript + " +
        SOURCES.filter((s) => s.cls === "ModuleScript").length +
        " ModuleScripts in expected parents; " +
        REMOTES.length +
        " remotes; " +
        MAP.parts.length +
        " map parts under Workspace/" + MAP.name
    );
  }

  if (failures.length) {
    console.error("\nBUILD FAILED:");
    for (const f of failures) console.error("  x  " + f);
    process.exit(1);
  }

  fs.writeFileSync(OUT_FILE, xml);
  console.log(
    "  ok  wrote " + path.basename(OUT_FILE) + " (" + (Buffer.byteLength(xml) / 1024).toFixed(1) + " KB)"
  );
}

main();
