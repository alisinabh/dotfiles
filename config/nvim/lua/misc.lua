require('gitsigns').setup({
  signcolumn         = true,  -- Toggle with `:Gitsigns toggle_signs`
  numhl              = true,  -- Toggle with `:Gitsigns toggle_numhl`
  linehl             = false, -- Toggle with `:Gitsigns toggle_linehl`
  word_diff          = false, -- Toggle with `:Gitsigns toggle_word_diff`
  current_line_blame = true,  -- Toggle with `:Gitsigns toggle_current_line_blame`
});

require('nvim-web-devicons').setup({
  override = {
    sol = {
      icon = "",
      color = "#519aba",
      cterm_color = "74",
      name = "Solidity",
    }
  }
});
