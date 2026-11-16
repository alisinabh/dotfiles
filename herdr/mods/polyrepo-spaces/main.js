// Clone of the shipped `spaces` (0.1.16) for folders of repos. What differs from it:
// - a space on a folder outside git holds the repos found under it (repos.js): a worktree
//   space nests under it when no space is on that repo's main checkout;
// - every repo's linked worktrees are looked for all the time, and those nobody has open are
//   listed under their space as rows that become a space when clicked;
// - the space menu is `polyrepo-menu`.
//
// Workspace spaces: stable colored avatars, worktrees under their checkout,
// grouped by machine when more than one is known. After a space's name, the repo
// its first terminal is in now, only where unusual: branch, ahead/behind. Agent state lives in the agents list, not here. Click to
// switch, right-click for its menu, drag to reorder.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, machines, panes, run, openOverlay, exec, hc, home, theme, shared, setShared, watchFolder, window, layout } from "herdr";
import { scan, repoName } from "./repos.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const rowHeight = ({ tree }) => (tree ? 28 : 30);
const RAIL_CELL = 32;
// A space's name and its git tail never shrink below this, so a short one ("api")
// stays readable instead of turning into an ellipsis next to a long branch.
const SIDE_MIN = 48;
const railCell = (el) => h_flex().flex_none().justify_center().child(el);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;
// Places looked at together (two git runs each). All at once, a few hundred spaces
// run out of the app's open files (256 when started from the Dock on macOS) or
// past a machine core's 16 running execs, and those spaces wait for FALLBACK.
const AT_ONCE = 6;
// A folder of repos is looked through again this often while the window is in front
// (one `sh` run, no git): a repo cloned into it, or a worktree in a repo that isn't
// watched, shows up by itself. Another machine's has no watch at all, and is asked less.
const LOOK_EVERY = 10000, LOOK_EVERY_AWAY = 30000;
// How many repos of such folders have their .git watched (the app shares 64 watches
// between all mods); the rest wait for the next look.
const WATCHED = 24;
// Worktrees nobody has open, listed under a space before "N more".
const UNOPENED = 6;

// Both runs, finished: a place isn't done while one of its runs still holds a slot.
async function both(a, b) {
  const done = await Promise.allSettled([a, b]);
  const failed = done.find((d) => d.status === "rejected");
  if (failed) throw failed.reason;
  return done.map((d) => d.value);
}

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Map(); // where()s to look at next -> whether to ask git too
    this.held = {}; // where() -> the repos there and their linked worktrees (repos.js): its own for a main checkout, those under a folder outside git
    this.looked = {}; // where() -> when its repos were last looked for
    this.blind = new Set(); // machines that cannot look (no sh)
    this.opening = {}; // worktree -> when its row was clicked, until its space is there
    try { this.more = new Set(JSON.parse(localStorage.getItem("spaces.more") ?? "[]")); } catch { this.more = new Set(); }
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Map(); // local repos' pending folder watches
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.scroll = ScrollHandle.new(); // the list's position: the active space is brought into view through it
    this.activeAt = -1; // the active space's place among the list's children (headers and rows), -1 when not drawn
    this.machines = [];
    try {
      this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
      if (!this.reconnecting || typeof this.reconnecting !== "object" || Array.isArray(this.reconnecting)) this.reconnecting = {};
      for (const state of Object.values(this.reconnecting)) state.busy = false;
    } catch { this.reconnecting = {}; }
    try { this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]")); } catch { this.folded = new Set(); }
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // Refresh only when the refs could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    const stale = this.stale(now);
    if (stale.length) this.refreshGit(stale, cx, false);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    for (const k of Object.keys(this.git)) if (!keys.has(k)) {
      delete this.git[k];
      delete this.checked[k];
      delete this.held[k];
      delete this.looked[k];
      this.unsure.delete(k);
    }
    const wanted = this.wanted();
    for (const [repo, pending] of this.watching) if (!wanted.has(repo)) {
      this.watching.delete(repo);
      pending.cancel();
    }
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // This computer's repos whose .git is watched: every space's own, then those in
  // folders of repos, up to WATCHED.
  wanted() {
    const out = new Set();
    for (const g of Object.values(this.git)) {
      if (!g) continue;
      const [on, repo] = JSON.parse(g.repo);
      if (!on) out.add(repo);
    }
    let room = WATCHED;
    for (const [key, repos] of Object.entries(this.held)) {
      if (this.git[key] || JSON.parse(key)[0]) continue;
      for (const r of repos) {
        if (!r.common || out.has(r.common)) continue;
        if (room-- <= 0) return out;
        out.add(r.common);
      }
    }
    return out;
  }

  // Whether a place can hold repos to list: a folder outside git (not home: too much
  // to walk) or a repo's main checkout. Not while git couldn't say which it is.
  holds(key) {
    const g = this.git[key];
    if (g === undefined || g?.linked) return false;
    const [on, cwd] = JSON.parse(key);
    if (this.blind.has(on)) return false;
    return g ? true : !this.unsure.has(key) && (on !== null || cwd !== home());
  }

  // Places whose repos are due another look. A main checkout here is not asked: its
  // .git is watched, and its git refresh looks again.
  stale(now) {
    if (!window().active) return [];
    return Object.keys(this.git).filter((k) => {
      const on = JSON.parse(k)[0];
      if (!this.holds(k) || this.folded.has(on) || (this.git[k] && !on)) return false;
      return now - (this.looked[k] ?? 0) > (on ? LOOK_EVERY_AWAY : LOOK_EVERY);
    });
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  // `git` false: only its repos and worktrees are looked for again (no git runs).
  refreshGit(keys, cx, git = true) {
    for (const k of keys) this.pending.set(k, git || this.pending.get(k) === true);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const work = [...this.pending];
        this.pending.clear();
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, work.length) }, async () => {
          while (next < work.length) {
            const [key, git] = work[next++];
            if (git) await this.check(key, cx);
            await this.look(key, cx);
          }
        }));
      }
      this.refreshing = false;
      cx.notify();
    });
  }

  // The repos a place holds and their linked worktrees, read without git.
  async look(key, cx) {
    if (!this.holds(key)) {
      if (this.git[key]?.linked) delete this.held[key];
      return;
    }
    const [on, cwd] = JSON.parse(key);
    this.looked[key] = Date.now();
    try {
      this.held[key] = (await scan(this.git[key]?.top ?? cwd, on)).repos;
    } catch (e) {
      // No sh there (Windows): never asked again. Anything else (the machine is
      // away) keeps what it showed and is asked at the next look.
      if (/cannot start sh|program not found|no such file or directory/i.test(String(e))) this.blind.add(on);
      return;
    }
    if (on) return;
    const wanted = this.wanted();
    for (const r of this.held[key]) if (wanted.has(r.common)) this.watch(r.common, cx);
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // Ref-only reads avoid scanning the worktree or waking its index watch.
      // Two reads: a folder name may itself contain a newline.
      const [r, common] = await both(
        exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel"], { cwd, on }),
        exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on }),
      );
      if (r.code !== 0 || common.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.code !== 0 ? r.stderr : common.stderr)) {
          this.unsure.add(key);
          this.git[key] ??= null;
        } else this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = r.stdout.replace(/\n$/, ""), repo = common.stdout.replace(/\n$/, "");
      const [branch, counts] = await both(
        exec("git", ["symbolic-ref", "-q", "HEAD"], { cwd, on }),
        exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on }),
      );
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
      const info = { name, branch: branch.code === 0 ? branch.stdout.trim().replace(/^refs\/heads\//, "") : "(detached)", ahead, behind, repo: JSON.stringify([on, repo]), linked: repo !== `${top}/.git`, top };
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    const pending = watchFolder(repo);
    this.watching.set(repo, pending);
    cx.spawn(async (cx) => {
      let current = pending;
      try {
        for (;;) {
          await current;
          if (this.watching.get(repo) !== current) return;
          const mine = JSON.stringify([null, repo]);
          const keys = Object.keys(this.git).filter((k) => this.git[k]?.repo === mine);
          // Folders of repos holding it: a worktree was added or removed there.
          const holders = Object.keys(this.held).filter((k) => !this.git[k] && !JSON.parse(k)[0] && this.held[k].some((r) => r.common === repo));
          if (!keys.length && !holders.length) break;
          if (keys.length) this.refreshGit(keys, cx);
          if (holders.length) this.refreshGit(holders, cx, false);
          current = watchFolder(repo);
          this.watching.set(repo, current);
        }
      } catch {}
      if (this.watching.get(repo) === current) this.watching.delete(repo);
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "polyrepo-menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // The rows in order. A space's row is { w, i, g, k, tree, under, repos }; under it come
  // its worktree spaces, then the worktrees nobody has open: { ghost, of } rows, and
  // { more, of } to show the rest of them or fewer.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => {
      const k = where(w, ps);
      return { w, i, k, g: this.git[k] ?? null };
    });
    // The space a repo's worktrees go under: the first one on its main checkout, else
    // the one on the deepest folder holding the repo.
    const owner = new Map(), deep = new Map();
    for (const r of list) if (r.g && !r.g.linked && !owner.has(r.g.repo)) owner.set(r.g.repo, r);
    for (const r of list) {
      if (r.g || !this.held[r.k]) continue;
      const on = r.w.machine ?? null, depth = JSON.parse(r.k)[1].length;
      for (const repo of this.held[r.k]) {
        const key = JSON.stringify([on, repo.common]);
        if (!repo.common || (owner.has(key) && !deep.has(key)) || (deep.get(key) ?? -1) >= depth) continue;
        owner.set(key, r);
        deep.set(key, depth);
      }
    }
    const nested = (r) => r.g?.linked && owner.has(r.g.repo);
    // Checkouts some space is in: not listed again as unopened.
    const open = new Set(list.filter((r) => r.g).map((r) => JSON.stringify([r.w.machine ?? null, r.g.top])));
    for (const id of Object.keys(this.opening)) if (open.has(id) || Date.now() - this.opening[id] > 5000) delete this.opening[id];
    const out = [];
    for (const r of list) {
      if (nested(r)) continue;
      const on = r.w.machine ?? null;
      const folder = !r.g && (this.held[r.k]?.length ?? 0) > 0; // a folder of repos
      // A linked worktree inside the folder is a checkout of a repo already counted.
      out.push({ ...r, tree: null, repos: folder ? new Set(this.held[r.k].map((x) => x.common || x.path)).size : 0 });
      const kids = list.filter((k) => nested(k) && owner.get(k.g.repo) === r);
      for (const k of kids) out.push({ ...k, tree: "├─", under: folder });
      const ghosts = [], seen = new Set();
      for (const repo of this.held[r.k] ?? []) {
        if (owner.get(r.g ? r.g.repo : JSON.stringify([on, repo.common])) !== r) continue;
        for (const tree of repo.trees) {
          const id = JSON.stringify([on, tree.path]);
          if (open.has(id) || seen.has(id)) continue;
          seen.add(id);
          ghosts.push({ ghost: { ...tree, id, on, repo: folder ? repoName(repo.common) : "" }, of: r.w, tree: "├─" });
        }
      }
      // The ones git last wrote in first: a new one is on top, not behind "N more".
      ghosts.sort((a, b) => b.ghost.at - a.ghost.at);
      const all = this.more.has(r.w.id) || ghosts.length <= UNOPENED;
      out.push(...(all ? ghosts : ghosts.slice(0, UNOPENED - 1)));
      if (ghosts.length > UNOPENED) out.push({ more: all ? 0 : ghosts.length - (UNOPENED - 1), of: r.w, tree: "├─" });
    }
    // Simulate the batch so later indexes include earlier moves. An attempted
    // write can lose a sync conflict: allow the echo to settle before retrying.
    const real = out.filter((r) => r.w);
    const order = sp.map(w => w.id);
    const target = real.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < real.length; i++) {
        const from = order.indexOf(real[i].w.id);
        if (from === i) continue;
        run("space.move", { id: real[i].w.id, index: i + 1 });
        moved.add(real[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has((r.w ?? r.of).id));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    // The rail has room for spaces only.
    const rows = this.ordered().filter((r) => r.w || !collapsed);
    const draw = (r) => (collapsed ? this.compact(r, t) : r.w ? this.row(r, t) : this.ghost(r, t));
    // Where the active space's row lands among the children this returns: the list scrolls by its direct
    // children, and machine headers, login notes and loading rows count too.
    this.activeAt = -1;
    let before = 0;
    const remote = [...new Set([...rows.map(r => (r.w ?? r.of).machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => h_flex().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).items_center().when(collapsed, el => el.justify_center()).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) {
      if (loading(null) && !rows.length) return [loadingRow(null)];
      this.activeAt = rows.findIndex(r => r.w?.active);
      return rows.map(draw);
    }
    const machineNames = [null, ...remote];
    return machineNames.flatMap((m) => {
      const mine = rows.filter((r) => ((r.w ?? r.of).machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const login = machine?.state === "needs_login" ? `hc machine login ${m}` : null;
      const folded = this.folded.has(m);
      const icon = svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none();
      const badge = div().absolute().right(-3).bottom(-2).size(6).rounded(3).border_1().border_color(t.chrome).bg(connected ? t.ansi2 : t.dim);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(26).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .when(collapsed, el => el.mt(4).w(RAIL_CELL).justify_center().rounded(6).tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? "connected" : (machine?.state ?? "asleep").replace(/_/g, " ")}` : "This computer"))
        .cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          if (collapsed && login) { run("app.settings", { section: "machines" }); return; }
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .when(machine?.keeps_running_after_logout === false, el => el.child(div().id(`machine-logout-${m}`)
          .flex_none().text_color(t.blocked).tooltip("Agents stop when you disconnect. Click for the fix.")
          .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "machine-add", kind: "dialog", width: 560 }); }).child("⚠")))
        .when(!collapsed, el => el.child(icon))
        .when(collapsed, el => el.child(div().relative().flex_none().child(icon).when(Boolean(m), el => el.child(badge))))
        .when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? "This computer"))
          .when(!connected && !rebuilt && !login, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
            .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect"))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => run("space.new", { machine: m ?? "" }))
        .when(collapsed, el => el.w(RAIL_CELL).rounded(6).justify_center().tooltip(`New space on ${m ?? "this computer"}`)
          .child(h_flex().size(18).rounded(5).border_1().border_color(t.dim).items_center().justify_center()
            .child(svg("mods/workspace-chrome/plus.svg").size(10))))
        .when(!collapsed, el => el.child(svg("mods/workspace-chrome/plus.svg").size(12)).child("New space there"));
      if (!collapsed && rebuilt) { before += 1; return [head]; }
      const cell = collapsed ? railCell : (el) => el;
      const guidance = !collapsed && login ? [v_flex().px(8).pb(6).gap(3).flex_none()
        .child(div().text_size(11).text_color(t.blocked).child("needs a login: run"))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1().min_w(0).truncate().tooltip(login).text_size(11).text_color(t.muted).child(login))
          .child(div().id(`machine-login-copy-${m}`).flex_none().px(5).py(2).rounded(4)
            .text_size(11).text_color(t.foreground).bg(t.raised).cursor_pointer().hover(s => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); this.copiedLogin = login; cx.notify(); })
            .child(this.copiedLogin === login ? "Copied" : "Copy")))] : [];
      const items = [cell(head), ...guidance, ...(folded ? [] : mine.length ? mine.map(draw) : [loading(m) ? loadingRow(m) : cell(empty)])];
      const first = folded ? -1 : mine.findIndex(r => r.w?.active);
      if (first >= 0) this.activeAt = before + 1 + guidance.length + first;
      before += items.length;
      return items;
    });
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one. When the row is full, it
  // and the name both start from their text's width and give way in proportion.
  // `tree`: nested under its own repo's space (under a folder of repos the repo is said).
  gitTail(g, tree, name, t) {
    const raw = g.branch ?? "detached";
    const same = (a) => a.toLowerCase() === name.toLowerCase();
    const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
    const repo = tree || same(g.name) ? "" : g.name;
    const where = [repo, branch].filter(Boolean).join(" \u00b7 ");
    return h_flex()
      .flex_auto()
      .min_w(where ? SIDE_MIN : 0)
      .gap(5)
      .justify_end()
      .items_center()
      .text_size(11.5)
      .text_color(t.dim)
      .when(Boolean(where), (el) => el.child(div().min_w(0).truncate().child(where)))
      .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
      .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`)));
  }

  row({ w, i, g, tree, under, repos }, t) {
    const on = w.active;
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .h(rowHeight({ tree }))
      .flex_none()
      .justify_center()
      .rounded(8)
      .when(on, (el) => el.bg(t.selected))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, line => line.bottom(0))
          .when(fromIndex > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex()
          .gap(9)
          .items_center()
          .when(Boolean(tree), el => el.pl(22).child(svg("mods/workspace-chrome/branch.svg").size(13).flex_none().text_color(t.dim)))
          .when(!tree, el => el.child(h_flex().size(18).flex_none().rounded(5).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...w.name][0]?.toUpperCase() ?? "?")))
          .child(div().flex_initial().min_w(SIDE_MIN).truncate().text_color(t.foreground).child(w.name))
          .child(g ? this.gitTail(g, tree && !under, w.name, t)
            : repos ? div().flex_auto().min_w(0).truncate().text_right().text_size(11.5).text_color(t.dim).child(`${repos} ${repos === 1 ? "repo" : "repos"}`)
            : div().flex_1()),
      );
  }

  // A worktree nobody has open, drawn like a worktree space but quieter: a click makes
  // its space, which then takes this row's place. Or the row that shows more of them.
  ghost({ ghost: c, more, of }, t) {
    const shell = (id) => v_flex().id(id).px(8).h(rowHeight({ tree: true })).flex_none().justify_center().rounded(8).hover((s) => s.bg(t.hover));
    if (!c) {
      return shell(`trees-more-${of.id}`)
        .on_click((_e, cx) => {
          this.more.has(of.id) ? this.more.delete(of.id) : this.more.add(of.id);
          localStorage.setItem("spaces.more", JSON.stringify([...this.more]));
          cx.notify();
        })
        .child(div().pl(44).text_size(11.5).text_color(t.dim).child(more ? `${more} more worktrees` : "Show fewer"));
    }
    const name = c.branch ?? base(c.path);
    const s = c.at ? Date.now() / 1000 - c.at : 0;
    const age = !c.at ? "" : s < 3600 ? `${Math.max(1, Math.round(s / 60))}m` : s < 86400 ? `${Math.round(s / 3600)}h` : s < 86400 * 60 ? `${Math.round(s / 86400)}d` : `${Math.round(s / 86400 / 30)}mo`;
    const tail = [c.repo, c.branch ? "" : "detached"].filter(Boolean).join(" \u00b7 ");
    return shell(`tree-${c.id}`)
      .tooltip(`${c.path} \u00b7 ${age ? `git last wrote there ${age} ago \u00b7 ` : ""}click to open as a space`)
      .on_click((_e, cx) => {
        // Its space takes a moment to show: a second click must not make another.
        if (this.opening[c.id]) return;
        this.opening[c.id] = Date.now();
        run("space.new", { folder: c.path, machine: c.on ?? "" });
        cx.notify();
      })
      .child(
        h_flex()
          .gap(9)
          .items_center()
          .pl(22)
          .child(svg("mods/workspace-chrome/branch.svg").size(13).flex_none().text_color(t.dim))
          .child(div().flex_initial().min_w(SIDE_MIN).truncate().text_color(this.opening[c.id] ? t.dim : t.muted).child(name))
          // The age never gives way: it is what tells a live worktree from a forgotten one.
          .child(h_flex().flex_auto().min_w(tail ? SIDE_MIN : 0).gap(5).justify_end().items_center().text_size(11.5).text_color(t.dim)
            .when(Boolean(tail), (el) => el.child(div().min_w(0).truncate().child(tail)))
            .when(Boolean(age), (el) => el.child(div().flex_none().child(age)))),
      );
  }

  compact({ w, i }, t) {
    return railCell(h_flex()
      .id(`space-${w.id}`)
      .relative()
      .w(RAIL_CELL)
      .h(26)
      .rounded(6)
      .justify_center()
      .items_center()
      .when(w.active, (el) => el.bg(t.selected))
      .when(!w.active, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => run("space.select", { id: w.id }))
      .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
      .child(div().absolute().right(5).text_color(tone(t, w.status)).child(glyph(w.status))));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    const list = this.grouped(t, collapsed);
    // Bring the active space into view when it, or its place in the list, changes; a row already in view stays put.
    const active = sp.find(p => p.active)?.id;
    if (active !== this.revealed || this.activeAt !== this.revealedAt) {
      this.revealed = active;
      this.revealedAt = this.activeAt;
      if (this.activeAt >= 0) this.scroll.scroll_to_item(this.activeAt);
    }
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, el => el.pl(0).pr(0).justify_center())
        .when(!collapsed, el => el.child("Spaces"))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new")).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(14).overflow_y_scrollbar().mode("always").track_scroll(this.scroll)
        // A block above (another mod's) growing, or the window resizing, shrinks this list and can push the active space out.
        .on_size_change((_size, cx) => { if (this.activeAt >= 0) { this.scroll.scroll_to_item(this.activeAt); cx.notify(); } })
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
        .children(list));
  }
}
