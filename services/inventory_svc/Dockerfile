FROM ubuntu:24.04 AS build
RUN apt-get update && apt-get install -y \
    build-essential cmake git pkg-config libssl-dev curl wget \
    python3 python3-venv pipx

# Conan via pipx
ENV PATH="/root/.local/bin:${PATH}"
RUN pipx install conan==2.3.2
RUN conan remote list || true
RUN conan remote add conancenter https://center.conan.io || true


WORKDIR /src
COPY . /src

# Conan: detect profile, install deps, generate toolchain/deps files into build/
RUN conan profile detect --force
# Use the service folder as the "project" for conan (contains conanfile.txt)
RUN conan install . -o '*:shared=False' -s build_type=Release \
    -of build -b missing

# Configure with generated toolchain, then build
RUN cmake -S . -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake
RUN cmake --build build -j

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y libstdc++6 libgcc-s1 ca-certificates && update-ca-certificates
WORKDIR /app
COPY --from=build /src/build/inventory_svc /app/inventory_svc
EXPOSE 50051
ENV PG_DSN="postgresql://dev:dev@postgres:5432/omnistock"
ENV REDIS_URL="tcp://redis:6379"
CMD ["/app/inventory_svc"]
