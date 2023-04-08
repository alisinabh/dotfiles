local utils = require "user.utils"

vim.api.nvim_create_autocmd('BufWritePost', {
  callback = utils.mix_format_on_save
})
