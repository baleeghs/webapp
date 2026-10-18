//! Compiles `server/proto/**/*.proto` with protox (pure Rust, no `protoc` install needed) and
//! generates prost messages plus tonic server and client code. Also writes the encoded file
//! descriptor set used by gRPC server reflection.

use std::{env, error::Error, path::PathBuf};

const PROTO_ROOT: &str = "../../proto";
const PROTOS: &[&str] = &["app/v1/notes.proto"];

fn main() -> Result<(), Box<dyn Error>> {
    println!("cargo:rerun-if-changed={PROTO_ROOT}");

    let mut compiler = protox::Compiler::new([PROTO_ROOT])?;
    compiler.include_imports(true).include_source_info(true);
    compiler.open_files(PROTOS)?;

    let out_dir = PathBuf::from(env::var("OUT_DIR")?);
    std::fs::write(out_dir.join("descriptor.bin"), compiler.encode_file_descriptor_set())?;

    tonic_prost_build::configure().build_server(true).build_client(true).compile_fds(compiler.file_descriptor_set())?;
    Ok(())
}
