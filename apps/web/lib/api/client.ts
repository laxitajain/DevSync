import { useAuthStore } from "../store/auth-store";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

// De-dupe concurrent refreshes: many queries can 401 at once on token expiry,
// but only one refresh call should hit the server.
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });

        if (!res.ok) {
          useAuthStore.getState().clear();
          return false;
        }

        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        useAuthStore.getState().setTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function extractError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const data = await res.json();
    const raw = data?.error ?? data;
    if (typeof raw === "string") {
      message = raw;
    } else if (raw?.message) {
      message = Array.isArray(raw.message) ? raw.message.join(", ") : raw.message;
    }
  } catch {
    // keep statusText
  }
  return new ApiError(res.status, message);
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  allowRetry = true
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (res.status === 401 && allowRetry && options.auth !== false) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!res.ok) {
    throw await extractError(res);
  }

  if (res.status === 204) {
    return null as T;
  }

  return (await res.json()) as T;
}
