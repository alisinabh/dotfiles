#!/bin/bash

echo "Installing SpaceVim and Plugins"

curl -sLf https://spacevim.org/install.sh | bash

nvim +SPInstall +qall

echo "nvim installed and exited with code $?"
