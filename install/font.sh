#!/bin/sh

wget https://github.com/ryanoasis/nerd-fonts/raw/2.0.0/patched-fonts/Hack/Regular/complete/Hack%20Regular%20Nerd%20Font%20Complete.ttf

if [[ "$OSTYPE" == "darwin"* ]]; then
    sudo mv Hack\ Regular*.ttf /Library/Fonts
else
    sudo mv Hack\ Regular*.ttf /usr/share/fonts

    sudo pacman -S ttf-fira-code --noconfirm
fi

