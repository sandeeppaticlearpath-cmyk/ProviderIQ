import { create } from 'zustand'
import api from '../utils/api'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('piq_user') || 'null'),
  token: localStorage.getItem('piq_token') || null,
  apiKey: localStorage.getItem('piq_api_key') || '',
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('piq_token', data.token)
    localStorage.setItem('piq_user', JSON.stringify(data.user))
    set({ user: data.user, token: data.token })
    return data.user
  },
  logout: () => {
    localStorage.removeItem('piq_token')
    localStorage.removeItem('piq_user')
    set({ user: null, token: null })
  },
  setApiKey: (key) => {
    localStorage.setItem('piq_api_key', key)
    set({ apiKey: key })
  },
}))

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  globalSearch: '',
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setGlobalSearch: (v) => set({ globalSearch: v }),
}))
