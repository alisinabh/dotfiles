-- Key bindings remap
local wk = require("which-key")
local telescope_builtin = require('telescope.builtin')
local comment = require('Comment.api')

wk.register({
  s = {
    name = "Search",
    f = { telescope_builtin.git_files, "Files (git)" },
    F = { telescope_builtin.find_files, "Files" },
    w = { telescope_builtin.live_grep, "Live Grep" },
    c = { telescope_builtin.grep_string, "Live Grep Cursor Word" },
    h = { telescope_builtin.help_tags, "Help Tags" }
  },
  b = {
    name = "Buffer",
    n = { "<cmd>tabnew<cr>", "New tab" },
    b = { telescope_builtin.buffers, "Buffers" },
  },
  g = {
    name = "Git",
    s = { vim.cmd.Git, "Git Status" },
    l = { function() vim.cmd.Git 'log --oneline -100' end, "Git Log" },
    f = { function() vim.cmd.Git 'fetch' end, "Git Fetch" },
    p = { function() vim.cmd.Git 'push' end, "Git Push" },
    P = { function() vim.cmd.Git 'push --force-with-lease' end, "Git Push (Force)" },
    b = { telescope_builtin.git_branches, "Git Branches" },
    d = { function() vim.cmd.Gitsigns 'diffthis' end, "Git diff file" },
    C = { function() vim.cmd.Gitsigns 'toggle_current_line_blame' end, "Line blame toggle" },
  },
  l = {
    name = "LSP",
    R = { vim.cmd.LspRestart, "Restart LSP" },
    F = { function() require("format-on-save").disable() end, "Disable auto-format" },
    f = { function() require("format-on-save").enable() end, "Enable auto-format" },
  },
  u = { vim.cmd.UndotreeToggle, "Toggle Undotree" },
  q = { "<cmd>q<cr>", "Quit" },
  Q = { "<cmd>qall<cr>", "Quit" },
  ['/'] = { function() require("Comment.api").toggle.linewise.count(vim.v.count > 0 and vim.v.count or 1) end, "Comment" },
  ['\\'] = { "<cmd>vsplit<cr>", "Vertical Split" },
  ["-"] = { "<cmd>split<cr>", "Horizontal Split" },
  ["<Tab>"] = { ":b#<cr>", "toggle alternate buffer" },
  e = { "<cmd>Neotree toggle<cr>", "Toggle Explorer" },
}, { prefix = "<leader>" })

-- Move chunk with J and K in visual mode
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

vim.keymap.set("n", "J", "mzJ`z")

vim.keymap.set("v", "<leader>/", "<esc><cmd>lua require('Comment.api').toggle.linewise(vim.fn.visualmode())<cr>", {})

vim.keymap.set("n", "<C-h>", function() require("smart-splits").move_cursor_left() end, {})
vim.keymap.set("n", "<C-j>", function() require("smart-splits").move_cursor_down() end, {})
vim.keymap.set("n", "<C-k>", function() require("smart-splits").move_cursor_up() end, {})
vim.keymap.set("n", "<C-l>", function() require("smart-splits").move_cursor_right() end, {})

vim.keymap.set("n", "<C-[>", "gT", {})
vim.keymap.set("n", "<C-]>", "gt", {})
