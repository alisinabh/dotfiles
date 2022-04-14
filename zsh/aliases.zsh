# reload zsh config
alias reload!='RELOAD=1 source ~/.zshrc'

# Detect which `ls` flavor is in use
if ls --color > /dev/null 2>&1; then # GNU `ls`
    colorflag="--color"
else # macOS `ls`
    colorflag="-G"
fi

# use nvim, but don't make me think about it
alias vim="nvim"

# Filesystem aliases
alias ..='cd ..'
alias ...='cd ../..'
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias ~="cd ~/"

alias l="ls -F ${colorflag}"
alias la="ls -AF ${colorflag}"
alias ll="ls -lah ${colorflag}"
alias lld="ls -l | grep ^d"
alias rmf="rm -rf"

# Helpers
alias grep='grep --color=auto'
alias df='df -h' # disk free, in Gigabytes, not bytes
alias du='du -h -c' # calculate disk usage for a folder
alias du1='du -d1 -h -c | sort -hr'

# Flush Directory Service cache
alias flush="dscacheutil -flushcache"

# View HTTP traffic
alias sniff="sudo ngrep -d 'en1' -t '^(GET|POST) ' 'tcp and port 80'"
alias httpdump="sudo tcpdump -i en1 -n -s 0 -w - | grep -a -o -E \"Host\: .*|GET \/.*\""

# Trim new lines and copy to clipboard
alias trimcopy="tr -d '\n' | pbcopy"

# remove broken symlinks
alias clsym="find -L . -name . -o -type d -prune -o -type l -exec rm {} +"

# File size
alias fs="stat -f \"%z bytes\""

# ROT13-encode text. Works for decoding, too! ;)
alias rot13='tr a-zA-Z n-za-mN-ZA-M'

alias pcat='pygmentize -f terminal256 -O style=native -g'

# the fcuk alias :D
alias fuck='echo "OKAAAAAY! OKAAAAY!! I will do it!" && sleep 0.3 && sudo $(fc -ln -1)'

alias axel='axel -n 16 -a'
alias px=proxychains
alias v='nvim'
alias vim='nvim'

# Kubernetes
alias kgp='kubectl get pod'
alias kgs='kubectl get service'
alias kg='kubectl get'
alias k='kubectl'


if [[ "$TERM" == "xterm-kitty" ]]; then
  alias ssh="kitty +kitten ssh"
fi

alias pg10docker='docker run -d --rm --name pgdocker -p5432:5432 -e POSTGRES_PASSWORD=password -v ~/.tmp_data/pg10:/var/lib/postgresql/data postgres:10.6'
alias pg11docker='docker run -d --rm --name pgdocker -p5432:5432 -e POSTGRES_PASSWORD=password -v ~/.tmp_data/pg11:/var/lib/postgresql/data postgres:11'
alias pg12docker='docker run -d --rm --name pgdocker -p5432:5432 -e POSTGRES_PASSWORD=password -v ~/.tmp_data/pg12:/var/lib/postgresql/data postgres:12'
alias pg13docker='docker run -d --rm --name pgdocker -p5432:5432 -e POSTGRES_PASSWORD=password -v ~/.tmp_data/pg13:/var/lib/postgresql/data postgres:13'
alias pgkilldocker='docker kill pgdocker'

# The saviour command
alias del='mv -t /tmp $@'
# give up the bad habbit
alias rm='echo "you should use del command to remove your files safely. if you really want rm back use /bin/rm"'

alias be='bundle exec'
alias rspec='bundle exec rspec'
