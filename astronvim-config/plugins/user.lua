return {
  {
    "tpope/vim-fugitive",
    lazy = false
  },
  {
    "mhanberg/elixir.nvim",
    ft = { "elixir", "eex", "heex", "surface" },
    config = function()
      local elixir = require("elixir")

      elixir.setup {
        settings = elixir.settings {
          dialyzerEnabled = false,
          enableTestLenses = true,
        }
      }
    end,
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
  }
  -- You can also add new plugins here as well:
  -- Add plugins, the lazy syntax
  -- "andweeb/presence.nvim",
  -- {
  --   "ray-x/lsp_signature.nvim",
  --   event = "BufRead",
  --   config = function()
  --     require("lsp_signature").setup()
  --   end,
  -- },
}
