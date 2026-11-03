import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send cookies with requests
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // OAuth endpoints answer in the RFC 6749 shape, the rest of the API with `message`.
    const data = error.response?.data
    const message = data?.message || data?.error_description || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

export default api
