-- Plugins using Lazy
--

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  -- Telescope
  {
    'nvim-telescope/telescope.nvim', tag = '0.1.4',
    dependencies = { 'nvim-lua/plenary.nvim' }
  },
  -- Whichkey
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    init = function()
      vim.o.timeout = true
      vim.o.timeoutlen = 300
    end,
    opts = {}
  },
  -- Treesitter
  { 
    'nvim-treesitter/nvim-treesitter',
    build = ":TSUpdate"
  },
  -- NeoTree
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    }
  },
  -- Undotree
  'mbbill/undotree',
  -- Tpope
  'tpope/vim-fugitive',
  'tpope/vim-surround',
  -- Comment
  {
    'numToStr/Comment.nvim',
    lazy = false,
  },
  -- Smart Splits
  'mrjones2014/smart-splits.nvim',
  -- Startup
  { "mhinz/vim-startify", lazy = false },
  -- Indent Guide
  { "lukas-reineke/indent-blankline.nvim", main = "ibl" },
  -- Elixir
  'elixir-editors/vim-elixir',
  -- LSP
  { 'VonHeikemen/lsp-zero.nvim', branch = 'v3.x' },
  { 'neovim/nvim-lspconfig' },
  { 'hrsh7th/cmp-nvim-lsp' },
  { 'hrsh7th/nvim-cmp' },
  { 'L3MON4D3/LuaSnip' },
  { 'williamboman/mason.nvim' },
  { 'williamboman/mason-lspconfig.nvim' },
  { 'elentok/format-on-save.nvim' },
  -- Colorschemes
  { 'rose-pine/neovim', name = 'rose-pine' },
  { 'rebelot/kanagawa.nvim', name = 'kanagawa' },
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 }
})
