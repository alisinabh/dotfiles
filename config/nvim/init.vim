set nocompatible              " be iMproved, required
" filetype off                  " required

let g:airline_powerline_fonts = 1
let g:airline#extensions#tabline#enabled = 1


" set the runtime path to include Vundle and initialize
set rtp+=~/.config/nvim/bundle/Vundle.vim
call vundle#begin()
" alternatively, pass a path where Vundle should install plugins
"call vundle#begin('~/some/path/here')

" let Vundle manage Vundle, required
Plugin 'VundleVim/Vundle.vim'

" The following are examples of different formats supported.
" Keep Plugin commands between vundle#begin/end.
" plugin on GitHub repo
Plugin 'tpope/vim-fugitive'
" plugin from http://vim-scripts.org/vim/scripts.html
Plugin 'L9'

Plugin 'vim-airline/vim-airline'
Plugin 'vim-airline/vim-airline-themes'

Plugin 'elixir-lang/vim-elixir'
Plugin 'slashmili/alchemist.vim'

Plugin 'scrooloose/nerdtree'
Plugin 'Xuyuanp/nerdtree-git-plugin'
Plugin 'aradunovic/perun.vim'
Plugin 'ryanoasis/vim-devicons'
Plugin 'mhinz/vim-mix-format'
"Plugin 'Valloric/YouCompleteMe'

Plugin 'ctrlpvim/ctrlp.vim'

Plugin 'junegunn/fzf.vim'

Plugin 'gosukiwi/vim-atom-dark'
Plugin 'mileszs/ack.vim'
Plugin 'kylef/apiblueprint.vim'

" Dart
Plugin 'dart-lang/dart-vim-plugin'

" Solidity
Plugin 'tomlion/vim-solidity'

" Spell check
Plugin 'kamykn/spelunker.vim'
Plugin 'kamykn/popup-menu.nvim'

" All of your Plugins must be added before the following line
call vundle#end()            " required

let g:mix_format_on_save = 1
let g:ctrlp_user_command = 'find %s -type f'
let g:ctrlp_working_path_mode = 'ra'
let g:ctrlp_user_command = ['.git', 'cd %s && git ls-files']

let dart_html_in_string=v:true
let g:dart_style_guide = 2
let g:dart_format_on_save = 1

let g:enable_spelunker_vim_on_readonly = 1
let g:spelunker_max_hi_words_each_buf = 300

filetype plugin indent on    " required
set t_Co=256
set laststatus=2
syntax enable
set termguicolors
colorscheme atom-dark-256

set encoding=UTF-8

set number

set ts=2
set sts=2
set sw=2
set et

map <C-n> :NERDTreeToggle<CR>
" To ignore plugin indent changes, instead use:
"filetype plugin on
"
" Brief help
" :PluginList       - lists configured plugins
" :PluginInstall    - installs plugins; append `!` to update or just :PluginUpdate
" :PluginSearch foo - searches for foo; append `!` to refresh local cache
" :PluginClean      - confirms removal of unused plugins; append `!` to auto-approve removal
"
" see :h vundle for more details or wiki for FAQ
" Put your non-Plugin stuff after this line
