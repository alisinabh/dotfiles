function! customfn#before() abort
    let g:spacevim_wrap_line = 1
    " you can defined mappings in bootstrap function
    " for example, use kj to exit insert mode.
    " inoremap kj <Esc>
endfunction

function! customfn#after() abort
    " you can remove key binding in bootstrap_after function
    " iunmap kj
endfunction
