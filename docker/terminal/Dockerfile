# Terminal Container Dockerfile
# This container provides the kubectl environment for CKAD practice

FROM alpine:3.19

# Install essential tools
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    vim \
    nano \
    jq \
    yq \
    git \
    openssl \
    ca-certificates \
    bind-tools \
    netcat-openbsd \
    httpie \
    tree \
    util-linux

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install helm
RUN curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install k9s (TUI for Kubernetes)
RUN wget -qO- https://github.com/derailed/k9s/releases/latest/download/k9s_Linux_amd64.tar.gz | tar xvz -C /usr/local/bin k9s

# Setup kubectl autocompletion
RUN echo 'source <(kubectl completion bash)' >> /root/.bashrc \
    && echo 'alias k=kubectl' >> /root/.bashrc \
    && echo 'complete -o default -F __start_kubectl k' >> /root/.bashrc

# Create .kube directory
RUN mkdir -p /root/.kube

# Set working directory
WORKDIR /root

# Custom prompt for kubectl practice - clean and simple
RUN echo 'export PS1="\\[\\033[1;32m\\]kubectl\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ "' >> /root/.bashrc

# Enable readline for proper arrow key support and vim compatibility
RUN echo 'set enable-bracketed-paste off' >> /root/.inputrc \
    && echo 'set editing-mode emacs' >> /root/.inputrc \
    && echo 'set keymap emacs' >> /root/.inputrc \
    && echo '"\e[A": history-search-backward' >> /root/.inputrc \
    && echo '"\e[B": history-search-forward' >> /root/.inputrc \
    && echo '"\e[C": forward-char' >> /root/.inputrc \
    && echo '"\e[D": backward-char' >> /root/.inputrc

# Create vim config for better terminal compatibility
RUN echo 'set nocompatible' >> /root/.vimrc \
    && echo 'set backspace=indent,eol,start' >> /root/.vimrc \
    && echo 'set t_Co=256' >> /root/.vimrc \
    && echo 'syntax on' >> /root/.vimrc \
    && echo 'set background=dark' >> /root/.vimrc \
    && echo 'set ttimeoutlen=10' >> /root/.vimrc

# Simple welcome message (questions shown in UI, not terminal)
RUN echo 'echo "🎯 CKAD Practice Terminal"' >> /root/.bashrc \
    && echo 'echo "   Ready for kubectl commands."' >> /root/.bashrc \
    && echo 'echo ""' >> /root/.bashrc

# Environment variables
ENV TERM=xterm-256color
ENV KUBECONFIG=/root/.kube/config

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Keep container running
CMD ["sleep", "infinity"]



