import { trace, SpanStatusCode } from "@opentelemetry/api";

export const tracer = trace.getTracer(
    "hermes-api",
    "1.0.0"
);

export async function withSpan<T>(
    spanName: string,
    operation: () => Promise<T>
): Promise<T> {
    return tracer.startActiveSpan(spanName, async (span) => {
        try {
            return await operation();
        } catch (error) {
            span.recordException(
                error instanceof Error
                    ? error
                    : new Error(String(error))
            );

            span.setStatus({
                code: SpanStatusCode.ERROR,
            });

            throw error;
        } finally {
            span.end();
        }
    });
}