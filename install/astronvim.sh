#!/bin/bash -e

echo "Installing AstronNVim and Plugins"

cargo install tree-sitter-cli

git clone https://github.com/AstroNvim/AstroNvim ~/.config/nvim

ln -s ~/.dotfiles/astronvim-config ~/.config/nvim/lua/user

nvim  --headless -c 'quitall'

echo "nvim installed and exited with code $?"
