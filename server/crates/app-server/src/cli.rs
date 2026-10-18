use clap::{Args, Parser, Subcommand};
use figment::{Figment, providers::Serialized};

/// App server. Configuration comes from defaults, then `APP_*` environment variables (see
/// `.env.example`), then these flags: a flag wins over the environment.
#[derive(Debug, Parser)]
#[command(version, about)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,

    #[command(flatten)]
    pub overrides: ConfigOverrides,
}

#[derive(Debug, Default, Subcommand)]
pub enum Command {
    /// Run the HTTP and gRPC servers (default).
    #[default]
    Serve,
    /// Apply pending database migrations and exit.
    Migrate,
    /// Print the OpenAPI document as YAML.
    Openapi,
}

/// Run-time overrides for individual settings. `global` lets them go before or after the
/// subcommand: `app-server --http-port 8443` and `app-server serve --http-port 8443` both work.
#[derive(Debug, Default, Args)]
pub struct ConfigOverrides {
    #[arg(long, global = true, value_name = "PORT", help = "HTTP port [env: APP_HTTP__PORT, default: 8080]")]
    pub http_port: Option<u16>,

    #[arg(long, global = true, value_name = "PORT", help = "gRPC port [env: APP_GRPC__PORT, default: 50052]")]
    pub grpc_port: Option<u16>,
}

impl ConfigOverrides {
    /// Layers the given flags on top of `figment`. Add a flag here and in the struct above for
    /// any other setting that should be overridable from the command line.
    pub fn apply(&self, mut figment: Figment) -> Figment {
        if let Some(port) = self.http_port {
            figment = figment.merge(Serialized::default("http.port", port));
        }
        if let Some(port) = self.grpc_port {
            figment = figment.merge(Serialized::default("grpc.port", port));
        }
        figment
    }
}

#[cfg(test)]
mod tests {
    use app_common::AppConfig;

    use super::*;

    fn load(args: &[&str]) -> AppConfig {
        let cli = Cli::try_parse_from(args).expect("valid arguments");
        AppConfig::from_figment(&cli.overrides.apply(Figment::from(Serialized::defaults(AppConfig::default()))))
            .expect("valid config")
    }

    #[test]
    fn ports_can_be_set_before_or_after_the_subcommand() {
        let config = load(&["app-server", "--http-port=8443", "--grpc-port=50051"]);
        assert_eq!((config.http.port, config.grpc.port), (8443, 50051));

        let config = load(&["app-server", "serve", "--http-port", "9000"]);
        assert_eq!((config.http.port, config.grpc.port), (9000, 50052));
    }

    #[test]
    fn flags_win_over_the_environment() {
        let cli = Cli::try_parse_from(["app-server", "--http-port=8443"]).unwrap();
        let env =
            Figment::from(Serialized::defaults(AppConfig::default())).merge(Serialized::default("http.port", 7000));
        let config = AppConfig::from_figment(&cli.overrides.apply(env)).unwrap();
        assert_eq!(config.http.port, 8443);
    }

    #[test]
    fn invalid_ports_are_rejected_by_clap() {
        assert!(Cli::try_parse_from(["app-server", "--http-port=70000"]).is_err());
    }
}
