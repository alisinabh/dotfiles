-- Custom Filetypes
vim.filetype.add({
  extension = {
    handlebars = "glimmer", -- Maps .handlebars files to glimmer filetype
  },
  pattern = {
    ["Dockerfile%..*"] = "dockerfile",
    [".env%..*"] = "sh", -- Handle files like .env.local, .env.dev, etc.
  },
})
