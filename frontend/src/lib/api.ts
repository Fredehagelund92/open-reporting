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
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
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
