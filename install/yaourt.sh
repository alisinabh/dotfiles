#!/bin/bash

CUR_DIR=`pwd`

mkdir /tmp/dotfile-install
cd /tmp/dotfile-install

git clone https://aur.archlinux.org/package-query.git
cd package-query
makepkg -si
cd ..
git clone https://aur.archlinux.org/yaourt.git
cd yaourt
makepkg -si
cd $CUR_DIR
