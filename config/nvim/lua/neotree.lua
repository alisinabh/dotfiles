require('neo-tree').setup({
  auto_clean_after_session_restore = true,
  close_if_last_window = true,
  filesystem = {
    follow_current_file = { enabled = true },
    hijack_netrw_behavior = "open_current",
    use_libuv_file_watcher = true,
  },
  window = {
    position = "right",
    width = 32,
  }
})
