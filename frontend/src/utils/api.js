import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}/api`
  : (import.meta.env.VITE_API_BASE_URL || '/api')

export const api = axios.create({ baseURL: API_URL, timeout: 60000 })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('piq_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('piq_token')
      localStorage.removeItem('piq_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
