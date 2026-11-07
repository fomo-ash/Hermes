import { NodeSDK } from "@opentelemetry/sdk-node";
import { env } from "../config/env";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const serviceName = env.OTEL_SERVICE_NAME ?? "hermes-api";
const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";

// Only activate if explicitly enabled or if an endpoint is provided
const isEnabled = env.ENABLE_OTEL ?? !!env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;

if (isEnabled) {
  const headers: Record<string, string> = {};
  if (env.SIGNOZ_INGESTION_KEY) {
    headers["signoz-access-token"] = env.SIGNOZ_INGESTION_KEY;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
    headers,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": serviceName,
      "service.namespace": "hermes",
      "deployment.environment": env.NODE_ENV ?? "development",
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs tracing
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  try {
    sdk.start();
    console.log(
      `[OpenTelemetry] Initialized for ${serviceName} -> ${endpoint}`,
    );
  } catch (error) {
    console.error("[OpenTelemetry] Failed to initialize SDK:", error);
  }
} else {
  console.log(
    `[OpenTelemetry] Inactive (Set ENABLE_OTEL=true in .env to activate)`,
  );
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log("[OpenTelemetry] Shutdown complete");
  }
}
