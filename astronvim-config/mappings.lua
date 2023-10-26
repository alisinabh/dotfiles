-- Mapping data with "desc" stored directly by vim.keymap.set().
--
-- Please use this mappings table to set keyboard mapping since this is the
-- lower level configuration and more robust one. (which-key will
-- automatically pick-up stored data by this setting.)
return {
  -- first key is the mode
  n = {
    -- second key is the lefthand side of the map
    -- mappings seen under group name "Buffer"
    ["<leader>bn"] = { "<cmd>tabnew<cr>", desc = "New tab" },
    ["<leader>bD"] = {
      function()
        require("astronvim.utils.status").heirline.buffer_picker(function(bufnr)
          require("astronvim.utils.buffer").close(
            bufnr)
        end)
      end,
      desc = "Pick to close",
    },
    -- tables with the `name` key will be registered with which-key if it's installed
    -- this is useful for naming menus
    ["<leader>b"] = { name = "Buffers" },
    ["<leader><Tab>"] = { ":b#<cr>", desc = "Toggle alternate buffer" },
    -- Git
    ["<leader>gs"] = { ":G<cr>", desc = "Fugitive" },
    ["<leader>gl"] = { ":G log --oneline -15<cr>", desc = "Git log" },
    -- file
    ["<leader>fy"] = { ":let @+ = fnamemodify(expand(\"%\"), \":~:.\")<cr>", desc = "Copy file path (relative)" },
    -- tests
    ["<leader>k"] = { name = "Test" },
    ["<leader>ka"] = {
      ":split | execute 'terminal mix test ' | resize 15<cr>",
      desc = "mix test all"
    },
    ["<leader>kf"] = {
      ":split | execute 'terminal mix test ' . expand('%') | resize 15<cr>",
      desc = "mix test file"
    },
    ["<leader>kn"] = {
      ":let LineNumber=line('.') | split | execute 'terminal mix test ' . expand('%') . ':' . LineNumber | resize 15<cr>",
      desc = "mix test nearest"
    },
    ["<leader>kw"] = {
      ":split | execute \"terminal fswatch -r -i '\\.ex$\' -i '\\.exs$' -e '.*' . | mix test --listen-on-stdin --stale\" | resize 15<cr>",
      desc = "mix test watch"
    },
    ["<leader>kp"] = {
      ":let LineNumber=line('.') | split | execute 'terminal iex -S mix test --trace ' . expand('%') . ':' . LineNumber | resize 15<cr>",
      desc = "mix test iex trace"
    }
    -- quick save
    -- ["<C-s>"] = { ":w!<cr>", desc = "Save File" },  -- change description but the same command
  },
  t = {
    -- setting a mapping to false will disable it
    -- ["<esc>"] = false,
  },
}
