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
"Plugin 'aradunovic/perun.vim'
Plugin 'ryanoasis/vim-devicons'
Plugin 'mhinz/vim-mix-format'
"Plugin 'Valloric/YouCompleteMe'

" Remove ctrlp in favor of fzf
" Plugin 'ctrlpvim/ctrlp.vim'

Plugin 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plugin 'junegunn/fzf.vim'

Plugin 'gosukiwi/vim-atom-dark'
Plugin 'mileszs/ack.vim'

Plugin 'Yggdroot/indentLine'

Plugin 'kamykn/spelunker.vim'
Plugin 'kamykn/popup-menu.nvim'

" All of your Plugins must be added before the following line
call vundle#end()            " required

let g:mix_format_on_save = 1

filetype plugin indent on    " required
set t_Co=256
set laststatus=2
syntax enable
set termguicolors
colorscheme atom-dark-256

set encoding=UTF-8

let g:ackprg = 'ag --vimgrep --smart-case'                                                   
let g:indentLine_char = '⦙'
"cnoreabbrev ag Ack                                                                           
"cnoreabbrev aG Ack                                                                           
"cnoreabbrev Ag Ack                                                                           
"cnoreabbrev AG Ack  

set number
set expandtab
set mouse=nv
set shiftwidth=2
set softtabstop=2
set autoread
set clipboard=unnamed
set ttyfast
set shell=$SHELL
set title
set list
set listchars=tab:→\ ,eol:¬,trail:⋅,extends:❯,precedes:❮

set nospell
let g:enable_spelunker_vim = 1

match ErrorMsg '^\(<\|=\|>\)\{7\}\([^=].\+\)\?$'

map <C-n> :NERDTreeToggle<CR>
map <C-p> :Files<CR>
map <C-i> :GFiles<CR>
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
