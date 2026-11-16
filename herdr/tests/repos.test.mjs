import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { repos, scratch, git, repo, exec } from "./harness.mjs";

const { scan, repoName } = repos();
const rels = (found) => found.repos.map((r) => r.rel);
const bare = (list) => list.map(({ path, branch }) => ({ path, branch }));
const trees = (found, rel) => bare(found.repos.find((r) => r.rel === rel).trees);

test("a folder of repos: every checkout once, with git's own list of linked worktrees", async () => {
  const root = scratch("scan"), box = join(root, "box");
  try {
    const app = repo(join(box, "app"));
    git(app, "worktree", "add", "-q", "-b", "feature/x", join(box, "app-wt", "feature"));
    git(app, "worktree", "add", "-q", "-b", "elsewhere", join(root, "outside", "y"));
    git(app, "worktree", "add", "-q", "--detach", join(app, ".inner"));
    repo(join(box, "group", "lib"), "trunk");
    repo(join(box, "node_modules", "pkg"));
    repo(join(box, ".hidden", "secret"));
    mkdirSync(join(box, "plain", "notes"), { recursive: true });

    const found = await scan(box, null);
    assert.equal(found.root, box);
    // app-wt/feature is a checkout in the folder too (a linked worktree): listed, not walked into.
    assert.deepEqual(rels(found), ["app", "app-wt/feature", "group/lib"]);
    assert.equal(found.repos[0].common, join(app, ".git"));
    assert.equal(found.repos[1].common, join(app, ".git"), "a linked worktree names its repo's shared folder");
    assert.equal(found.repos[2].common, join(box, "group", "lib", ".git"));

    // The same checkouts git lists, main one aside.
    const listed = git(app, "worktree", "list", "--porcelain").split("\n\n").slice(1).map((b) => {
      const lines = b.split("\n");
      return { path: lines[0].slice(9), branch: lines.find((l) => l.startsWith("branch "))?.slice(18) ?? null };
    });
    const by = (a, b) => a.path.localeCompare(b.path);
    assert.deepEqual([...trees(found, "app")].sort(by), listed.sort(by));
    assert.deepEqual(trees(found, "app").map((t) => t.branch).sort(), [null, "elsewhere", "feature/x"].sort());
    assert.deepEqual(trees(found, "group/lib"), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a checkout answers for itself, from its top", async () => {
  const root = scratch("self");
  try {
    const app = repo(join(root, "app"));
    git(app, "worktree", "add", "-q", "-b", "side", join(root, "side"));
    repo(join(app, "vendored"));
    const found = await scan(app, null);
    assert.deepEqual(rels(found), [""], "its own folders are not searched");
    assert.deepEqual(bare(found.repos[0].trees), [{ path: join(root, "side"), branch: "side" }]);
    // From the linked worktree: the same repo, the same list.
    const linked = await scan(join(root, "side"), null);
    assert.equal(linked.repos[0].common, join(app, ".git"));
    assert.deepEqual(bare(linked.repos[0].trees), [{ path: join(root, "side"), branch: "side" }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a bare repo's checkouts are found through any one of them", async () => {
  const root = scratch("bare"), box = join(root, "box");
  try {
    const seed = repo(join(root, "seed"));
    mkdirSync(box);
    git(root, "clone", "-q", "--bare", seed, join(box, "proj.git"));
    git(join(box, "proj.git"), "worktree", "add", "-q", join(box, "proj-main"), "main");
    git(join(box, "proj.git"), "worktree", "add", "-q", "-b", "feat", join(box, "proj-feat"));
    const found = await scan(box, null);
    assert.deepEqual(rels(found), ["proj-feat", "proj-main"]);
    for (const r of found.repos) {
      assert.equal(r.common, join(box, "proj.git"));
      assert.deepEqual(r.trees.map((t) => t.branch).sort(), ["feat", "main"]);
    }
    assert.equal(repoName(found.repos[0].common), "proj");
    assert.equal(repoName(join(box, "app", ".git")), "app");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("worktrees recorded with relative paths resolve to where they are", async (t) => {
  const [major, minor] = git(".", "--version").match(/(\d+)\.(\d+)/).slice(1).map(Number);
  if (major < 2 || (major === 2 && minor < 48)) return t.skip("git older than 2.48 has no relative worktree paths");
  const root = scratch("relative");
  try {
    const app = repo(join(root, "box", "app"));
    git(app, "-c", "worktree.useRelativePaths=true", "worktree", "add", "-q", "-b", "rel", join(root, "trees", "rel"));
    const found = await scan(join(root, "box"), null);
    assert.deepEqual(bare(found.repos[0].trees), [{ path: join(root, "trees", "rel"), branch: "rel" }]);
    // And the relative worktree seen as a checkout names the same shared folder.
    const linked = await scan(join(root, "trees"), null);
    assert.equal(linked.repos[0].common, join(app, ".git"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("removed worktrees, depth, home and a missing folder", async () => {
  const root = scratch("edges"), box = join(root, "box");
  try {
    const app = repo(join(box, "app"));
    git(app, "worktree", "add", "-q", "-b", "gone", join(root, "gone"));
    rmSync(join(root, "gone"), { recursive: true });
    repo(join(box, "a", "b", "c", "near"));
    repo(join(box, "a", "b", "c", "d", "far"));
    const found = await scan(box, null);
    assert.deepEqual(rels(found), ["a/b/c/near", "app"], "three folders outside git deep, no further");
    assert.deepEqual(trees(found, "app"), [], "a worktree whose folder is gone is not listed");
    assert.deepEqual(rels(await scan(box, null, 0)), ["app"]);

    // Home is never walked, but a repo at home still answers for itself.
    const asHome = async (home) => (await exec("sh", ["-c", repos().SCRIPT, "repos", home, "3"], { env: { HOME: home } })).stdout.split("\0");
    assert.deepEqual(await asHome(box), ["p", box, ""]);
    assert.deepEqual((await asHome(app)).slice(0, 4), ["p", app, "r", app]);

    // Through a link the real path is reported, as git reports it.
    symlinkSync(box, join(root, "link"));
    const linked = await scan(join(root, "link"), null);
    assert.equal(linked.root, box);
    assert.deepEqual(rels(linked), ["a/b/c/near", "app"]);

    assert.deepEqual(await scan(join(root, "missing"), null), { root: null, repos: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("each worktree says when git last wrote in it", async () => {
  const root = scratch("times");
  try {
    const app = repo(join(root, "app"));
    git(app, "worktree", "add", "-q", "-b", "old", join(root, "old"));
    // A folder name with a space in it survives the listing.
    git(app, "worktree", "add", "-q", "-b", "spaced", join(root, "with space"));
    const now = Math.floor(Date.now() / 1000);
    const found = await scan(app, null);
    assert.deepEqual(found.repos[0].trees.map((t) => [t.branch, t.path]).sort(), [["old", join(root, "old")], ["spaced", join(root, "with space")]]);
    for (const t of found.repos[0].trees) assert.ok(Math.abs(t.at - now) < 60, `${t.branch}: ${t.at}`);
    // Without a stat to ask, they are still listed.
    const none = await exec("sh", ["-c", `stat() { return 1; }\n${repos().SCRIPT}`, "repos", app, "3"]);
    assert.deepEqual(repos().parse(none.stdout).repos[0].trees.map((t) => [t.branch, t.at]).sort(), [["old", 0], ["spaced", 0]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
