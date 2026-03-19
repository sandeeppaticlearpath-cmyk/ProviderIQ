import React, { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useUIStore } from '../../store'
import api from '../../utils/api'
import {
  LayoutDashboard, Users, Briefcase, GitBranch, Mail, Search, Upload,
  BarChart3, BookOpen, Users2, MapPin, PlusCircle, LogOut, Settings,
  ChevronDown, Menu, X, Bell, Zap, Award, ChevronRight, Link2, Star
} from 'lucide-react'

const NAV = [
  { section: 'Overview' },
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics',    icon: BarChart3,        label: 'Analytics' },
  { section: 'Recruiting' },
  { to: '/pipeline',     icon: GitBranch,        label: 'Pipeline',        badge: 'pipeline' },
  { to: '/candidates',   icon: Users,            label: 'Candidates',      badge: 'candidates' },
  { to: '/jobs',         icon: Briefcase,        label: 'Jobs',            badge: 'jobs' },
  { to: '/outreach',     icon: Mail,             label: 'Outreach' },
  { section: 'Sourcing' },
  { to: '/upload',       icon: Upload,           label: 'CV Upload & Parse' },
  { to: '/source',       icon: Zap,              label: 'JD Sourcing' },
  { to: '/providers',    icon: Search,           label: 'Provider Search' },
  { section: 'Team' },
  { to: '/bob',          icon: BookOpen,         label: 'Book of Business' },
  { to: '/manager',      icon: Users2,           label: 'Manager View' },
  { to: '/placements',   icon: Award,            label: 'Placements' },
  { section: 'System' },
  { to: '/integrations', icon: Link2,            label: 'Integrations' },
  { to: '/settings',     icon: Settings,         label: 'Settings' },
]

export default function Layout() {
  const { user, logout, apiKey, setApiKey } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [counts, setCounts] = useState({})
  const [globalQ, setGlobalQ] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const navigate = useNavigate()
  const searchRef = useRef()

  useEffect(() => {
    api.get('/candidates/stats').then(r => setCounts(p => ({ ...p, candidates: r.data.total }))).catch(() => {})
    api.get('/jobs').then(r => setCounts(p => ({ ...p, jobs: r.data.jobs?.filter(j => j.status === 'open').length || 0 }))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!globalQ || globalQ.length < 2) { setSearchRes(null); return }
    const t = setTimeout(() => {
      api.get('/search/global', { params: { q: globalQ } }).then(r => setSearchRes(r.data)).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [globalQ])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}
        style={{ minWidth: sidebarOpen ? 240 : 0 }}>
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-slate-900 text-lg tracking-tight">Provider<span className="text-brand-600">IQ</span></span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto thin-scroll px-2 py-2">
          {NAV.map((item, i) => item.section
            ? <div key={i} className="nav-section-label">{item.section}</div>
            : (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && counts[item.badge] > 0 &&
                  <span className="ml-auto text-xs font-bold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">{counts[item.badge]}</span>
                }
              </NavLink>
            )
          )}
        </nav>

        {/* User & API Key */}
        <div className="border-t border-slate-100 p-3 space-y-2 flex-shrink-0">
          <button onClick={() => setShowKeyModal(true)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${apiKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <Zap className="w-3.5 h-3.5" />
            <span className="flex-1 text-left truncate">{apiKey ? '✓ AI Key Ready' : 'Add AI API Key'}</span>
          </button>
          <div className="relative">
            <button onClick={() => setShowUserMenu(p => !p)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold text-slate-800 truncate">{user?.full_name || user?.email}</div>
                <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                <button onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <hr className="my-1 border-slate-100" />
                <button onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-icon">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          {/* Global search */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={globalQ}
              onChange={e => setGlobalQ(e.target.value)}
              placeholder="Search candidates, jobs, NPI…"
              className="input pl-9 pr-4 h-9 bg-slate-50 border-slate-200"
              onBlur={() => setTimeout(() => setSearchRes(null), 200)}
            />
            {searchRes && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchRes.candidates?.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">Candidates</div>
                    {searchRes.candidates.map(c => (
                      <div key={c.id} onClick={() => { navigate(`/candidates/${c.id}`); setGlobalQ(''); setSearchRes(null); }}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                          {c.full_name?.[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{c.full_name}</div>
                          <div className="text-xs text-slate-400">{c.specialty} · {c.location_state}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {searchRes.jobs?.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase border-t border-slate-100">Jobs</div>
                    {searchRes.jobs.map(j => (
                      <div key={j.id} onClick={() => { navigate(`/jobs/${j.id}`); setGlobalQ(''); setSearchRes(null); }}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{j.title}</div>
                          <div className="text-xs text-slate-400">{j.facility_name}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!searchRes.candidates?.length && !searchRes.jobs?.length && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">No results found</div>
                )}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-icon relative">
              <Bell className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/candidates', { state: { openNew: true } })}
              className="btn-primary btn-sm">
              <PlusCircle className="w-3.5 h-3.5" /> New Candidate
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto thin-scroll">
          <Outlet />
        </main>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Anthropic AI Key</h3>
              <p className="text-sm text-slate-500 mb-4">Used for resume parsing, outreach drafting, JD sourcing, and AI copilot features. Stored locally only.</p>
              <input
                type="password"
                defaultValue={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="input mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowKeyModal(false)} className="btn-primary flex-1">Save Key</button>
                <button onClick={() => { setApiKey(''); setShowKeyModal(false); }} className="btn-secondary">Clear</button>
              </div>
              <p className="text-xs text-slate-400 mt-3">All features work without a key — AI features simply use rule-based fallbacks.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
