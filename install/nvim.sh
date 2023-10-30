#!/bin/bash -e

echo "Install neovim packages"

nvim  --headless -c 'quitall'

echo "nvim installed and exited with code $?"
