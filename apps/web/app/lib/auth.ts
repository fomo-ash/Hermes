const BASE_URL = process.env.API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export const api = {
  async request(endpoint: string, options: RequestOptions = {}) {
    let url = `${BASE_URL}${endpoint}`;
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: "include", // Required to forward HTTP-only cookies to port 8000
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: errorData.error || "A network error occurred",
      };
    }

    return response.json();
  },

  get(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request(endpoint, { ...options, method: "GET" });
  },

  post(
    endpoint: string,
    body?: any,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
