Drop the `third_party/googleapis` folder into your project root so you have:
  third_party/googleapis/google/api/annotations.proto
  third_party/googleapis/google/api/http.proto

Then run protoc with both include paths:
  protoc -I=proto -I=third_party/googleapis --include_imports --include_source_info         --descriptor_set_out=proto/descriptors.pb proto/*.proto
