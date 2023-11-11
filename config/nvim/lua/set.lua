-- Sets

vim.opt.nu = true
vim.opt.relativenumber = false

vim.opt.tabstop = 4
vim.opt.softtabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true

vim.opt.smartindent = false

vim.opt.wrap = true

vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true

vim.opt.hlsearch = true
vim.opt.incsearch = true

vim.opt.termguicolors = true

vim.opt.scrolloff = 8
vim.opt.signcolumn = "yes"
vim.opt.isfname:append("@-@")

vim.opt.updatetime = 50

vim.opt.colorcolumn = "100"

vim.g.mapleader = " "

-- Startify
vim.g.startify_enable_special = 1
vim.g.startify_files_number = 6
vim.g.startify_change_to_dir = 0
vim.g.startify_change_to_vcs_root = 0

vim.g.startify_commands = {
  { "Dotfiles",     'lua require("telescope.builtin").find_files({cwd = "~/.dotfiles", prompt_title="Find in Dotfiles"})' },
  { "Lazy sync",    "Lazy sync" },
  { "Lazy update",  "Lazy update" },
  { "Lazy profile", "Lazy profile" },
}

function _G.webDevIcons(path)
  local filename = vim.fn.fnamemodify(path, ":t")
  local extension = vim.fn.fnamemodify(path, ":e")
  return require("nvim-web-devicons").get_icon(filename, extension, { default = true })
end

vim.api.nvim_exec(
  [[
function! StartifyEntryFormat() abort
  return 'v:lua.webDevIcons(absolute_path) . " " . entry_path'
endfunction
]],
  false
)
