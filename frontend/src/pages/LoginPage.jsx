import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'
import { Search, Eye, EyeOff, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [form, setForm] = useState({ email: 'admin@healthstaff.com', password: 'Admin@2024' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const nav = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      nav('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 border border-white/20">
            <Search className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Provider<span className="text-teal-400">IQ</span></h1>
          <p className="text-brand-200 mt-2 text-sm">Enterprise Healthcare ATS Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sign in to your workspace</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="input" required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input pr-10" required />
                <button type="button" onClick={() => setShow(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
              {loading ? <span className="spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Demo Accounts</p>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex gap-2"><span className="font-semibold w-20">Admin:</span><span>admin@healthstaff.com / Admin@2024</span></div>
              <div className="flex gap-2"><span className="font-semibold w-20">Recruiter:</span><span>sarah@healthstaff.com / Recruiter@2024</span></div>
              <div className="flex gap-2"><span className="font-semibold w-20">Manager:</span><span>manager@healthstaff.com / Recruiter@2024</span></div>
            </div>
          </div>
        </div>

        <p className="text-center text-brand-300 text-xs mt-6">ProviderIQ v2.0 — Enterprise ATS for Healthcare Staffing</p>
      </div>
    </div>
  )
}
