local lsp_zero = require('lsp-zero')
local wk = require("which-key")

lsp_zero.on_attach(function(client, bufnr)
  vim.lsp.inlay_hint.enable(true)

  wk.add({
    -- GoTo Definition
    { "gd",         function() vim.lsp.buf.definition() end,                                       desc = "GoTo Definition" },

    -- Show Documentation
    { "K",          function() vim.lsp.buf.hover() end,                                            desc = "Show Documentation" },

    -- LSP
    { "<leader>ld", require("telescope.builtin").lsp_definitions,                                  desc = "GoTo Definition" },
    { "<leader>lD", function() vim.diagnostic.open_float() end,                                    desc = "Show Diagnostic" },
    { "<leader>lk", function() vim.lsp.buf.hover() end,                                            desc = "Show Documentation" },
    { "<leader>lr", function() vim.lsp.buf.references() end,                                       desc = "Show References" },
    { "<leader>lR", function() vim.lsp.buf.rename() end,                                           desc = "Rename" },
    { "<leader>lh", function() vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled()) end, desc = "Toggle Inlay Hints" },
  }, { buffer = bufnr })
end)

require('mason').setup({})
require('mason-lspconfig').setup({
  ensure_installed = {
    'elixirls',
    'rust_analyzer',
    'lua_ls',
    'yamlls',
    'solidity',
    'bashls'
  },
  handlers = {
    lsp_zero.default_setup,
    lua_ls = function()
      local lua_opts = lsp_zero.nvim_lua_ls()
      require('lspconfig').lua_ls.setup(lua_opts)
    end,
  },
})

require('lspconfig').typos_lsp.setup({
  -- Logging level of the language server. Logs appear in :LspLog. Defaults to error.
  cmd_env = { RUST_LOG = "Warning" },
  init_options = {
    -- How typos are rendered in the editor, can be one of an Error, Warning, Info or Hint.
    -- Defaults to error.
    diagnosticSeverity = "Warning"
  }
})

local cmp = require('cmp')
local cmp_select = { behavior = cmp.SelectBehavior.Select }

cmp.setup({
  sources = {
    { name = 'path' },
    { name = 'nvim_lsp' },
    { name = 'nvim_lua' },
  },
  formatting = lsp_zero.cmp_format(),
  mapping = cmp.mapping.preset.insert({
    ['<C-k>'] = cmp.mapping.select_prev_item(cmp_select),
    ['<C-j>'] = cmp.mapping.select_next_item(cmp_select),
    ['<C-y>'] = cmp.mapping.confirm({ select = true }),
    ['<C-q>'] = cmp.mapping.abort(),
    ['<C-n>'] = function(fallback) fallback() end,
    ['<Tab>'] = cmp.mapping.confirm({ select = true })
  }),
})

-- Format On Save

local format_on_save = require("format-on-save")
local formatters = require("format-on-save.formatters")

format_on_save.setup({
  exclude_path_patterns = {
    "/node_modules/",
    ".local/share/nvim/lazy",
  },
  formatter_by_ft = {
    css = formatters.lsp,
    html = formatters.lsp,
    java = formatters.lsp,
    javascript = formatters.lsp,
    json = formatters.lsp,
    lua = formatters.lsp,
    markdown = formatters.prettierd,
    openscad = formatters.lsp,
    python = formatters.black,
    rust = formatters.lsp,
    scad = formatters.lsp,
    scss = formatters.lsp,
    -- sh = formatters.shfmt,
    terraform = formatters.lsp,
    typescript = formatters.prettierd,
    typescriptreact = formatters.prettierd,
    yaml = formatters.lsp,
    solidity = {
      formatters.lsp,
      formatters.if_file_exists({
        pattern = "foundry.toml",
        formatter = formatters.shell({ cmd = { "forge", "fmt", "-r", "-" } })
      })
    },
    -- Add your own shell formatters:
    elixir = {
      formatters.remove_trailing_whitespace,
      formatters.remove_trailing_newlines,
      formatters.shell({ cmd = { "mix", "format", "--stdin-filename", "%", "-" } })
    }
  },
  -- Optional: fallback formatter to use when no formatters match the current filetype
  fallback_formatter = {
    formatters.remove_trailing_whitespace,
    formatters.remove_trailing_newlines
  },
})

-- Inlay Hints at the end of line
require("lsp-endhints").setup {
  icons = {
    type = "󰜁 ",
    parameter = "󰏪 ",
    offspec = " ", -- hint kind not defined in official LSP spec
    unknown = " ", -- hint kind is nil
  },
  label = {
    truncateAtChars = 20,
    padding = 1,
    marginLeft = 0,
    sameKindSeparator = ", ",
  },
  extmark = {
    priority = 50,
  },
  autoEnableHints = true,
}
