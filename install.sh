#!/usr/bin/env bash

set -e

command_exists() {
    type "$1" > /dev/null 2>&1
}

echo "Installing dotfiles."

echo "Initializing submodule(s)"
git submodule update --init --recursive

source install/link.sh

# only perform ArchLinux-specific install
if [ -f "/etc/arch-release" ]; then
    echo -e "\\n\\nRunning on ArchLinux"

    source install/pacman.sh
    #source install/yaourt.sh
    source install/yay.sh

    # Add user to video group for light
    sudo gpasswd -a "$USER" video
elif [[ "$OSTYPE" = "darwin"* ]]; then
    echo -e "\\n\\nRunning on MacOS"

    source install/macos.sh
fi

source install/git.sh

if ! command_exists zsh; then
    echo "zsh not found. Please install and then re-run installation scripts"
    exit 1
elif ! [[ $SHELL =~ .*zsh.* ]]; then
    echo "Configuring zsh as default shell"
    chsh -s "$(which zsh)"

    # Install zplug
    echo "Installing zplug using curl..."
    curl -sL --proto-redir -all,https https://raw.githubusercontent.com/zplug/installer/master/installer.zsh | zsh

fi

source install/font.sh

source install/nvim.sh

source install/tmux.sh

echo "Done. Reload your terminal."

echo "Please activate gnome-keyring for i3: https://wiki.archlinux.org/index.php/GNOME/Keyring#PAM_method"
