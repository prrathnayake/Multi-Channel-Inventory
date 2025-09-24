cmake_minimum_required(VERSION 3.22)
project(inventory_svc LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)

find_package(Protobuf REQUIRED)
find_package(gRPC REQUIRED)
find_package(libpqxx REQUIRED)
find_package(redis++ REQUIRED)
find_package(RdKafka REQUIRED)
find_package(spdlog REQUIRED)

include_directories(../../proto)

add_executable(inventory_svc
  src/main.cpp
)

target_link_libraries(inventory_svc
  PRIVATE gRPC::grpc++ protobuf::libprotobuf pqxx redis++ rdkafka++ spdlog::spdlog
)
