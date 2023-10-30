local lsp_zero = require('lsp-zero')
local wk = require("which-key")

lsp_zero.on_attach(function(client, bufnr)
  wk.register({
    ['gd'] = { function() vim.lsp.buf.definition() end, "GoTo Definition" },
    ['K'] = { function() vim.lsp.buf.hover() end, "Show documentation" },
    ['<leader>l'] = {
      name = "LSP",
      d = { function() vim.lsp.buf.definition() end, "GoTo Definition" },
      k = { function() vim.lsp.buf.hover() end, "Show Documentation" },
      r = { function() vim.lsp.buf.references() end, "Show References" }
    }
  }, { buffer = bufnr })
end)

require('mason').setup({})
require('mason-lspconfig').setup({
  ensure_installed = {
    'elixirls',
    'tsserver',
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
    ['<C-p>'] = cmp.mapping.select_prev_item(cmp_select),
    ['<C-k>'] = cmp.mapping.select_prev_item(cmp_select),
    ['<C-n>'] = cmp.mapping.select_next_item(cmp_select),
    ['<C-j>'] = cmp.mapping.select_next_item(cmp_select),
    ['<C-y>'] = cmp.mapping.confirm({ select = true }),
    -- ['<CR>'] = cmp.mapping.confirm({ select = true }),
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
