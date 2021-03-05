#!/bin/sh
CUR_DIR=`pwd`

rm -Rf /tmp/dotfile-install
mkdir -p /tmp/dotfile-install
cd /tmp/dotfile-install

git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si

yay -S xidlehook
yay -S zplug

cd $CUR_DIR
