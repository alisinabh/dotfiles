-- Key bindings remap
local wk = require("which-key")
local telescope = require("telescope")
local telescope_builtin = require('telescope.builtin')
local comment = require('Comment.api')

wk.add({
  -- Find
  { "<leader>ff",    telescope_builtin.git_files,                                                        desc = "Files (git)" },
  { "<leader>fF",    telescope_builtin.find_files,                                                       desc = "Files" },
  { "<leader>fw",    telescope_builtin.live_grep,                                                        desc = "Live Grep" },
  { "<leader>fW",    require("telescope").extensions.live_grep_args.live_grep_args,                      desc = "Live Grep (args)" },
  { "<leader>fc",    telescope_builtin.grep_string,                                                      desc = "Live Grep Cursor Word" },
  { "<leader>fy",    "<cmd>let @+ = fnamemodify(expand('%'), ':~:.')<cr>",                               desc = "Copy relative path" },
  { "<leader>fh",    telescope_builtin.help_tags,                                                        desc = "Help Tags" },

  -- Buffer
  { "<leader>bn",    "<cmd>tabnew<cr>",                                                                  desc = "New tab" },
  { "<leader>bb",    telescope_builtin.buffers,                                                          desc = "Buffers" },

  -- Git
  { "<leader>gs",    vim.cmd.Git,                                                                        desc = "Git Status" },
  { "<leader>gl",    function() vim.cmd.Git("log --oneline -100") end,                                   desc = "Git Log" },
  { "<leader>gf",    function() vim.cmd.Git("fetch") end,                                                desc = "Git Fetch" },
  { "<leader>gp",    function() vim.cmd.Git("push") end,                                                 desc = "Git Push" },
  { "<leader>gP",    function() vim.cmd.Git("push --force-with-lease") end,                              desc = "Git Push (Force)" },
  { "<leader>gb",    telescope_builtin.git_branches,                                                     desc = "Git Branches" },
  { "<leader>gd",    function() vim.cmd.Gitsigns("diffthis") end,                                        desc = "Git Diff File" },
  { "<leader>gC",    function() vim.cmd.Gitsigns("toggle_current_line_blame") end,                       desc = "Line Blame Toggle" },

  -- LSP
  { "<leader>lR",    vim.cmd.LspRestart,                                                                 desc = "Restart LSP" },
  { "<leader>lF",    function() require("format-on-save").disable() end,                                 desc = "Disable Auto-format" },
  { "<leader>lf",    function() require("format-on-save").enable() end,                                  desc = "Enable Auto-format" },

  -- Miscellaneous
  { "<leader>c",     vim.cmd.noh,                                                                        desc = "Clear Search Highlight" },
  { "<leader>u",     vim.cmd.UndotreeToggle,                                                             desc = "Toggle Undotree" },
  { "<leader>q",     "<cmd>q<cr>",                                                                       desc = "Quit" },
  { "<leader>Q",     "<cmd>qall<cr>",                                                                    desc = "Quit All" },
  { "<leader>/",     function() comment.toggle.linewise.count(vim.v.count > 0 and vim.v.count or 1) end, desc = "Comment" },
  { "<leader>\\",    "<cmd>vsplit<cr>",                                                                  desc = "Vertical Split" },
  { "<leader>-",     "<cmd>split<cr>",                                                                   desc = "Horizontal Split" },
  { "<leader><Tab>", ":b#<cr>",                                                                          desc = "Toggle Alternate Buffer" },
  { "<leader>e",     "<cmd>Neotree toggle<cr>",                                                          desc = "Toggle Explorer" },
  { "<leader>R",     function() vim.cmd.so("~/.config/nvim/init.lua") end,                               desc = "Reload Config" },
})

-- Move chunk with J and K in visual mode
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- Keep cursor on position instead of EOL on J
vim.keymap.set("n", "J", "mzJ`z")

-- Comment in visual mode
vim.keymap.set("v", "<leader>/", "<esc><cmd>lua require('Comment.api').toggle.linewise(vim.fn.visualmode())<cr>", {})

-- Move between panes
vim.keymap.set("n", "<C-h>", function() require("smart-splits").move_cursor_left() end, {})
vim.keymap.set("n", "<C-j>", function() require("smart-splits").move_cursor_down() end, {})
vim.keymap.set("n", "<C-k>", function() require("smart-splits").move_cursor_up() end, {})
vim.keymap.set("n", "<C-l>", function() require("smart-splits").move_cursor_right() end, {})

-- Move between tabs
vim.keymap.set("n", "<C-[>", "gT", {})
vim.keymap.set("n", "<C-]>", "gt", {})
