import axios from "axios";

// Default to the env variable. If not set, it will be undefined, and axios will use relative path.
const basePath = import.meta.env.VITE_API_BASE_URL;

// Create an Axios instance pointing to the API URL.
export const api = axios.create({
  baseURL: basePath ? `${basePath}/api/v1` : "/api/v1",
});

// Interceptor to attach the token to all outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fallback logic on API errors (like 401s to auto-logout) can be added here
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if we are unauthorized.
      // Depending on setup, maybe redirect to login page.
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export interface StreamCallbacks {
  onToken: (text: string) => void
  onMetadata: (meta: Record<string, unknown>) => void
  onDone: () => void
  onError: (message: string) => void
}

export function askAgentStream(
  agentId: string,
  question: string,
  reportId: string,
  callbacks: StreamCallbacks,
  conversationId?: string,
  history?: { role: string; content: string }[],
  signal?: AbortSignal,
): void {
  const baseURL = basePath ? `${basePath}/api/v1` : "/api/v1"
  const token = localStorage.getItem("token")
  const url = `${baseURL}/agents/${agentId}/chat?stream=true`

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      question,
      report_id: reportId,
      conversation_id: conversationId,
      history,
    }),
    signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        callbacks.onError(`Request failed with status ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError("No readable stream")
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        while (buffer.includes("\n\n")) {
          const idx = buffer.indexOf("\n\n")
          const block = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)

          let eventType = ""
          let data = ""
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7)
            else if (line.startsWith("data: ")) data = line.slice(6)
          }

          if (!eventType || !data) continue

          try {
            const parsed = JSON.parse(data)
            switch (eventType) {
              case "token":
                callbacks.onToken(parsed.text ?? "")
                break
              case "metadata":
                callbacks.onMetadata(parsed)
                break
              case "done":
                callbacks.onDone()
                break
              case "error":
                callbacks.onError(parsed.message ?? "Unknown error")
                break
            }
          } catch {
            // skip malformed events
          }
        }
      }
    })
    .catch((err) => {
      if (err.name === "AbortError") return
      callbacks.onError(err.message ?? "Stream failed")
    })
}

export async function askAgent(
  agentId: string,
  question: string,
  reportId: string,
  conversationId?: string,
  history?: { role: string; content: string }[],
) {
  const res = await api.post(`/agents/${agentId}/chat`, {
    question,
    report_id: reportId,
    conversation_id: conversationId,
    history,
  })
  return res.data as {
    reply: string
    format: string
    conversation_id: string
    metadata?: { sources?: string[]; confidence?: number; [key: string]: unknown }
  }
}
