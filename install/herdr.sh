#!/usr/bin/env bash

# Herdr (herdr-app): links the polyrepo layout and its mods from herdr/ into the app's
# home. A space on a folder of git repos then works like a repo space: worktrees listed
# in the sidebar, changes grouped by repo. Safe to run again: it links what is missing,
# and makes a running Herdr load what the links point at now (after a pull or an edit
# here, since Herdr only notices changes inside its own home).
#
#   bash ~/.dotfiles/install/herdr.sh
#   herdr-app do layout.switch --name polyrepo     # or cycle to it with Cmd/Ctrl+Shift+L

DOTFILES=${DOTFILES:-$HOME/.dotfiles}
HERDR_HOME=${HERDR_APP_HOME:-$HOME/.config/herdr-app}

echo -e "\\n\\nLinking Herdr polyrepo layout and mods"
echo "=============================="
mkdir -p "$HERDR_HOME/mods" "$HERDR_HOME/layouts"

for item in "$DOTFILES"/herdr/mods/*/ "$DOTFILES"/herdr/layouts/*.json; do
    item=${item%/}
    if [ ! -e "$item" ]; then
        continue
    fi
    target="$HERDR_HOME/$( basename "$( dirname "$item" )" )/$( basename "$item" )"
    if [ -L "$target" ] && [ "$( readlink "$target" )" = "$item" ]; then
        # The link's own time: Herdr looks again at what it points to.
        touch -h "$target"
    elif [ -e "$target" ] || [ -L "$target" ]; then
        echo "~${target#$HOME} already exists... Skipping."
    else
        echo "Creating symlink for $item"
        ln -s "$item" "$target"
    fi
done
