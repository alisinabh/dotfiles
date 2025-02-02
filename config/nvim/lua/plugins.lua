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
    "nvim-telescope/telescope.nvim",
    dependencies = {
      {
        "nvim-telescope/telescope-live-grep-args.nvim",
        -- This will not install any breaking changes.
        -- For major updates, this must be adjusted manually.
        version = "^1.0.0",
      },
      'nvim-lua/plenary.nvim'
    },
    config = function()
      require("telescope").load_extension("live_grep_args")
    end
  },
  -- Whichkey
  {
    "folke/which-key.nvim",
    dependencies = {
      { 'echasnovski/mini.nvim', version = '*' }
    },
    event = "VeryLazy",
    init = function()
      vim.o.timeout = true
      vim.o.timeoutlen = 300
      require('mini.icons').setup()
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
  'tpope/vim-sleuth',
  -- Gitsigns
  { 'lewis6991/gitsigns.nvim' },
  -- Comment
  {
    'numToStr/Comment.nvim',
    lazy = false,
  },
  -- Smart Splits
  'mrjones2014/smart-splits.nvim',
  -- Startup
  {
    "mhinz/vim-startify",
    lazy = false
  },
  -- Indent Guide
  { "lukas-reineke/indent-blankline.nvim", main = "ibl" },
  -- Elixir
  'elixir-editors/vim-elixir',
  -- LSP
  {
    'VonHeikemen/lsp-zero.nvim',
    branch = 'v3.x'
  },
  { 'neovim/nvim-lspconfig' },
  { 'hrsh7th/cmp-nvim-lsp' },
  { 'hrsh7th/nvim-cmp' },
  { 'L3MON4D3/LuaSnip' },
  { 'williamboman/mason.nvim' },
  { 'williamboman/mason-lspconfig.nvim' },
  { 'elentok/format-on-save.nvim' },
  -- Status Line
  {
    "nvim-lualine/lualine.nvim",
    dependencies = {
      "nvim-tree/nvim-web-devicons"
    }
  },
  -- Colorschemes
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000
  },
  -- Spell Checkr
  "tekumara/typos-lsp",
  -- Inlay Hints at end of line,
  {
    "chrisgrieser/nvim-lsp-endhints",
    event = "LspAttach",
    opts = {}, -- required, even if empty
  },
  -- AI Companion
  {
    "olimorris/codecompanion.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    config = true
  },
  -- Diff
  { 'echasnovski/mini.nvim', version = '*' }
})
