import axios from 'axios';

const BASE_URL = '/api/'; 

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach Bearer token if available
export const setAuthToken = (token) => {
  if (token) {
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
};

export const removeAuthToken = () => {
  delete axiosInstance.defaults.headers.common['Authorization'];
};

// Response interceptor: handle 401 by trying to refresh token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      throw error;
    }

    // Prevent multiple refresh loops
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        })
        .catch((err) => {
          throw err;
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Attempt to refresh the access token using the HttpOnly cookie
      const refreshResponse = await axios.post(
        '/api/token/refresh/',
        {},
        { withCredentials: true }
      );
      const { access } = refreshResponse.data;

      // Update the token in memory and in default headers
      setAuthToken(access);

      // Retry all queued requests
      processQueue(null, access);

      // Retry the original request with new token
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      removeAuthToken();
      window.dispatchEvent(new Event('auth:logout'));
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }
);