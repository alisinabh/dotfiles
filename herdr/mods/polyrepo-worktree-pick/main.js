// Which repo? Asked in front of the shipped `worktree` dialog when a space's folder is not
// a repo but holds some (repos.js). Opened as a dialog with the props that dialog takes:
// { space, folder?, action: "new" | "open", tab?, argv?, branch? }. A folder inside git, or
// one holding a single repo, goes straight on to it. Opened by `polyrepo-menu` and `polyrepo-new-menu`;
// on its own (`mod.open {name: "polyrepo-worktree-pick"}`, so a key can open it) it is New worktree
// for the shown space.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar } from "gpui-base";
import { props, closeOverlay, openOverlay, theme, spaces, panes, exec, home, checking } from "herdr";
import { scan, repoName } from "./repos.js";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder || null;
}

// One row per repo: a linked worktree found in the folder is a checkout of a repo
// that may be listed already. Its main checkout stands for it when that is there too.
function byRepo(found) {
  const out = new Map();
  for (const r of found) {
    const id = r.common || r.path, main = r.common === `${r.path}/.git`;
    if (!out.has(id) || main) out.set(id, { ...r, name: main || !r.common ? r.rel : repoName(r.common), trees: r.trees.length });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default class WorktreePick extends View {
  init(_props, cx) {
    const p = props() ?? {};
    const space = spaces().find((s) => s.id === p.space) ?? (p.space || p.folder ? undefined : spaces().find((s) => s.active));
    this.space = space?.id ?? p.space;
    this.on = space?.machine ?? p.machine ?? null;
    this.folder = p.folder || (space && place(space)) || null;
    this.text = "";
    this.at = 0;
    this.repos = undefined; // undefined: looking
    this.error = "";
    this.input = InputState.new({ placeholder: "filter repositories" });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.shown()[this.at]));
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.handle = cx.focus_handle();
    this.handle.focus(); // the root is mounted from the first frame: keep the keyboard here while looking
    if (checking()) { this.repos = []; return; }
    cx.spawn(async (cx) => {
      try {
        if (!this.folder) throw new Error("This space has no folder.");
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: this.folder, on: this.on });
        if (top.code === 0) return this.go({ path: this.folder });
        this.repos = byRepo((await scan(this.folder, this.on)).repos);
        if (this.repos.length === 1) return this.go(this.repos[0]);
      } catch (error) { this.repos = []; this.error = String(error); }
      cx.notify();
      // The list (and its filter) only mounts once looking is done: the keyboard moves there now.
      this.handle.focus();
      cx.timer.after(100, () => this.input.focus());
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  // On to the worktree dialog, for that repo.
  go(repo) {
    if (!repo) return;
    const { overlay, ...rest } = props();
    closeOverlay(overlay);
    openOverlay({ mod: "worktree", kind: "dialog", ...(rest.action === "open" ? { width: 560, height: 480 } : { width: 460, height: 280 }), props: { action: "new", ...rest, space: this.space, folder: repo.path } });
  }

  shown() {
    const f = this.text.trim().toLowerCase();
    return (this.repos ?? []).filter((r) => !f || r.name.toLowerCase().includes(f));
  }

  key(e, cx) {
    if (e.key === "escape") return this.close();
    const n = this.shown().length;
    if (e.key === "enter") this.go(this.shown()[this.at]);
    else if ((e.key === "down" || e.key === "up") && n) this.at = (this.at + (e.key === "down" ? 1 : n - 1)) % n;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    const t = theme(), rows = this.shown(), all = this.repos ?? [];
    const what = props()?.action === "open" ? "Open worktree" : "New worktree";
    const userHome = this.on ? "" : home();
    const where = this.folder && userHome && this.folder.startsWith(userHome) ? `~${this.folder.slice(userHome.length)}` : this.folder ?? "This folder";
    const row = (r, i) => {
      const on = i === this.at;
      return h_flex()
        .id(`repo-${i}`)
        .flex_none()
        .h(32)
        .px(10)
        .gap(8)
        .items_center()
        .rounded(7)
        .cursor_pointer()
        .when(on, (el) => el.bg(t.selected))
        .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
        .on_click(() => this.go(r))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(r.name))
        .when(r.trees > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${r.trees} ${r.trees === 1 ? "worktree" : "worktrees"}`)));
    };
    return v_flex()
      .id("polyrepo-worktree-pick")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .size_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .child(h_flex()
        .child(div().flex_1().font_semibold().text_color(t.foreground).child(all.length > 1 ? `${what}: which repository?` : what))
        .child(div().text_size(11).text_color(t.dim).child(all.length > 1 ? `${rows.length === all.length ? all.length : `${rows.length}/${all.length}`} in ${where}` : "")))
      .when(this.repos === undefined, (el) => el.child(div().text_color(t.muted).child("…")))
      .when(Boolean(this.repos) && all.length === 0, (el) => el.child(div().text_color(this.error ? t.blocked : t.muted).child(this.error || `${where} is not in a git repository, and holds none.`)))
      .when(all.length > 1, (el) =>
        el
          .child(Input.new(this.input).h(32).px(10).items_center().rounded(6).border(1).border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_color(t.foreground))
          .child(
            div()
              .relative()
              .flex_1()
              .min_h(0)
              .child(
                v_flex()
                  .id("pick-list")
                  .size_full()
                  .overflow_y_scroll()
                  .children(rows.map(row))
                  .when(rows.length === 0, (el) => el.child(div().p(10).text_color(t.dim).child("No matching repositories."))),
              )
              .child(Scrollbar.vertical("pick-list").absolute().inset_0()),
          ),
      )
      .when(all.length <= 1, (el) => el.child(div().flex_1()))
      .child(h_flex().justify_end().text_size(11).text_color(t.dim).child(all.length > 1 ? "↑↓ choose · ↵ pick · esc close" : "esc close"));
  }
}
