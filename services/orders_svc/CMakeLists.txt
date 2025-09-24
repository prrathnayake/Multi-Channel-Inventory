cmake_minimum_required(VERSION 3.22)
project(orders_svc LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)

find_package(Protobuf REQUIRED)
find_package(gRPC REQUIRED)
find_package(libpqxx REQUIRED)
find_package(redis++ REQUIRED)
find_package(RdKafka REQUIRED)
find_package(spdlog REQUIRED)

set(PROTO_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../proto)
set(GOOGLEAPIS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../third_party/googleapis)
set(PROTOS ${PROTO_DIR}/orders.proto)

set(PROTO_IMPORT_DIRS ${PROTO_DIR} ${GOOGLEAPIS_DIR})
include_directories(${CMAKE_CURRENT_BINARY_DIR})

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${PROTOS}
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
  IMPORT_DIRS ${PROTO_IMPORT_DIRS}
)
grpc_generate_cpp(GRPC_SRCS GRPC_HDRS ${PROTOS}
  PROTOC_OUT_DIR ${CMAKE_CURRENT_BINARY_DIR}
  IMPORT_DIRS ${PROTO_IMPORT_DIRS}
)

add_executable(orders_svc
  src/main.cpp
  ${PROTO_SRCS} ${GRPC_SRCS}
)
target_include_directories(orders_svc PRIVATE ${PROTO_DIR})
target_link_libraries(orders_svc
  PRIVATE gRPC::grpc++ protobuf::libprotobuf pqxx redis++ rdkafka++ spdlog::spdlog
)
