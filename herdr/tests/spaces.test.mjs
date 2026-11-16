import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { source, repos, scratch, git, repo, exec, ui } from "./harness.mjs";

function harness(snapshot, { home = "/nohome", active = true, watch } = {}) {
  const { scan: real, repoName } = repos();
  // Worktrees made within the same second have no order by time: the tests that don't set
  // times themselves see them in the order they were found.
  const scan = async (...args) => {
    const found = await real(...args);
    for (const r of found.repos) for (const t of r.trees) t.at = 0;
    return found;
  };
  const moves = [], made = [], overlays = [], storage = new Map(), watched = [];
  const { seen, element } = ui();
  const names = ["View", "div", "svg", "v_flex", "h_flex", "ScrollHandle", "spaces", "machines", "panes", "run", "openOverlay", "exec", "hc", "home", "theme", "shared", "setShared", "watchFolder", "window", "layout", "scan", "repoName", "localStorage"];
  const Spaces = new Function(...names, `${source("polyrepo-spaces")}; return Spaces;`)(
    class {}, element, element, element, element,
    { new: () => ({ scroll_to_item() {} }) },
    () => snapshot, () => [{ name: null, layout: "ready" }], () => [],
    (name, args) => { if (name === "space.move") moves.push(args); else made.push([name, args]); },
    (o) => overlays.push(o), exec, async () => ({ code: 0, stdout: "{}", stderr: "" }), () => home,
    () => new Proxy({}, { get: () => "#000000" }), () => null, () => {},
    watch ?? ((dir) => { watched.push(dir); const p = new Promise(() => {}); p.cancel = () => {}; return p; }),
    () => ({ active }), () => null, scan, repoName,
    { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) ?? null },
  );
  const tasks = [];
  const cx = { timer: { every() {} }, notify() {}, spawn(fn) { tasks.push(fn(cx)); } };
  const view = new Spaces();
  view.refreshMachines = () => {};
  view.init({}, cx);
  // Folder watches never end: wait for the git and repo looks only.
  const settle = async () => { for (let i = 0; i < 4000 && (view.refreshing || view.pending.size); i++) await new Promise((r) => setTimeout(r, 5)); };
  // What the sidebar would do on its timer, until nothing is left to ask.
  const tick = async (now = Date.now()) => { view.checkNew(cx); await settle(); view.checkNew(cx); await settle(); };
  const rows = () => view.ordered().map((r) => r.w ? `${r.tree ? "  " : ""}${r.w.id}${r.repos ? ` [${r.repos} repos]` : ""}${r.under ? " (repo shown)" : ""}`
    : r.ghost ? `  ~${r.ghost.branch ?? "detached"}${r.ghost.repo ? ` @${r.ghost.repo}` : ""}` : `  +${r.more}`);
  return { view, cx, tick, rows, moves, made, overlays, storage, watched, seen, settle };
}

function fixture() {
  const root = scratch("spaces"), box = join(root, "box");
  const app = repo(join(box, "app"));
  git(app, "worktree", "add", "-q", "-b", "feature/x", join(root, "trees", "feature-x"));
  git(app, "worktree", "add", "-q", "-b", "idea", join(root, "trees", "idea"));
  const lib = repo(join(box, "group", "lib"), "trunk");
  git(lib, "worktree", "add", "-q", "-b", "fix", join(root, "trees", "lib-fix"));
  return { root, box, app, lib };
}
const space = (id, folder, extra = {}) => ({ id, folder, name: id, tabs: [], machine: null, ...extra });

test("worktrees of a folder's repos are listed under its space, opened or not", async () => {
  const f = fixture();
  try {
    const spaces = [space("other", f.root), space("box", f.box), space("wt", join(f.root, "trees", "feature-x"))];
    const h = harness(spaces);
    await h.tick();
    assert.deepEqual(h.rows(), [
      "other [2 repos]",        // the folder above holds the same repos: the deepest folder lists their worktrees
      "box [2 repos]",
      "  wt (repo shown)",      // a real space on a worktree of box/app: nested, and it says which repo
      "  ~idea @app",           // not open anywhere: rows that become spaces
      "  ~fix @lib",
    ]);
    assert.deepEqual(h.moves, [], "already in that order");
    // The worktrees of this computer's repos are watched through their .git.
    assert.deepEqual([...h.view.wanted()].sort(), [join(f.app, ".git"), join(f.lib, ".git")]);
    assert.deepEqual(h.watched.sort(), [join(f.app, ".git"), join(f.lib, ".git")]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a worktree space made before its folder's space is moved under it", async () => {
  const f = fixture();
  try {
    const h = harness([space("wt", join(f.root, "trees", "idea")), space("box", f.box)]);
    await h.tick();
    assert.deepEqual(h.rows(), ["box [2 repos]", "  wt (repo shown)", "  ~feature/x @app", "  ~fix @lib"]);
    assert.deepEqual(h.moves, [{ id: "box", index: 1 }]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a space on the repo's main checkout keeps its worktrees; the folder lists the rest", async () => {
  const f = fixture();
  try {
    const h = harness([space("box", f.box), space("app", f.app), space("wt", join(f.root, "trees", "idea"))]);
    await h.tick();
    assert.deepEqual(h.rows(), ["box [2 repos]", "  ~fix @lib", "app", "  wt", "  ~feature/x"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a new worktree appears at the next look, and a removed one goes", async () => {
  const f = fixture();
  try {
    const h = harness([space("box", f.box)]);
    await h.tick();
    assert.deepEqual(h.rows(), ["box [2 repos]", "  ~feature/x @app", "  ~idea @app", "  ~fix @lib"]);
    const key = JSON.stringify([null, f.box]);
    assert.deepEqual(h.view.stale(Date.now()), [], "just looked");
    assert.deepEqual(h.view.stale(Date.now() + 11000), [key], "a folder of repos is looked through again every 10 s");

    git(f.lib, "worktree", "add", "-q", "-b", "agent-made", join(f.root, "trees", "agent"));
    git(f.app, "worktree", "remove", join(f.root, "trees", "idea"));
    repo(join(f.box, "cloned-later"));
    h.view.refreshGit([key], h.cx, false);
    await h.settle();
    assert.deepEqual(h.rows(), ["box [3 repos]", "  ~feature/x @app", "  ~agent-made @lib", "  ~fix @lib"]);
    assert.ok(h.view.wanted().has(join(f.box, "cloned-later", ".git")), "the repo cloned in is watched too");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("clicking an unopened worktree makes its space once", async () => {
  const f = fixture();
  try {
    const h = harness([space("box", f.box)]);
    await h.tick();
    h.view.render();
    const id = `tree-${JSON.stringify([null, join(f.root, "trees", "idea")])}`;
    const click = h.seen.handlers[id].on_click;
    click({}, h.cx);
    click({}, h.cx);
    assert.deepEqual(h.made, [["space.new", { folder: join(f.root, "trees", "idea"), machine: "" }]]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("many unopened worktrees fold behind a row, per space", async () => {
  const root = scratch("many");
  try {
    const app = repo(join(root, "app"));
    for (let i = 1; i <= 9; i++) git(app, "worktree", "add", "-q", "-b", `b${i}`, join(root, "trees", `b${i}`));
    const h = harness([space("app", app)]);
    await h.tick();
    assert.deepEqual(h.rows(), ["app", "  ~b1", "  ~b2", "  ~b3", "  ~b4", "  ~b5", "  +4"]);
    h.view.render();
    h.seen.handlers["trees-more-app"].on_click({}, h.cx);
    assert.equal(h.rows().length, 11, "all nine, and the row to show fewer");
    assert.equal(h.rows().at(-1), "  +0");
    assert.equal(h.storage.get("spaces.more"), '["app"]');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("home, a plain folder and a linked worktree hold nothing; other places are left alone", async () => {
  const f = fixture();
  try {
    mkdirSync(join(f.root, "plain"));
    const h = harness([space("home", f.root), space("plain", join(f.root, "plain")), space("wt", join(f.root, "trees", "idea"))], { home: f.root });
    await h.tick();
    const key = (p) => JSON.stringify([null, p]);
    assert.equal(h.view.holds(key(f.root)), false, "home is never walked");
    assert.equal(h.view.holds(key(join(f.root, "trees", "idea"))), false);
    assert.deepEqual(h.view.held[key(join(f.root, "plain"))], []);
    assert.deepEqual(h.rows(), ["home", "plain", "wt"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("unopened worktrees are listed most recently used first, across a folder's repos", async () => {
  const f = fixture();
  try {
    const h = harness([space("box", f.box)]);
    await h.tick();
    const key = JSON.stringify([null, f.box]);
    // Three worktrees, used at different times, whichever repo they belong to.
    const at = { "feature/x": 100, idea: 300, fix: 200 };
    for (const r of h.view.held[key]) for (const t of r.trees) t.at = at[t.branch];
    assert.deepEqual(h.rows(), ["box [2 repos]", "  ~idea @app", "  ~fix @lib", "  ~feature/x @app"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
