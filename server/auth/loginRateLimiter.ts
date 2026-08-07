interface LoginAttemptState {
  failures: number[];
  blockedUntil: number;
}

export interface LoginRateLimitConfig {
  maxFailures: number;
  windowMs: number;
  blockMs: number;
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, LoginAttemptState>();

  constructor(private readonly config: LoginRateLimitConfig) {}

  getRetryAfterSeconds(key: string): number {
    const state = this.attempts.get(key);
    if (!state || state.blockedUntil <= Date.now()) {
      return 0;
    }
    return Math.ceil((state.blockedUntil - Date.now()) / 1_000);
  }

  registerFailure(key: string): void {
    const now = Date.now();
    const state = this.attempts.get(key) ?? {
      failures: [],
      blockedUntil: 0,
    };
    state.failures = state.failures.filter(
      (timestamp) => now - timestamp < this.config.windowMs,
    );
    state.failures.push(now);

    if (state.failures.length >= this.config.maxFailures) {
      state.blockedUntil = now + this.config.blockMs;
      state.failures = [];
    }

    this.attempts.set(key, state);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}
