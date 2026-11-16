// The Files clone's marks, the space menu's worktree items and the repo picker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { source, repos, scratch, git, repo, exec, ui, MODS } from "./harness.mjs";

const BUILD = join(MODS, "polyrepo-worktree-pick", "main.js");
const theme = () => new Proxy({}, { get: () => "#000000" });
const strip = (text) => text.replace(/^import [^;]*;\n/gm, "").replace(/^export default class /m, "class ").replace(/^export /gm, "");

function fixture() {
  const root = scratch("rest"), box = join(root, "box");
  const app = repo(join(box, "app"));
  writeFileSync(join(app, "README"), "changed\n");
  mkdirSync(join(app, "src"));
  writeFileSync(join(app, "src", "new.rs"), "fn main() {}\n");
  const lib = repo(join(box, "lib"));
  git(lib, "worktree", "add", "-q", "-b", "side", join(root, "side"));
  mkdirSync(join(box, "notes"));
  writeFileSync(join(box, "notes", "todo.md"), "x\n");
  return { root, box, app, lib };
}

function files(cwd) {
  const { scan } = repos();
  const { seen, element } = ui();
  const names = ["View", "div", "svg", "v_flex", "h_flex", "Editor", "EditorState", "spaces", "panes", "focused", "exec", "readTextFile", "watchFolder", "theme", "settings", "window", "scan"];
  const Files = new Function(...names, `${source("polyrepo-files")}; return Files;`)(
    class {}, element, element, element, element, { new: element }, { new: () => ({ release() {} }) },
    () => [{ id: "s", active: true, folder: cwd, machine: null }], () => [{ pane: "p", cwd }], () => ({ pane: "p" }),
    exec, async (path) => readFileSync(path, "utf8"), () => new Promise(() => {}), theme, () => ({}), () => ({ platform: "macos" }), scan,
  );
  const cx = { timer: { every() {} }, notify() {}, spawn(fn) { fn(cx); } };
  const view = new Files();
  view.init({}, cx);
  const settle = async () => { for (let i = 0; i < 4000 && view.loading; i++) await new Promise((r) => setTimeout(r, 5)); };
  return { view, cx, settle, seen };
}

test("Files marks the changed files of every repo in a folder of them", async () => {
  const f = fixture();
  try {
    const h = files(f.box);
    await h.settle();
    assert.deepEqual(h.view.marks, { [`${f.box}/app/README`]: "M", [`${f.box}/app/src/new.rs`]: "A" });
    assert.deepEqual(h.view.changed, { [`${f.box}/app`]: 2 }, "the repo's folder says how many");
    assert.deepEqual(h.view.entries.get("").map((e) => e.name), ["app", "lib", "notes"]);
    h.view.toggle("app", h.cx);
    await new Promise((r) => setTimeout(r, 100));
    h.view.render(h.cx);
    assert.ok(h.seen.text.includes("M") && h.seen.text.includes("2"), "the marks are drawn");
    // Inside one repo: that repo's marks, as shipped.
    const one = files(f.app);
    await one.settle();
    assert.deepEqual(one.view.marks, { [`${f.app}/README`]: "M", [`${f.app}/src/new.rs`]: "A" });
    assert.deepEqual(one.view.changed, {});
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

function menu(space, panes = []) {
  const { scan } = repos();
  const { seen, element } = ui();
  const opened = [], ran = [];
  const names = ["View", "div", "svg", "v_flex", "h_flex", "run", "props", "closeOverlay", "openOverlay", "theme", "keys", "terminals", "spaces", "panes", "exec", "scan"];
  const Menu = new Function(...names, `${source("polyrepo-menu")}; return Menu;`)(
    class {}, element, element, element, element, (...a) => ran.push(a), () => ({ tab: "space", target: { id: space.id }, overlay: "o1" }), () => {}, (o) => opened.push(o),
    theme, () => [], () => [], () => [space], () => panes, exec, scan,
  );
  const tasks = [];
  const cx = { notify() {}, focus_handle: () => ({ focus() {} }), spawn(fn) { tasks.push(fn(cx)); } };
  const view = new Menu();
  view.init({}, cx);
  return { view, cx, opened, ran, seen, settle: () => Promise.all(tasks) };
}

test("the space menu offers worktrees for a folder of repos, through the repo picker", async () => {
  const f = fixture();
  try {
    const h = menu({ id: "s", folder: f.box, machine: null, tabs: [] });
    await h.settle();
    assert.equal(h.view.git, "folder");
    h.view.render(h.cx);
    assert.deepEqual(h.seen.text.filter((x) => /worktree/i.test(x)), ["New worktree", "Open worktree"]);
    h.view.choose(1, h.cx);
    assert.equal(h.opened[0].mod, "polyrepo-worktree-pick");
    assert.deepEqual(h.opened[0].props, { space: "s", action: "new" });

    const inRepo = menu({ id: "s", folder: f.app, machine: null, tabs: [] });
    await inRepo.settle();
    assert.equal(inRepo.view.git, "main");
    inRepo.view.choose(1, inRepo.cx);
    assert.equal(inRepo.opened[0].mod, "worktree", "a repo's own space goes straight to the dialog");

    const plain = menu({ id: "s", folder: join(f.box, "notes"), machine: null, tabs: [] });
    await plain.settle();
    assert.equal(plain.view.git, null, "a folder without repos gets no worktree items");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

function picker(p, space) {
  const { scan, repoName } = repos();
  const { seen, element } = ui();
  const opened = [], closed = [];
  const names = ["View", "div", "v_flex", "h_flex", "InputState", "Input", "Scrollbar", "props", "closeOverlay", "openOverlay", "theme", "spaces", "panes", "exec", "home", "checking", "scan", "repoName"];
  const Pick = new Function(...names, `${strip(readFileSync(BUILD, "utf8"))}; return WorktreePick;`)(
    class {}, element, element, element,
    { new: () => ({ on() {}, value: () => "", focus() {} }) }, { new: element }, { vertical: element },
    () => ({ ...p, overlay: "o1" }), (id) => closed.push(id), (o) => opened.push(o), theme, () => [space], () => [], exec, () => "/nohome", () => false, scan, repoName,
  );
  const tasks = [];
  const cx = { notify() {}, stop_propagation() {}, timer: { after() {} }, focus_handle: () => ({ focus() {} }), spawn(fn) { tasks.push(fn(cx)); } };
  const view = new Pick();
  view.init({}, cx);
  return { view, cx, opened, closed, seen, settle: () => Promise.all(tasks) };
}

test("the picker lists a folder's repos once each and hands the chosen one to the worktree dialog", async () => {
  const f = fixture();
  try {
    // A linked worktree of lib inside the folder is the same repo: one row.
    git(f.lib, "worktree", "add", "-q", "-b", "inside", join(f.box, "lib-inside"));
    const space = { id: "s", folder: f.box, machine: null, tabs: [], active: true };
    const h = picker({ space: "s", action: "open" }, space);
    await h.settle();
    assert.deepEqual(h.view.repos.map((r) => [r.name, r.trees]), [["app", 0], ["lib", 2]]);
    assert.deepEqual(h.opened, [], "two repos: it asks");
    h.view.render();
    assert.ok(h.seen.text.includes("Open worktree: which repository?"));
    assert.ok(h.seen.text.includes("2 worktrees"));
    h.view.key({ key: "down" }, h.cx);
    h.view.key({ key: "enter" }, h.cx);
    assert.deepEqual(h.closed, ["o1"]);
    assert.deepEqual(h.opened, [{ mod: "worktree", kind: "dialog", width: 560, height: 480, props: { action: "open", space: "s", folder: f.lib } }]);

    // Inside a repo, or with one repo in the folder: straight on, nothing asked.
    const direct = picker({ space: "s", folder: join(f.app, "src"), action: "new" }, space);
    await direct.settle();
    assert.deepEqual(direct.opened, [{ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { action: "new", space: "s", folder: join(f.app, "src") } }]);
    // Opened on its own (a key, mod.open): the shown space, a new worktree.
    const bare = picker({}, { ...space, folder: f.app });
    await bare.settle();
    assert.deepEqual(bare.opened[0].props, { action: "new", space: "s", folder: f.app });
    // A folder holding nothing says so.
    const none = picker({ space: "s", action: "new" }, { ...space, folder: join(f.box, "notes") });
    await none.settle();
    none.view.render();
    assert.ok(none.seen.text.some((x) => x.endsWith("is not in a git repository, and holds none.")));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("every copy of repos.js is the same file, and the + menu and tab bar point at the clones", () => {
  const one = readFileSync(join(MODS, "polyrepo-spaces", "repos.js"), "utf8");
  for (const mod of ["polyrepo-changes", "polyrepo-files", "polyrepo-menu", "polyrepo-worktree-pick"]) assert.equal(readFileSync(join(MODS, mod, "repos.js"), "utf8"), one, mod);
  const plus = readFileSync(join(MODS, "polyrepo-new-menu", "main.js"), "utf8");
  assert.equal(plus.match(/mod: "polyrepo-worktree-pick"/g).length, 2);
  assert.equal(plus.match(/mod: "worktree"/g), null);
  assert.ok(readFileSync(join(MODS, "polyrepo-tabs", "main.js"), "utf8").includes('mod: "polyrepo-new-menu"'));
  assert.ok(readFileSync(join(MODS, "polyrepo-spaces", "main.js"), "utf8").includes('mod: "polyrepo-menu"'));
});
