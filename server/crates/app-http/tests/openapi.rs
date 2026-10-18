//! Fails when `server/openapi.yaml` no longer matches the annotations. The web app's API types are
//! generated from that file, so a stale copy means the client and server disagree.

#[test]
fn committed_openapi_is_up_to_date() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../openapi.yaml");
    let committed = std::fs::read_to_string(path).unwrap_or_default();
    assert!(
        committed == app_http::openapi::spec_yaml(),
        "server/openapi.yaml is stale: run `make gen-api` and commit the result"
    );
}
