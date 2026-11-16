// Tests for the polyrepo mods in ../mods, run outside the app against real scratch repos:
//   cd ~/.dotfiles/herdr/tests && node --test --test-timeout=60000 *.test.mjs
// Sources are loaded the way Herdr's own mod tests do (imports stripped, the host's
// functions passed in). Run them, and `herdr-app check <mod folder>`, after changing a mod
// or re-cloning one from a newer Herdr.
import { readFileSync, mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MODS = join(import.meta.dirname, "..", "mods");

export function source(mod, file = "main.js") {
  return readFileSync(join(MODS, mod, file), "utf8")
    .replace(/^import [^;]*;\n/gm, "")
    .replace(/^export default class /m, "class ")
    .replace(/^export /gm, "");
}

// exec() as mods get it, run for real on this machine.
export const exec = async (command, args = [], { cwd, env } = {}) => {
  const r = spawnSync(command, args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", ...env }, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
};

export function repos(execFn = exec) {
  return new Function("exec", `${source("polyrepo-spaces", "repos.js")}; return { scan, parse, repoName, SCRIPT };`)(execFn);
}

export function scratch(name) {
  return realpathSync(mkdtempSync(join(tmpdir(), `herdr-${name}-`)));
}

export function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" } });
  if (r.status) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

export function repo(path, branch = "main") {
  mkdirSync(path, { recursive: true });
  git(path, "init", "-q", "-b", branch);
  writeFileSync(join(path, "README"), "hello\n");
  git(path, "add", "-A");
  git(path, "commit", "-q", "-m", "base");
  return path;
}

// An element builder that accepts any chain, recording text children and handlers by id.
export function ui() {
  const seen = { text: [], handlers: {}, ids: [] };
  const make = () => {
    let id = null; // the element's own, for finding its handlers
    const el = new Proxy(function () {}, {
      get: (_t, method) => (...args) => {
        const m = String(method);
        if (m === "id") { id = args[0]; seen.ids.push(id); }
        if (m === "child" && typeof args[0] === "string") seen.text.push(args[0]);
        if (m === "children") for (const c of args[0] ?? []) if (typeof c === "string") seen.text.push(c);
        if (m.startsWith("on_")) (seen.handlers[id] ??= {})[m] = args.at(-1);
        if (m === "when") { if (args[0]) args[1](el); return el; }
        return el;
      },
    });
    return el;
  };
  return { seen, element: () => make() };
}
