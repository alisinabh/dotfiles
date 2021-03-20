# git aliases
alias gs='git s'
alias glog="git l"
alias gaacp="git aacp"

function g() {
    if [[ $# > 0 ]]; then
        # if there are arguments, send them to git
        git $@
    else
        # otherwise, run git status
        git s
    fi
}
