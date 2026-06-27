import { Request, Response, NextFunction } from "express";

export interface ConsumeResult {
    allowed: boolean;
    remainingTokens: number;
    retryAfter: number;
}

export interface TokenBucketOptions {
    capacity: number;
    refillRate: number;
}

export class TokenBucket {
    private tokens: number;
    private lastUpdated: number;

    private readonly capacity: number;
    private readonly refillRate: number;

    constructor(options: TokenBucketOptions) {
        this.capacity = options.capacity;
        this.refillRate = options.refillRate;

        this.tokens = this.capacity;
        this.lastUpdated = Date.now();
    }

    private refill(now: number): void {
        const elapsedSeconds = (now - this.lastUpdated) / 1000;

        const regeneratedTokens = elapsedSeconds * this.refillRate;

        this.tokens = Math.min(
            this.capacity,
            this.tokens + regeneratedTokens
        );

        this.lastUpdated = now;
    }

    consume(now = Date.now()): ConsumeResult {
        this.refill(now);

        if (this.tokens >= 1) {
            this.tokens--;

            return {
                allowed: true,
                remainingTokens: Math.floor(this.tokens),
                retryAfter: 0,
            };
        }

        const retryAfter = Math.ceil(
            (1 - this.tokens) / this.refillRate
        );

        return {
            allowed: false,
            remainingTokens: 0,
            retryAfter,
        };
    }

    reset(): void {
        this.tokens = this.capacity;
        this.lastUpdated = Date.now();
    }

    getRemainingTokens(): number {
        return Math.floor(this.tokens);
    }

    getCapacity(): number {
        return this.capacity;
    }

    getLastUpdated(): number {
        return this.lastUpdated;
    }
}

// Registry to track buckets per IP address
const ipBuckets = new Map<string, TokenBucket>();

// Automatically clean up inactive buckets every 10 minutes to prevent memory leaks
const INACTIVE_LIMIT = 10 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of ipBuckets.entries()) {
        if (now - bucket.getLastUpdated() > INACTIVE_LIMIT) {
            ipBuckets.delete(ip);
        }
    }
}, INACTIVE_LIMIT);

/**

  @param options TokenBucketOptions containing capacity and refillRate
  @param message Custom message returned when rate limited
**/
export const rateLimit = (options: TokenBucketOptions, message = "Too many requests. Please slow down.") => {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";

        if (!ipBuckets.has(ip)) {
            ipBuckets.set(ip, new TokenBucket(options));
        }

        const bucket = ipBuckets.get(ip)!;
        const result = bucket.consume();

        res.setHeader("X-RateLimit-Limit", bucket.getCapacity());
        res.setHeader("X-RateLimit-Remaining", result.remainingTokens);

        if (result.allowed) {
            return next();
        }

        // Set retry headers
        res.setHeader("Retry-After", result.retryAfter);

        return res.status(429).json({
            success: false,
            message,
            retryAfter: result.retryAfter,
        });
    };
};
