#!/bin/sh
CUR_DIR=`pwd`

mkdir /tmp/dotfile-install
cd /tmp/dotfile-install

git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si

yay -S xidlehook

cd $CUR_DIR
