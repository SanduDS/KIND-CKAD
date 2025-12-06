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

# Custom prompt
RUN echo 'export PS1="\\[\\033[1;32m\\]ckad\\[\\033[0m\\]@\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ "' >> /root/.bashrc

# Welcome message
RUN echo 'echo "🎯 Welcome to CKAD Practice Environment!"' >> /root/.bashrc \
    && echo 'echo "   kubectl is ready to use."' >> /root/.bashrc \
    && echo 'echo "   Type k9s for a TUI experience."' >> /root/.bashrc \
    && echo 'echo ""' >> /root/.bashrc

# Environment variables
ENV TERM=xterm-256color
ENV KUBECONFIG=/root/.kube/config

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Keep container running
CMD ["sleep", "infinity"]



