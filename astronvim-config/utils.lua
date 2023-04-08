local M = {}

function M.mix_format_on_save()
  if vim.bo.filetype == 'elixir' then
    vim.cmd('silent !mix format %')
    vim.cmd('e') -- Reload the buffer to apply the changes made by mix format
  end
end

return M
