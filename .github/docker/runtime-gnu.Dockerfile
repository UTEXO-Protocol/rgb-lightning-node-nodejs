FROM rust:1.94.0-slim-bookworm AS rust
FROM ubuntu:22.04

ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils build-essential cmake clang libclang-dev \
    pkg-config libssl-dev git perl binutils && rm -rf /var/lib/apt/lists/*
COPY --from=rust /usr/local/rustup /usr/local/rustup
COPY --from=rust /usr/local/cargo /usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo
ENV PATH=/usr/local/cargo/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN test "$(rustc --version | cut -d ' ' -f 2)" = 1.94.0
RUN set -eu; \
    case "$TARGETARCH" in arm64) node_arch=arm64;; amd64) node_arch=x64;; *) exit 1;; esac; \
    file="node-v22.23.0-linux-${node_arch}.tar.xz"; \
    curl -fsSLO "https://nodejs.org/dist/v22.23.0/$file"; \
    curl -fsSLo sums.txt https://nodejs.org/dist/v22.23.0/SHASUMS256.txt; \
    grep "  $file\$" sums.txt | sha256sum -c -; \
    tar -xJf "$file" --strip-components=1 -C /usr/local; \
    rm "$file" sums.txt; \
    test "$(node --version)" = v22.23.0
WORKDIR /candidate
