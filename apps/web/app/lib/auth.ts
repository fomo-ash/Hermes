export const apiFetch = async ( url: string, options: RequestInit={})=> {

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const cleanUrl = url.startsWith("http") ? url : `{baseUrl}${url}`

    return fetch(cleanUrl, {
      ...options,
      credentials: "include", // CRITICAL: Propagates JWT cookie to Express
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
}