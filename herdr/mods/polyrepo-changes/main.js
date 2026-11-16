// Clone of the shipped `changes` (0.1.16) for folders of repos. What differs from it:
// - in a folder outside git, the repos found under it (repos.js) are shown together, each
//   under its own heading, and a commit goes to the repo of the file being looked at;
// - the space's folder (where its first terminal is now, which also names it; else where it
//   was made) stays shown as a whole while another pane is inside one of its repos.
// Inside a single repo it is the shipped panel.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, v_virtual_list } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings } from "herdr";
import { scan } from "./repos.js";

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  // base: the space's own folders, when what is shown is on its machine: where its first
  // terminal is now (what the sidebar calls the space by), then where it was made.
  const tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  const first = panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd;
  const base = space && (space.machine ?? null) === on ? [...new Set([first, space.folder].filter(Boolean))] : [];
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, base };
}
const key = () => JSON.stringify(location());
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
// A folder's repos shown together; past that a pane inside a repo shows its own only.
const MANY = 24;
// Repos read together (three git runs each).
const AT_ONCE = 4;
// Repos whose folder is watched (the app shares 64 watches between all mods); the
// others wait for the 10-second timer.
const WATCHED = 12;

// Text draws a tab as nothing: pad each to the next 4-column stop.
const untab = (text) => text.replace(/[^\t]*\t/g, (s) => s.slice(0, -1).padEnd((s.length - 1) - (s.length - 1) % 4 + 4));

// Numbers each diff line once, so a frame only draws the rows on screen.
function diffRows(lines) {
  let old = 0, next = 0;
  return lines.map((line) => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; return { kind: "@", text: line }; }
    const kind = line[0];
    if (kind === "-") return { kind, number: old++, text: untab(line.slice(1)) || " " };
    if (kind === "+") return { kind, number: next++, text: untab(line.slice(1)) || " " };
    if (kind === " ") { old++; return { kind, number: next++, text: untab(line.slice(1)) || " " }; }
    return { kind: "", text: line };
  });
}

const base = (path) => path.replace(/\/+$/, "").split("/").pop();
const inside = (path, dir) => path === dir || path.startsWith(dir.replace(/\/+$/, "") + "/");
const same = (a, b) => a.root === b.root && a.path === b.path;
const top = (cwd, on) => exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
const outside = (r) => r.code !== 0 && /not a git repository/i.test(r.stderr);

// What to show for a pane in `cwd`: { folder, repos: [{ root, name }], more }.
// folder null: the one repo the pane is in, as the shipped panel shows it. Otherwise
// every repo of a folder of them: the pane's own folder when it is outside git, or the
// first of the space's folders (`bases`) that is outside git with the pane somewhere inside it.
async function roots(cwd, bases, on) {
  const here = await top(cwd, on);
  const root = here.code === 0 ? here.stdout.trim() : null;
  let folder = !root && outside(here) ? cwd : null;
  for (const at of bases) {
    if (at === cwd || !inside(cwd, at)) continue;
    const there = await top(at, on).catch(() => null);
    if (there && outside(there)) { folder = at; break; }
  }
  if (folder) {
    const found = await scan(folder, on).catch(() => null);
    const repos = (found?.repos ?? []).map((r) => ({ root: r.path, name: r.rel }));
    // The pane's own repo, where the look didn't reach it (too deep, or inside another).
    if (repos.length && root && !repos.some((r) => r.root === root)) repos.push({ root, name: inside(root, found.root) ? root.slice(found.root.length + 1) : base(root) });
    // A pane inside one of very many repos shows its own, not the first few of them.
    if (repos.length && !(root && repos.length > MANY)) return { folder: found.root, repos: repos.slice(0, MANY), more: Math.max(0, repos.length - MANY) };
  }
  return { folder: null, repos: root ? [{ root, name: base(root) }] : [], more: 0 };
}

// "## main...origin/main [ahead 1]", "## No commits yet on main", "## HEAD (no branch)".
function branchOf(line) {
  const s = line.slice(3);
  for (const unborn of ["No commits yet on ", "Initial commit on "]) if (s.startsWith(unborn)) return s.slice(unborn.length);
  return s.startsWith("HEAD (no branch)") ? "detached" : s.split("...")[0];
}

// One repo's uncommitted changes: { root, name, branch, hasHead, files, limited, error }.
async function read({ root, name }, on) {
  const repo = { root, name, branch: null, hasHead: false, files: [], limited: false, error: null };
  const git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
  try {
    const status = await git(["status", "--porcelain=v1", "-z", "--branch", "--no-renames", "--untracked-files=all"]);
    if (status.code !== 0) throw new Error(status.stderr);
    const head = await git(["rev-parse", "--verify", "HEAD"]);
    repo.hasHead = head.code === 0;
    const stats = {};
    const results = repo.hasHead ? [await git(["diff", "HEAD", "--numstat", "-z", "--no-renames"])] : [await git(["diff", "--cached", "--numstat", "-z", "--no-renames"]), await git(["diff", "--numstat", "-z", "--no-renames"])];
    for (const result of results) {
      if (result.code !== 0) throw new Error(result.stderr);
      for (const entry of result.stdout.split("\0")) {
        const [a, d, ...parts] = entry.split("\t");
        if (!parts.length) continue;
        const path = parts.join("\t"), old = stats[path] ?? { add: 0, del: 0 };
        stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0), binary: a === "-" };
      }
    }
    const entries = status.stdout.split("\0").filter(Boolean);
    if (entries[0]?.startsWith("## ")) repo.branch = branchOf(entries.shift());
    for (const entry of entries.slice(0, 1000)) {
      const xy = entry.slice(0, 2), path = entry.slice(3), fresh = xy === "??";
      const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
      const s = conflict ? "U" : xy.includes("D") ? "D" : fresh || xy.includes("A") ? "A" : "M";
      const stat = stats[path] ?? { add: 0, del: 0 };
      repo.files.push({ root, path, status: s, fresh, ...stat });
    }
    repo.limited = entries.length > 1000;
  } catch (e) { repo.error = String(e); }
  return repo;
}

export default class Changes extends View {
  init(_props, cx) {
    this.repos = []; this.folder = null; this.more = 0; this.found = null; this.folded = new Set(); this.watching = new Map();
    this.rows = []; this.diffWidth = 0; this.message = ""; this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Commit message" });
    this.input.on("change", (_e, cx) => {
      const hadMessage = Boolean(this.message.trim());
      this.message = this.input.value();
      if (hadMessage !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
  }

  // This computer's repos are watched, the first WATCHED of them: a change in one
  // reads that one again.
  watch(roots, on, cx) {
    const want = new Set(on ? [] : roots.slice(0, WATCHED));
    for (const [root, pending] of this.watching) if (!want.has(root)) { this.watching.delete(root); pending.cancel(); }
    for (const root of want) {
      if (this.watching.has(root)) continue;
      let current = watchFolder(root);
      this.watching.set(root, current);
      cx.spawn(async (cx) => {
        try {
          for (;;) {
            await current;
            if (this.watching.get(root) !== current) return;
            this.refresh(cx, root);
            current = watchFolder(root);
            this.watching.set(root, current);
          }
        } catch { if (this.watching.get(root) === current) this.watching.delete(root); }
      });
    }
  }

  // Every changed file, repo by repo.
  files() {
    return this.repos.flatMap((r) => r.files);
  }

  // The repo a commit goes to: the one whose file is being looked at, else the first
  // with changes. A single repo is always it.
  target() {
    return this.repos.find((r) => r.root === this.open?.root) ?? this.repos.find((r) => r.files.length) ?? (this.folder ? null : this.repos[0]) ?? null;
  }

  // `only`: a watched repo changed, and it alone is read again.
  refresh(cx, only) {
    if (this.loading || this.busy) return;
    const { cwd, on, base } = location(), context = key();
    if (context !== this.context) {
      this.context = context; this.found = null; this.repos = []; this.folder = null; this.more = 0; this.open = null;
      this.setLines([]); this.message = ""; this.input.set_value(""); this.error = null; this.note = null; this.closed = false;
      this.watch([], null, cx);
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const again = Boolean(only && this.found?.repos.some((r) => r.root === only));
        const found = again ? this.found : await roots(cwd, base, on);
        if (key() !== context) return;
        if (!found.repos.length) { this.found = found; this.repos = []; this.folder = null; this.more = 0; this.setLines([]); this.open = null; this.error = "Not a git repository"; return; }
        const todo = again ? found.repos.filter((r) => r.root === only) : found.repos, fresh = new Map();
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, todo.length) }, async () => {
          while (next < todo.length) { const r = todo[next++]; fresh.set(r.root, await read(r, on)); }
        }));
        if (key() !== context) return;
        const old = new Map(this.repos.map((r) => [r.root, r]));
        this.found = found; this.on = on; this.folder = found.folder; this.more = found.more;
        this.repos = found.repos.map((r) => fresh.get(r.root) ?? old.get(r.root)).filter(Boolean);
        // A single repo's failure is the panel's; in a folder each heading says its own.
        this.error = this.folder ? null : this.repos[0].error;
        this.watch(found.repos.map((r) => r.root), on, cx);
        const files = this.files();
        if (this.open && !files.some((f) => same(f, this.open))) { this.open = null; this.setLines([]); }
        // The first file's diff shows until you pick another.
        if (!this.open && !this.closed && files.length) this.open = { root: files[0].root, path: files[0].path };
        if (this.open) {
          try { await this.load(this.open, context); }
          catch { if (key() === context) this.setLines(["Cannot preview this diff (too large or unreadable)"]); }
        }
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  async load(open, context) {
    const repo = this.repos.find((r) => r.root === open.root), file = repo?.files.find((f) => f.path === open.path), on = this.on;
    if (!file) return;
    let lines;
    if (file.fresh || (!repo.hasHead && file.status === "A")) {
      const text = await readTextFile(`${repo.root}/${file.path}`, { on }).catch(() => null);
      if (text === null) lines = ["Cannot preview this file (binary, too large, or unreadable)"];
      else if (text.includes("\0")) lines = ["Binary file · no text diff"];
      else {
        file.add = countLines(text);
        lines = [`@@ -0,0 +1,${file.add} @@`, ...text.slice(0, 400000).replace(/\n$/, "").split("\n").slice(0, 1500).map(l => `+${l}`)];
      }
    } else {
      const r = await exec("git", [...READ, "diff", ...(repo.hasHead ? ["HEAD"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--", file.path], { cwd: repo.root, on });
      if (r.code !== 0) throw new Error(r.stderr);
      const all = r.stdout.replace(/\n$/, "").split("\n"), first = all.findIndex((l) => l.startsWith("@@"));
      lines = first < 0 ? [file.binary ? "Binary file changed" : "No text diff available"] : all.slice(first);
    }
    if (key() === context && this.open && same(this.open, open)) this.setLines(lines.slice(0, 1500).map(line => line.length > 4000 ? line.slice(0, 4000) + "… (line truncated)" : line));
  }

  setLines(lines) {
    this.rows = diffRows(lines);
    this.diffWidth = Math.max(300, ...this.rows.map(row => (row.text.length + 1) * 7 + 50));
  }

  pick(file, cx) {
    const open = { root: file.root, path: file.path };
    this.open = this.open && same(this.open, open) ? null : open; this.setLines([]); this.note = null;
    this.closed = !this.open;
    const context = this.context;
    if (this.open) cx.spawn(async (cx) => {
      try { await this.load(open, context); }
      catch (e) { if (key() === context && this.open && same(this.open, open)) this.note = `Cannot preview this diff (too large or unreadable): ${e}`; }
      cx.notify();
    });
    cx.notify();
  }

  commit(cx) {
    const repo = this.target();
    if (!this.message.trim() || !repo || this.busy || this.loading || this.context !== key()) return;
    const root = repo.root, on = this.on, context = this.context, message = this.message.trim();
    this.busy = true; this.note = null;
    cx.spawn(async (cx) => {
      try {
        for (const args of [["add", "-A"], ["commit", "-m", message]]) {
          const r = await exec("git", args, { cwd: root, on });
          if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        }
        if (key() === context) { this.message = ""; this.input.set_value(""); }
      } catch (e) { if (key() === context) this.note = `Commit failed: ${e}`; }
      finally { this.busy = false; this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  }

  // The list's rows. A single repo: its files. A folder of repos: a heading per repo
  // with changes (or a failure) and its files unless folded, then the clean ones in a line.
  list() {
    if (!this.folder) return this.files().map((file) => ({ file }));
    const out = [], clean = [];
    for (const repo of this.repos) {
      if (!repo.files.length && !repo.error) { clean.push(repo.name); continue; }
      out.push({ repo });
      if (!this.folded.has(repo.root)) for (const file of repo.files) out.push({ file });
    }
    if (clean.length) out.push({ clean });
    return out;
  }

  diffRow({ kind, number, text }, t) {
    if (kind === "@") return div().w_full().px(12).h(20).flex_none().truncate().bg(t.raised).text_color(t.dim).child(text);
    return h_flex().w_full().h(20).flex_none().gap(10).when(kind === "+", (e) => e.bg(t.ansi2 + "18")).when(kind === "-", (e) => e.bg(t.ansi1 + "18"))
      .child(div().w(30).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
      .child(div().flex_1().min_w(0).truncate().child(text));
  }

  // A repo's heading: folds its files; says its branch and what changed in it.
  headRow(repo, target, t) {
    const folded = this.folded.has(repo.root);
    const add = repo.files.reduce((n, f) => n + f.add, 0), del = repo.files.reduce((n, f) => n + f.del, 0);
    return h_flex().id(`repo-${repo.root}`).h(28).flex_none().px(8).gap(7).items_center().rounded(7).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { folded ? this.folded.delete(repo.root) : this.folded.add(repo.root); cx.notify(); })
      .child(svg(`mods/polyrepo-changes/chevron-${folded ? "right" : "down"}.svg`).size(12).flex_none().text_color(t.dim))
      .child(div().flex_initial().min_w(0).truncate().font_semibold().text_color(repo === target ? t.foreground : t.muted).child(repo.name))
      .when(Boolean(repo.branch), (e) => e.child(div().flex_initial().min_w(0).truncate().text_size(11).text_color(t.dim).child(repo.branch)))
      .child(div().flex_1())
      .when(Boolean(repo.error), (e) => e.child(div().id(`repo-error-${repo.root}`).flex_none().text_size(11).text_color(t.ansi1).tooltip(repo.error ?? "").child("git failed")))
      .when(add > 0, (e) => e.child(div().flex_none().text_size(11).text_color(t.ansi2).child(`+${add}`)))
      .when(del > 0, (e) => e.child(div().flex_none().text_size(11).text_color(t.ansi1).child(`−${del}`)))
      .when(!repo.error, (e) => e.child(div().flex_none().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(String(repo.files.length))));
  }

  fileRow(f, t) {
    const parts = f.path.split("/"), name = parts.pop();
    return h_flex().id(`change-${f.root}/${f.path}`).h(28).flex_none().pl(this.folder ? 27 : 8).pr(8).gap(8).items_center().rounded(7).cursor_pointer().when(Boolean(this.open) && same(this.open, f), (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(f, cx))
      .child(div().w(14).text_size(11).text_color(f.status === "A" ? t.ansi2 : f.status === "D" ? t.ansi1 : f.status === "U" ? t.ansi1 : t.blocked).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(name)))
      .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
  }

  render(cx) {
    if (key() !== this.context) this.refresh(cx);
    const t = theme(), files = this.files(), add = files.reduce((n, f) => n + f.add, 0), del = files.reduce((n, f) => n + f.del, 0);
    const target = this.target(), list = this.list();
    const enabled = Boolean(this.message.trim() && target && !this.busy && !this.loading);
    const chip = (text) => div().flex_none().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(text);
    const limits = [
      this.repos.some((r) => r.limited) ? "Showing the first 1,000 changed files of a repository" : "",
      this.more ? `Showing the first ${MANY} of ${MANY + this.more} repositories` : "",
    ].filter(Boolean).join(" · ");
    return v_flex().id("changes").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(chip(`${files.length} files`))
        .when(Boolean(this.folder), (e) => e.child(chip(`${this.repos.length} ${this.repos.length === 1 ? "repo" : "repos"}`)))
        .child(div().flex_1()).child(div().text_size(11).text_color(t.ansi2).child(`+${add}`)).child(div().text_size(11).text_color(t.ansi1).child(`−${del}`)))
      // overflow_y_scrollbar() wraps the list, so its flex sizing never reached the panel's layout.
      .child(div().flex_1().min_h(44).max_h(list.length * 28 + 12).relative().border_b(1).border_color(t.border)
        .child(v_flex().id("changes-list").absolute().inset_0().overflow_y_scroll().p(6).children(list.map((row) =>
          row.repo ? this.headRow(row.repo, target, t)
            : row.file ? this.fileRow(row.file, t)
            : div().h(28).flex_none().px(8).flex().items_center().text_size(11.5).text_color(t.dim).child(div().min_w(0).truncate().child(`No changes in ${row.clean.join(", ")}`))))
          .when(!list.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : this.repos.length ? "No uncommitted changes" : "No folder")))))
        .child(Scrollbar.vertical("changes-list").absolute().inset_0()))
      .when(Boolean(limits), el => el.child(div().px(12).py(4).text_size(11).text_color(t.dim).child(limits)))
      .child(div().flex_1().min_h(0).relative().font_family(settings().font_family ?? "JetBrains Mono").text_size(11)
        .child(div().id("changes-diff-x").size_full().overflow_x_scrollbar()
          .child(div().w_full().min_w(this.diffWidth).h_full().child(v_virtual_list("changes-diff", this.rows.length, 20, (i) => String(i),
            (range) => this.rows.slice(range.start, range.end).map((row) => this.diffRow(row, t))).size_full())))
        .child(Scrollbar.vertical("changes-diff").viewport_from_layout().absolute().inset_0())
        .when(!this.open && files.length > 0, (e) => e.child(div().absolute().top(6).px(12).text_color(t.dim).child("Select a file to view its changes"))))
      .when(Boolean(this.note), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note)))
      .child(h_flex().flex_none().p(10).gap(8).border_t(1).border_color(t.border)
        .child(div().id("commit-message").flex_1().min_w(0).h(32).px(10).flex().items_center().rounded(8).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)))
        // In a folder of repos the button names the one it commits to.
        .child(div().id("commit").h(32).px(14).max_w(170).flex().flex_none().items_center().rounded(8).bg(enabled ? t.solid : t.raised).text_color(enabled ? t.solid_foreground : t.dim).text_size(12).when(enabled, (e) => e.cursor_pointer()).on_click((_e, cx) => this.commit(cx))
          .child(div().min_w(0).truncate().child(this.busy ? "Committing…" : this.folder && target ? `Commit ${target.name}` : "Commit"))));
  }
}
