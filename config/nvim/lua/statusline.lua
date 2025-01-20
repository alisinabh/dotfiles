require('lualine').setup {
  options = {
    theme = 'ayu_mirage',
    component_separators = '',
    section_separators = { left = '', right = '' },
    always_show_tabline = false,
  },
  sections = {
    lualine_a = {
      { 'mode', right_padding = 2 },
    },
    lualine_b = { 'filename', 'branch' },
    lualine_c = { 'diff' },
    lualine_x = {},
    lualine_y = {
      {
        'diagnostics',
        always_visible = false
      },
      'filetype',
    },
    lualine_z = {
      'progress',
      { 'location', left_padding = 2 },
    },
  },
  inactive_sections = {
    lualine_a = { 'filename' },
    lualine_b = {},
    lualine_c = {},
    lualine_x = {},
    lualine_y = {},
    lualine_z = { 'location' },
  },
  tabline = {
    lualine_c = {
      {
        'tabs',
        cond = function()
          return #vim.fn.gettabinfo() > 1
        end,
        mode = 2,
        use_mode_colors = true,
        tabs_color = {
          -- Same values as the general color option can be used here.
          active = { fg = '#45afd6' },   -- Color for active tab.
          inactive = { fg = '#246780' }, -- Color for inactive tab.

        },
        show_modified_status = true
      }
    },
  },
  extensions = { 'neo-tree', 'quickfix' },
}
