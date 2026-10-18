//! Generated protobuf and gRPC code. Edit the `.proto` files in `server/proto`, never this crate's
//! output. Each proto package becomes a nested module: `app.v1` → [`app::v1`].

#[allow(clippy::all, clippy::pedantic, unused_qualifications, missing_debug_implementations)]
pub mod app {
    pub mod v1 {
        tonic::include_proto!("app.v1");
    }
}

/// Encoded `FileDescriptorSet` of every compiled proto, for gRPC server reflection.
pub const FILE_DESCRIPTOR_SET: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/descriptor.bin"));
