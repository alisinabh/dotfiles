import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { source, repos, scratch, git, repo, exec, ui } from "./harness.mjs";

// The panel for a pane in `cwd`, in a space made in `folder`.
function harness({ cwd, folder, first }) {
  const calls = [], watches = new Map();
  const counted = async (command, args, options) => { calls.push([command, ...args, options?.cwd ?? ""]); return exec(command, args, options); };
  const { scan } = repos(counted);
  const { seen, element } = ui();
  const state = { cwd };
  const input = { value: "", handlers: {}, on(name, fn) { this.handlers[name] = fn; }, set_value(v) { this.value = v; }, valueOf() { return this.value; } };
  input.value = () => input.text ?? "";
  const names = ["View", "div", "svg", "v_flex", "h_flex", "InputState", "Input", "Scrollbar", "v_virtual_list", "spaces", "panes", "focused", "exec", "readTextFile", "watchFolder", "theme", "settings", "scan"];
  const Changes = new Function(...names, `${source("polyrepo-changes")}; return { Changes, roots, read, branchOf };`)(
    class {}, element, element, element, element,
    { new: () => ({ on(name, fn) { input.handlers[name] = fn; }, set_value(v) { input.text = v; }, value: () => input.text ?? "" }) },
    { new: element }, { vertical: element }, element,
    () => [{ id: "s", active: true, folder, machine: null, tabs: [{ id: "t1" }, { id: "t2" }] }],
    () => [...(first ? [{ pane: "first", tab: "t1", cwd: first }] : []), { pane: "p", tab: "t2", cwd: state.cwd }], () => ({ pane: "p" }),
    counted, async (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } },
    (dir) => { let fire; const p = new Promise((r) => { fire = r; }); p.cancel = () => fire([]); watches.set(dir, () => fire([dir])); return p; },
    () => new Proxy({}, { get: () => "#000000" }), () => ({}), scan,
  );
  const tasks = [];
  const cx = { timer: { every() {} }, notify() {}, focus_handle: () => ({ focus() {} }), spawn(fn) { tasks.push(fn(cx)); } };
  const view = new Changes.Changes();
  view.init({}, cx);
  const settle = async () => { for (let i = 0; i < 4000 && (view.loading || view.busy); i++) await new Promise((r) => setTimeout(r, 5)); await new Promise((r) => setTimeout(r, 5)); };
  const rows = () => view.list().map((r) => r.repo ? `# ${r.repo.name} (${r.repo.branch})${r.repo.error ? " failed" : ""}` : r.file ? `${r.file.status} ${r.file.path} +${r.file.add} -${r.file.del}` : `clean: ${r.clean.join(", ")}`);
  const type = (text) => { input.text = text; input.handlers.change({}, cx); };
  return { view, cx, settle, rows, calls, watches, state, type, seen, fns: Changes };
}

function fixture() {
  const root = scratch("changes"), box = join(root, "box");
  const app = repo(join(box, "app"));
  writeFileSync(join(app, "README"), "hello\nworld\n");
  writeFileSync(join(app, "new.txt"), "one\ntwo\n");
  repo(join(box, "lib"), "trunk");
  const ui = join(box, "group", "ui");
  mkdirSync(ui, { recursive: true });
  git(ui, "init", "-q", "-b", "unborn");
  writeFileSync(join(ui, "first.js"), "x\n");
  git(ui, "add", "first.js");
  return { root, box, app, lib: join(box, "lib"), ui };
}

test("a folder of repos shows each repo's changes under its heading", async () => {
  const f = fixture();
  try {
    const h = harness({ cwd: f.box, folder: f.box });
    await h.settle();
    assert.equal(h.view.folder, f.box);
    assert.deepEqual(h.rows(), [
      "# app (main)", "M README +1 -0", "A new.txt +0 -0",
      "# group/ui (unborn)", "A first.js +1 -0",
      "clean: lib",
    ]);
    assert.equal(h.view.error, null);
    assert.deepEqual(h.view.open, { root: f.app, path: "README" }, "the first file's diff shows");
    assert.deepEqual(h.view.rows.map((r) => `${r.kind}${r.text}`), ["@@@ -1 +1,2 @@", " hello", "+world"]);
    assert.equal(h.view.target().name, "app");
    h.view.render(h.cx);
    assert.ok(h.seen.text.includes("Commit app"), "the button names the repo it commits to");
    assert.ok(h.seen.text.includes("No changes in lib"));
    // Folding a repo hides its files only.
    h.view.folded.add(f.app);
    assert.deepEqual(h.rows(), ["# app (main)", "# group/ui (unborn)", "A first.js +1 -0", "clean: lib"]);
    assert.deepEqual([...h.watches.keys()].sort(), [f.app, f.lib, f.ui].sort(), "every repo is watched");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("after a cd into one repo, the space's folder is still shown as a whole", async () => {
  const f = fixture();
  try {
    const h = harness({ cwd: join(f.lib), folder: f.box });
    await h.settle();
    assert.equal(h.view.folder, f.box);
    assert.equal(h.rows()[0], "# app (main)");
    assert.equal(h.rows().at(-1), "clean: lib");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("inside a single repo it is the shipped panel: no headings, the repo's own files", async () => {
  const f = fixture();
  try {
    const h = harness({ cwd: f.app, folder: f.app });
    await h.settle();
    assert.equal(h.view.folder, null);
    assert.deepEqual(h.rows(), ["M README +1 -0", "A new.txt +0 -0"]);
    assert.equal(h.view.target().root, f.app);
    // A space made at home (never walked) with a pane in a repo: that repo alone.
    const home = harness({ cwd: join(f.app), folder: f.root });
    const { roots } = home.fns;
    assert.deepEqual(await roots(f.app, ["/"], null), { folder: null, repos: [{ root: f.app, name: "app" }], more: 0 });
    // Outside git with no repos under it: nothing, as the shipped panel says.
    mkdirSync(join(f.root, "empty"));
    const none = harness({ cwd: join(f.root, "empty"), folder: join(f.root, "empty") });
    await none.settle();
    assert.equal(none.view.error, "Not a git repository");
    assert.deepEqual(none.rows(), []);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a commit goes to the repo of the file being looked at, and only there", async () => {
  const f = fixture();
  try {
    const h = harness({ cwd: f.box, folder: f.box });
    await h.settle();
    const first = h.view.files().find((x) => x.path === "first.js");
    h.view.pick(first, h.cx);
    await h.settle();
    assert.equal(h.view.target().name, "group/ui");
    assert.deepEqual(h.view.rows.map((r) => `${r.kind}${r.text}`), ["@@@ -0,0 +1,1 @@", "+x"]);
    h.type("first commit");
    // The test repos have no identity of their own.
    for (const r of [f.ui, f.app]) { git(r, "config", "user.name", "Test"); git(r, "config", "user.email", "test@example.com"); }
    h.view.commit(h.cx);
    await h.settle();
    assert.equal(h.view.note, null);
    assert.equal(git(f.ui, "log", "--format=%s"), "first commit");
    assert.equal(git(f.app, "log", "--format=%s"), "base", "the other repo is untouched");
    assert.deepEqual(h.rows(), ["# app (main)", "M README +1 -0", "A new.txt +0 -0", "clean: group/ui, lib"]);
    assert.equal(h.view.target().name, "app", "then the next repo with changes");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a change in one watched repo reads that repo again, not the others", async () => {
  const f = fixture();
  try {
    const h = harness({ cwd: f.box, folder: f.box });
    await h.settle();
    h.calls.length = 0;
    writeFileSync(join(f.lib, "added.md"), "# hi\n");
    h.watches.get(f.lib)();
    await new Promise((r) => setTimeout(r, 20));
    await h.settle();
    assert.deepEqual(h.rows().slice(-2), ["# lib (trunk)", "A added.md +0 -0"]);
    const touched = new Set(h.calls.filter((c) => c[0] === "git").map((c) => c.at(-1)));
    assert.deepEqual([...touched].sort(), [f.app, f.lib].sort(), "lib was read; app only for the open file's diff");
    assert.equal(h.calls.filter((c) => c[0] === "git" && c.includes("status")).length, 1);
    assert.equal(h.calls.filter((c) => c[0] === "sh").length, 0, "no new look for repos");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a pane inside one of very many repos shows its own", async () => {
  const root = scratch("many");
  try {
    for (let i = 0; i < 26; i++) { const r = join(root, "box", `r${String(i).padStart(2, "0")}`); mkdirSync(r, { recursive: true }); git(r, "init", "-q"); }
    const h = harness({ cwd: join(root, "box", "r03"), folder: join(root, "box") });
    const { roots } = h.fns;
    assert.equal((await roots(join(root, "box", "r03"), [join(root, "box")], null)).folder, null);
    const whole = await roots(join(root, "box"), [join(root, "box")], null);
    assert.equal(whole.repos.length, 24);
    assert.equal(whole.more, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("branch names from git's status heading", () => {
  const { branchOf } = harness({ cwd: "/", folder: "/" }).fns;
  assert.equal(branchOf("## main...origin/main [ahead 1, behind 2]"), "main");
  assert.equal(branchOf("## feature/x"), "feature/x");
  assert.equal(branchOf("## No commits yet on trunk"), "trunk");
  assert.equal(branchOf("## HEAD (no branch)"), "detached");
});

test("a space made elsewhere and moved by cd is shown by where its first terminal is now", async () => {
  const f = fixture();
  try {
    // Made in an unrelated repo; its first terminal sits in the folder of repos; the
    // focused pane is inside one of them.
    const elsewhere = repo(join(f.root, "elsewhere"));
    const h = harness({ cwd: f.lib, folder: elsewhere, first: f.box });
    await h.settle();
    assert.equal(h.view.folder, f.box);
    assert.deepEqual(h.rows().filter((r) => r.startsWith("#") || r.startsWith("clean")), ["# app (main)", "# group/ui (unborn)", "clean: lib"]);
    // The first terminal itself inside one repo: the space is on that repo now.
    const moved = harness({ cwd: f.app, folder: elsewhere, first: f.app });
    await moved.settle();
    assert.equal(moved.view.folder, null);
    assert.deepEqual(moved.rows(), ["M README +1 -0", "A new.txt +0 -0"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
