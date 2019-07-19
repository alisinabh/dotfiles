#!/bin/bash

echo -e "\\n\\nInstalling pacman packages..."
echo "=============================="

formulas=(
    ack
    diff-so-fancy
    dnsmasq
    fzf
    git
    'grep'
    highlight
    hub
    markdown
    mas
    neovim
    node
    nginx
    python
    shellcheck
    tmux
    tree
    wget
    vim
    z
    zsh
    ripgrep
    entr
    elixir
    sox
    atom
    axel
    terminator
    i3-gaps
    i3blocks
    i3lock
    i3status
    compton
    rofi
    otf-font-awesome
    xss-lock
    xautolock
    xorg-xprop
    playerctl 
    xorg-xbacklight
    acpi
)

for formula in "${formulas[@]}"; do
    formula_name=$( echo "$formula" | awk '{print $1}' )
    if pacman -Qi "$formula_name" > /dev/null 2>&1; then
        echo "$formula_name already installed... skipping."
    else
        sudo pacman -S "$formula" --noconfirm
    fi
done

# after hte install, install neovim python libraries
echo -e "\\n\\nRunning Neovim Python install"
echo "=============================="
pip2 install --user neovim
pip3 install --user neovim

# Change the default shell to zsh
zsh_path="$( which zsh )"
if ! grep "$zsh_path" /etc/shells; then
    echo "adding $zsh_path to /etc/shells"
    echo "$zsh_path" | sudo tee -a /etc/shells
fi

if [[ "$SHELL" != "$zsh_path" ]]; then
    chsh -s "$zsh_path"
    echo "default shell changed to $zsh_path"
fi
