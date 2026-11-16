// The repos in a folder and their linked worktrees, in one `sh` run that never starts git.
// The same file sits in every polyrepo mod that looks for repos (spaces, changes, files, menu,
// worktree-pick): change them together. A test fails when the copies differ.

import { exec } from "herdr";

// $1: the folder. $2: how many levels of folders outside git to go down.
// Prints NUL-ended fields: "p" the folder's real path; per checkout "r", its path and the
// folder git keeps its shared files in (a main checkout's .git; for a linked worktree or a
// bare repo's checkout, wherever that is); per linked worktree of the last "r", "t", its
// path, its HEAD (a branch, or a commit when detached) and when git last wrote there (the
// seconds on the folder git keeps for it: 0 where there is no stat to ask).
// A folder that is a checkout answers for itself. Otherwise its folders are walked, never
// into a checkout (a repo's own folders can be huge), node_modules or hidden ones. Home and
// / hold too much to walk, and a walk stops at 400 checkouts.
const SCRIPT = `
cd "$1" 2>/dev/null || exit 0
root=$(pwd -P)
n=0
S=
mtimes() {
  [ -n "$S" ] || { if stat -c %Y / >/dev/null 2>&1; then S=gnu; elif stat -f %m / >/dev/null 2>&1; then S=bsd; else S=none; fi; }
  case $S in
    gnu) stat -c '%Y %n' "$@" 2>/dev/null ;;
    bsd) stat -f '%m %N' "$@" 2>/dev/null ;;
    *) for x in "$@"; do printf '0 %s\n' "$x"; done ;;
  esac
}
checkout() {
  n=$((n + 1))
  if [ -d "$1/.git" ]; then c=$1/.git
  else
    c=; IFS= read -r c < "$1/.git" 2>/dev/null
    c=\${c#gitdir: }
    case $c in /*) ;; *) c=$1/$c ;; esac
    if [ -f "$c/commondir" ]; then
      k=; IFS= read -r k < "$c/commondir"
      case $k in /*) c=$k ;; *) c=$c/$k ;; esac
    fi
    c=$(cd "$c" 2>/dev/null && pwd -P)
  fi
  printf 'r\\0%s\\0%s\\0' "$1" "$c"
  [ -d "$c/worktrees" ] || return 0
  # Which stat this is, asked here: the loop below runs in a subshell and would forget.
  mtimes / >/dev/null
  mtimes "$c"/worktrees/*/ | while read -r m w; do
    w=\${w%/}/
    [ -f "\${w}gitdir" ] || continue
    g=; IFS= read -r g < "\${w}gitdir"
    [ -n "$g" ] || continue
    h=; IFS= read -r h < "\${w}HEAD"
    case $g in /*) ;; *) g=$(cd "$w" 2>/dev/null && cd "\${g%/.git}" 2>/dev/null && pwd -P)/.git ;; esac
    if [ -e "$g" ]; then printf 't\\0%s\\0%s\\0%s\\0' "\${g%/.git}" "\${h#ref: refs/heads/}" "$m"; fi
  done
}
walk() {
  for d in "$1"/*/; do
    [ "$n" -lt 400 ] || return 0
    [ -d "$d" ] || continue
    d=\${d%/}
    case \${d##*/} in node_modules) continue ;; esac
    if [ -e "$d/.git" ]; then checkout "$d"
    elif [ "$2" -gt 0 ]; then walk "$d" $(($2 - 1)); fi
  done
}
printf 'p\\0%s\\0' "$root"
if [ -e "$root/.git" ]; then checkout "$root"
elif [ "$root" != / ] && { [ -z "$HOME" ] || [ "$root" != "$(cd "$HOME" 2>/dev/null && pwd -P)" ]; }; then walk "$root" "$2"
fi
`;

const COMMIT = /^[0-9a-f]{40,64}$/;

// { root, repos: [{ path, rel, common, trees: [{ path, branch, at }] }] }: `rel` is the path
// under the folder ("" for the folder itself), `branch` null when detached, `at` when git
// last wrote in that worktree (unix seconds, 0 unknown).
export function parse(out) {
  const f = out.split("\0"), repos = [];
  let root = null;
  for (let i = 0; i + 1 < f.length; ) {
    if (f[i] === "p") {
      root = f[i + 1];
      i += 2;
    } else if (f[i] === "r") {
      const path = f[i + 1];
      repos.push({ path, rel: path === root ? "" : path.slice(root.length + 1), common: f[i + 2] ?? "", trees: [] });
      i += 3;
    } else if (f[i] === "t") {
      const head = f[i + 2] ?? "";
      repos[repos.length - 1]?.trees.push({ path: f[i + 1], branch: !head || COMMIT.test(head) ? null : head, at: Number(f[i + 3]) || 0 });
      i += 4;
    } else break;
  }
  // The shell lists folders in its own order ("app-wt" before "app"): by path here.
  repos.sort((a, b) => a.rel.localeCompare(b.rel));
  return { root, repos };
}

// Rejects where there is no `sh` (Windows) or the machine cannot be reached.
export async function scan(folder, on, depth = 3) {
  const r = await exec("sh", ["-c", SCRIPT, "repos", folder, String(depth)], { on, timeout: 20000 });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot look for repositories");
  return parse(r.stdout);
}

// What a repo is called: its main checkout's folder, or a bare repo's own name.
export function repoName(common) {
  const base = (path) => path.replace(/\/+$/, "").split("/").pop();
  return common.endsWith("/.git") ? base(common.slice(0, -5)) : base(common).replace(/\.git$/, "");
}
