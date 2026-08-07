interface SessionResponse {
  authenticated: boolean;
}

interface ApiErrorBody {
  error?: string;
}

export class TeacherSetupApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TeacherSetupApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new TeacherSetupApiError(
      body?.error ?? "The Teacher Setup request could not be completed.",
      response.status,
    );
  }

  return (await response.json()) as T;
}

export class TeacherSetupApi {
  constructor(private readonly apiBaseUrl = "") {}

  async getSession(signal?: AbortSignal): Promise<boolean> {
    const response = await fetch(`${this.apiBaseUrl}/api/setup/session`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal,
    });
    const session = await parseResponse<SessionResponse>(response);
    return session.authenticated;
  }

  async login(password: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/setup/login`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
      signal,
    });
    await parseResponse<SessionResponse>(response);
  }

  async logout(signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/setup/logout`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal,
    });
    await parseResponse<SessionResponse>(response);
  }
}
