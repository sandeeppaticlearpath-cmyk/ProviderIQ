import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import api from '../utils/api'
import { useAuthStore } from '../store'
import { STAGE_HEX, STAGES, STAGE_LABELS, fmtDate, fmtMoney, fmtAgo, downloadCSV, ini } from '../utils/helpers'
import StageBadge from '../components/shared/StageBadge'
import toast from 'react-hot-toast'
import { TrendingUp, Users, Award, BarChart3, RefreshCw, Download, Plus, Edit3, Trash2, X,
  CheckCircle, Link2, Zap, Settings, User, Shield, Bell, Key, ChevronRight, ExternalLink } from 'lucide-react'

// ═══════════════════════════════════════
// ANALYTICS PAGE
// ═══════════════════════════════════════
export function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [period, setPeriod] = useState('90')

  useEffect(() => {
    api.get('/dashboard/analytics').then(r => setData(r.data)).catch(() => {})
    api.get('/dashboard/metrics').then(r => setMetrics(r.data)).catch(() => {})
  }, [period])

  const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4','#f97316','#6366f1']

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm">Performance metrics and pipeline intelligence</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="select text-xs h-8 w-36">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="365">Last 12 months</option>
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Candidates', metrics?.total_candidates ?? '—', 'all time', '#3b82f6'],
          ['In Pipeline', metrics?.in_pipeline ?? '—', 'active', '#8b5cf6'],
          ['Placed (30d)', metrics?.placements_30d ?? '—', 'last 30 days', '#10b981'],
          ['Messages Sent', metrics?.outreach_30d ?? '—', 'last 30 days', '#f59e0b'],
        ].map(([lbl, val, sub, color]) => (
          <div key={lbl} className="card">
            <div className="text-3xl font-black mb-1" style={{ color }}>{val}</div>
            <div className="text-sm font-semibold text-slate-700">{lbl}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly trend */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Monthly Candidate Volume</h3>
          {data?.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.monthly}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
                <Area type="monotone" dataKey="c" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </div>

        {/* Stage breakdown */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Pipeline Stage Distribution</h3>
          {metrics?.pipeline_stages ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={Object.entries(metrics.pipeline_stages).filter(([,v])=>v>0).map(([k,v])=>({name:STAGE_LABELS[k]||k,value:v,fill:STAGE_HEX[k]}))}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                    {Object.entries(metrics.pipeline_stages).filter(([,v])=>v>0).map(([k],i) => <Cell key={i} fill={STAGE_HEX[k]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {Object.entries(metrics.pipeline_stages).filter(([,v])=>v>0).map(([k,v]) => (
                  <div key={k} className="flex flex-col items-center">
                    <div className="font-black text-lg" style={{ color: STAGE_HEX[k] }}>{v}</div>
                    <div className="text-xs text-slate-400 text-center capitalize">{k}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </div>

        {/* Top specialties */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Top Specialties</h3>
          {data?.specialties?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.specialties.slice(0,8)} layout="vertical" barSize={14}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="specialty" width={140} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
                <Bar dataKey="c" fill="#8b5cf6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </div>

        {/* Recruiter performance */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Recruiter Performance</h3>
          {data?.recruiter_performance?.length > 0 ? (
            <div className="space-y-3">
              {data.recruiter_performance.map((r, i) => {
                const conv = r.total > 0 ? Math.round(r.placed / r.total * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                      {(r.name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{r.total} total · {r.placed} placed</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${conv}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-700 w-10 text-right">{conv}%</span>
                  </div>
                )
              })}
            </div>
          ) : <div className="h-40 flex items-center justify-center text-slate-300 text-sm">No recruiter data</div>}
        </div>

        {/* Source mix */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Candidate Source Mix</h3>
          {data?.sources?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.sources.map((s,i)=>({name:s.source||'unknown',value:parseInt(s.c),fill:COLORS[i%COLORS.length]}))}
                  cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value" label={({name,percent})=>`${name} ${Math.round(percent*100)}%`} labelLine={false}>
                  {data.sources.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </div>

        {/* Top states */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Candidates by State</h3>
          {data?.states?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.states.slice(0,10)} barSize={20}>
                <XAxis dataKey="location_state" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
                <Bar dataKey="c" fill="#06b6d4" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// BOB PAGE (Book of Business)
// ═══════════════════════════════════════
export function BOBPage() {
  const nav = useNavigate()
  const [recruiters, setRecruiters] = useState([])
  const [selectedRec, setSelectedRec] = useState('')
  const [data, setData] = useState({ candidates: [], stages: {} })
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ q: '', stage: '' })

  useEffect(() => {
    api.get('/recruiters').then(r => {
      setRecruiters(r.data)
      if (r.data.length > 0) setSelectedRec(r.data[0].user_id || r.data[0].id)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await api.get('/bob', { params: { recruiter_id: selectedRec } })
      setData(d)
    } catch {} finally { setLoading(false) }
  }, [selectedRec])

  useEffect(() => { load() }, [load])

  const stages = data.stages || {}
  const placed = stages.placed || 0
  const total = data.candidates.length
  const conv = total > 0 ? Math.round(placed / total * 100) : 0

  const filtered = data.candidates.filter(c => {
    if (filters.stage && c.stage !== filters.stage) return false
    if (filters.q) { const h = `${c.full_name} ${c.specialty}`.toLowerCase(); if (!h.includes(filters.q.toLowerCase())) return false }
    return true
  })

  const exportBOB = () => {
    downloadCSV(filtered.map(c => ({
      ID: c.candidate_id, Name: c.full_name, Specialty: c.specialty,
      Stage: c.stage, State: c.location_state, Phone: c.phone, Email: c.email, NPI: c.npi
    })), `bob_${new Date().toISOString().slice(0,10)}.csv`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Book of Business</h1>
          <p className="text-slate-500 text-sm">Your personal pipeline and performance view</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportBOB} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /></button>
          <button onClick={load} className="btn-icon"><RefreshCw className={`w-4 h-4 ${loading ? 'spin' : ''}`} /></button>
        </div>
      </div>

      {/* Recruiter selector */}
      <div className="card p-3 flex gap-3 items-center flex-wrap">
        <select value={selectedRec} onChange={e => setSelectedRec(e.target.value)} className="select w-52">
          <option value="">All Recruiters</option>
          {recruiters.map(r => <option key={r.id} value={r.user_id || r.id}>{r.first_name} {r.last_name} ({r.role})</option>)}
        </select>
        <input value={filters.q} onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} placeholder="Search candidates…" className="input flex-1 h-9 min-w-40" />
        <select value={filters.stage} onChange={e => setFilters(p => ({ ...p, stage: e.target.value }))} className="select w-36 h-9">
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Candidates', total, '#3b82f6'],
          ['Active Pipeline', total - (stages.placed||0) - (stages.rejected||0), '#8b5cf6'],
          ['Contacted', stages.contacted||0, '#f59e0b'],
          ['Placed', placed, '#10b981'],
        ].map(([lbl, val, color]) => (
          <div key={lbl} className="card text-center">
            <div className="text-3xl font-black" style={{ color }}>{val}</div>
            <div className="text-sm text-slate-600 mt-1">{lbl}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stage breakdown */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Stage Breakdown</h3>
          <div className="space-y-2.5">
            {STAGES.map((s, i) => {
              const n = stages[s] || 0
              const mx = Math.max(1, ...Object.values(stages))
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="text-xs text-slate-500 w-20 flex-shrink-0 capitalize">{s}</div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${n/mx*100}%`, background: STAGE_HEX[s] }} />
                  </div>
                  <div className="text-xs font-bold text-slate-800 w-5 text-right">{n}</div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-1">Conversion Rate</div>
            <div className="text-2xl font-black text-green-600">{conv}%</div>
            <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${conv}%` }} />
            </div>
          </div>
        </div>

        {/* Candidates table */}
        <div className="lg:col-span-2">
          <div className="table-wrap max-h-[600px] overflow-y-auto thin-scroll">
            <table>
              <thead className="sticky top-0">
                <tr>
                  <th>Candidate</th><th>Specialty</th><th>Stage</th><th>Location</th><th>Phone</th><th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full inline-block" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">No candidates found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/candidates/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">{(c.full_name||'?')[0]}</div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{c.full_name}</div>
                          <div className="text-xs text-slate-400 font-mono">{c.candidate_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{c.specialty||'—'}</td>
                    <td><StageBadge stage={c.stage} /></td>
                    <td className="text-sm text-slate-500">{[c.location_city,c.location_state].filter(Boolean).join(', ')||'—'}</td>
                    <td className="text-sm">{c.phone ? <a href={`tel:${c.phone}`} className="text-brand-600 hover:underline" onClick={e=>e.stopPropagation()}>{c.phone}</a> : '—'}</td>
                    <td className="text-xs text-slate-400">{fmtAgo(c.last_activity||c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// MANAGER PAGE
// ═══════════════════════════════════════
export function ManagerPage() {
  const nav = useNavigate()
  const [data, setData] = useState({ recruiters: [], total_candidates: 0, total_placed: 0 })
  const [loading, setLoading] = useState(true)
  const [recModal, setRecModal] = useState(false)
  const [editRec, setEditRec] = useState(null)
  const [allCands, setAllCands] = useState([])
  const [candFilters, setCandFilters] = useState({ recruiter_id: '', stage: '', q: '' })
  const [candsLoading, setCandsLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data: d } = await api.get('/manager')
      setData(d)
    } catch {} finally { setLoading(false) }
  }

  const loadCands = async () => {
    setCandsLoading(true)
    try {
      const { data } = await api.get('/candidates', { params: { ...candFilters, limit: 100 } })
      setAllCands(data.candidates)
    } catch {} finally { setCandsLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadCands() }, [candFilters])

  const exportTeam = async () => {
    const recMap = data.recruiters.reduce((m, r) => { m[r.user_id || r.id] = `${r.first_name} ${r.last_name}`; return m }, {})
    downloadCSV(allCands.map(c => ({
      Recruiter: recMap[c.assigned_recruiter_id] || 'Unassigned',
      ID: c.candidate_id, Name: c.full_name, Specialty: c.specialty,
      Stage: c.stage, State: c.location_state, Phone: c.phone, Email: c.email, NPI: c.npi,
    })), `team_report_${new Date().toISOString().slice(0,10)}.csv`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Manager Dashboard</h1>
          <p className="text-slate-500 text-sm">Full team visibility and performance tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportTeam} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> Team CSV</button>
          <button onClick={() => { setEditRec(null); setRecModal(true) }} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Recruiter</button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Recruiters', data.recruiters.length, '#3b82f6'],
          ['Total Candidates', data.total_candidates, '#8b5cf6'],
          ['Active Pipeline', data.total_candidates - data.total_placed, '#f59e0b'],
          ['Total Placed', data.total_placed, '#10b981'],
        ].map(([lbl, val, color]) => (
          <div key={lbl} className="card text-center">
            <div className="text-3xl font-black" style={{ color }}>{val}</div>
            <div className="text-sm text-slate-600 mt-1">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Recruiter cards */}
      <div>
        <h2 className="font-bold text-slate-900 text-lg mb-4">Recruiter Performance</h2>
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="spin w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.recruiters.map(r => {
              const conv = r.candidate_count > 0 ? Math.round(r.placements / r.candidate_count * 100) : 0
              const stagesData = r.stages || {}
              return (
                <div key={r.id} className="card hover:shadow-md transition">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                      {ini(r.first_name, r.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">{r.first_name} {r.last_name}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <span className="badge badge-blue capitalize text-xs">{r.role}</span>
                        {r.territory?.length > 0 && r.territory.slice(0,1).map((t,i) => <span key={i} className="badge badge-gray text-xs">{t}</span>)}
                      </div>
                    </div>
                    <button onClick={() => { setEditRec(r); setRecModal(true) }} className="btn-icon flex-shrink-0">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[['Total', r.candidate_count||0, '#64748b'],['Active', r.active||0, '#3b82f6'],['Contacted', stagesData.contacted||0, '#f59e0b'],['Placed', r.placements||0, '#10b981']].map(([lbl, n, color]) => (
                      <div key={lbl} className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="font-black text-base" style={{ color }}>{n}</div>
                        <div className="text-xs text-slate-400">{lbl}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Conversion Rate</span>
                      <span className="font-bold text-green-700">{conv}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${conv}%` }} />
                    </div>
                  </div>

                  {r.email && <div className="text-xs text-slate-500 mb-1">✉ <a href={`mailto:${r.email}`} className="text-brand-600 hover:underline">{r.email}</a></div>}
                  {r.specialty_focus?.length > 0 && <div className="text-xs text-slate-400">Focus: {Array.isArray(r.specialty_focus) ? r.specialty_focus.join(', ') : r.specialty_focus}</div>}

                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button onClick={() => nav(`/bob?recruiter=${r.user_id || r.id}`)} className="btn-primary btn-xs flex-1 justify-center">View Pipeline</button>
                    <button onClick={() => { setCandFilters(p => ({ ...p, recruiter_id: r.user_id || r.id })) }} className="btn-secondary btn-xs">Filter Below</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* All candidates table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-bold text-slate-900">All Candidates</h3>
          <div className="flex gap-2 flex-wrap">
            <input value={candFilters.q} onChange={e => setCandFilters(p => ({ ...p, q: e.target.value }))} placeholder="Search…" className="input h-8 text-xs w-36" />
            <select value={candFilters.recruiter_id} onChange={e => setCandFilters(p => ({ ...p, recruiter_id: e.target.value }))} className="select h-8 text-xs w-40">
              <option value="">All Recruiters</option>
              {data.recruiters.map(r => <option key={r.id} value={r.user_id||r.id}>{r.first_name} {r.last_name}</option>)}
            </select>
            <select value={candFilters.stage} onChange={e => setCandFilters(p => ({ ...p, stage: e.target.value }))} className="select h-8 text-xs w-32">
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap max-h-96 overflow-y-auto thin-scroll">
          <table>
            <thead className="sticky top-0"><tr><th>Name</th><th>Specialty</th><th>Stage</th><th>Recruiter</th><th>NPI</th><th>Added</th></tr></thead>
            <tbody>
              {candsLoading ? <tr><td colSpan={6} className="text-center py-8"><div className="spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full inline-block" /></td></tr>
                : allCands.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">No candidates</td></tr>
                : allCands.map(c => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/candidates/${c.id}`)}>
                    <td>
                      <div className="font-semibold text-sm text-slate-900">{c.full_name}</div>
                      <div className="text-xs text-slate-400">{c.candidate_id}</div>
                    </td>
                    <td className="text-sm">{c.specialty||'—'}</td>
                    <td><StageBadge stage={c.stage} /></td>
                    <td className="text-xs text-slate-500">{c.recruiter_name||'—'}</td>
                    <td className="font-mono text-xs text-teal-600">{c.npi||'—'}</td>
                    <td className="text-xs text-slate-400">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {recModal && <RecruiterModal rec={editRec} onClose={() => setRecModal(false)} onSaved={() => { setRecModal(false); load() }} />}
    </div>
  )
}

function RecruiterModal({ rec, onClose, onSaved }) {
  const [form, setForm] = useState(rec || { role: 'recruiter' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.first_name || !form.last_name) return toast.error('Name required')
    setSaving(true)
    try {
      if (rec?.id) await api.patch(`/recruiters/${rec.id}`, form)
      else await api.post('/recruiters', form)
      toast.success(rec?.id ? 'Recruiter updated' : 'Recruiter added')
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold">{rec?.id ? 'Edit Recruiter' : 'Add Recruiter'}</h3>
          <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First Name *</label><input value={form.first_name||''} onChange={e=>set('first_name',e.target.value)} className="input" /></div>
            <div><label className="label">Last Name *</label><input value={form.last_name||''} onChange={e=>set('last_name',e.target.value)} className="input" /></div>
            <div><label className="label">Email</label><input value={form.email||''} onChange={e=>set('email',e.target.value)} className="input" /></div>
            <div><label className="label">Phone</label><input value={form.phone||''} onChange={e=>set('phone',e.target.value)} className="input" /></div>
            <div><label className="label">Role</label>
              <select value={form.role||'recruiter'} onChange={e=>set('role',e.target.value)} className="select">
                {['recruiter','senior','lead','hiring_manager','admin'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">Target Placements/mo</label><input type="number" value={form.target_placements||''} onChange={e=>set('target_placements',e.target.value)} className="input" /></div>
          </div>
          <div><label className="label">Specialty Focus (comma-separated)</label>
            <input value={Array.isArray(form.specialty_focus)?form.specialty_focus.join(', '):(form.specialty_focus||'')} onChange={e=>set('specialty_focus',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} className="input" placeholder="Cardiology, EM, Surgery" /></div>
          <div><label className="label">Territory (comma-separated)</label>
            <input value={Array.isArray(form.territory)?form.territory.join(', '):(form.territory||'')} onChange={e=>set('territory',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} className="input" placeholder="Northeast, Southeast" /></div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? <span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : 'Save'}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// PLACEMENTS PAGE
// ═══════════════════════════════════════
export function PlacementsPage() {
  const [placements, setPlacements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/placements').then(r => { setPlacements(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const total = placements.reduce((s, p) => s + (parseFloat(p.fee_amount) || 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Placements</h1>
          <p className="text-slate-500 text-sm">{placements.length} total placements · {fmtMoney(total)} total fees</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Total Placements', placements.length,'#3b82f6'],['Active', placements.filter(p=>p.status==='active').length,'#10b981'],['Total Fees', fmtMoney(total),'#f59e0b'],['Avg Fee', fmtMoney(placements.length?total/placements.length:0),'#8b5cf6']].map(([lbl,val,color])=>(
          <div key={lbl} className="card text-center">
            <div className="text-2xl font-black" style={{color}}>{val}</div>
            <div className="text-sm text-slate-600 mt-1">{lbl}</div>
          </div>
        ))}
      </div>

      {loading ? <div className="flex items-center justify-center h-40"><div className="spin w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full" /></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Candidate</th><th>Job</th><th>Facility</th><th>Recruiter</th><th>Start</th><th>Bill Rate</th><th>Pay Rate</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody>
              {placements.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No placements yet.</td></tr>
                : placements.map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold text-sm text-slate-900">{p.full_name}</td>
                    <td className="text-sm">{p.title}</td>
                    <td className="text-sm text-slate-500">{p.facility_name}</td>
                    <td className="text-sm text-slate-500">{p.recruiter_name||'—'}</td>
                    <td className="text-xs text-slate-400">{fmtDate(p.start_date)}</td>
                    <td className="text-sm">{p.bill_rate?`$${p.bill_rate}/hr`:'—'}</td>
                    <td className="text-sm">{p.pay_rate?`$${p.pay_rate}/hr`:'—'}</td>
                    <td className="text-sm font-semibold text-green-700">{p.fee_amount?fmtMoney(p.fee_amount):'—'}</td>
                    <td><span className={`badge ${p.status==='active'?'badge-green':'badge-gray'} capitalize`}>{p.status}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// INTEGRATIONS PAGE
// ═══════════════════════════════════════
export function IntegrationsPage() {
  const [boards, setBoards] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [configModal, setConfigModal] = useState(null)
  const [configData, setConfigData] = useState({})

  useEffect(() => {
    api.get('/jobboards/status').then(r => setBoards(r.data.boards || [])).catch(() => {})
    api.get('/integrations').then(r => setIntegrations(r.data || [])).catch(() => {})
  }, [])

  const saveIntegration = async () => {
    try {
      await api.put(`/integrations/${configModal.id}`, { name: configModal.name, config: configData, is_active: true })
      toast.success('Integration saved')
      setConfigModal(null); setConfigData({})
      api.get('/integrations').then(r => setIntegrations(r.data || []))
    } catch { toast.error('Failed to save') }
  }

  const TYPE_SECTIONS = [
    { label: 'Provider Search', types: ['provider_search'] },
    { label: 'Job Boards', types: ['job_board'] },
    { label: 'Communication', types: ['email', 'sms', 'calling', 'video'] },
    { label: 'Calendar', types: ['calendar'] },
    { label: 'ATS Migration', types: ['ats_migration'] },
  ]

  const STATUS_COLOR = { connected: 'badge-green', available: 'badge-gray', available_via_link: 'badge-teal' }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Integrations</h1>
        <p className="text-slate-500 text-sm">Connect job boards, communication tools, VMSes, and external platforms</p>
      </div>

      {TYPE_SECTIONS.map(section => {
        const sectionBoards = boards.filter(b => section.types.includes(b.type))
        if (!sectionBoards.length) return null
        return (
          <div key={section.label}>
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-3">{section.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sectionBoards.map(b => {
                const configured = integrations.find(i => i.type === b.id)
                return (
                  <div key={b.id} className="card-sm hover:shadow-md transition flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                      {{'npi_registry':'🏥','healthgrades':'⭐','doximity':'👨‍⚕️','linkedin':'💼','indeed':'🔍','practicematch':'📋','doximity':'🩺','google_calendar':'📅','outlook':'📧','twilio':'💬','sendgrid':'✉','zoom':'🎥','dialpad':'📞','ring_central':'☎','bullhorn':'🔷','ceipal':'🔶'}[b.id]||'🔗'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-900">{b.name}</div>
                      <span className={`badge ${STATUS_COLOR[b.status]||'badge-gray'} text-xs`}>
                        {b.status === 'connected' ? '✓ Connected' : b.status === 'available_via_link' ? 'Link-based' : 'Available'}
                      </span>
                    </div>
                    {b.requires_api_key && b.status !== 'available_via_link' && (
                      <button onClick={() => { setConfigModal(b); setConfigData(configured?.config || {}) }}
                        className={`btn-xs ${configured?.is_active ? 'btn-secondary' : 'btn-primary'} flex-shrink-0`}>
                        {configured?.is_active ? 'Edit' : 'Connect'}
                      </button>
                    )}
                    {!b.requires_api_key && (
                      <a href="#" className="btn-secondary btn-xs flex-shrink-0">Use</a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">🔌 Coming Soon — Deeper Integrations</h3>
        <p className="text-sm text-blue-700">Full API integrations for LinkedIn Recruiter, Bullhorn import/export, VMS platforms (Beeline, Fieldglass, IQNavigator), credentialing services (Nursys, FSMB), and more. Connect via Settings → Integrations when ready.</p>
      </div>

      {configModal && (
        <div className="modal-overlay" onClick={() => setConfigModal(null)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">Connect {configModal.name}</h3>
              <button onClick={() => setConfigModal(null)} className="btn-icon"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">Enter your {configModal.name} API credentials. These are stored securely in your database.</p>
              <div><label className="label">API Key</label><input type="password" value={configData.api_key||''} onChange={e=>setConfigData(p=>({...p,api_key:e.target.value}))} className="input" /></div>
              <div><label className="label">Account ID (if required)</label><input value={configData.account_id||''} onChange={e=>setConfigData(p=>({...p,account_id:e.target.value}))} className="input" /></div>
              <div><label className="label">Additional Config (JSON)</label><textarea value={configData.extra||''} onChange={e=>setConfigData(p=>({...p,extra:e.target.value}))} rows={2} className="input font-mono text-xs" /></div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={saveIntegration} className="btn-primary flex-1 justify-center">Save Integration</button>
              <button onClick={() => setConfigModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════
export function SettingsPage() {
  const { user, apiKey, setApiKey } = useAuthStore()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ first_name: user?.first_name||'', last_name: user?.last_name||'', phone: user?.phone||'' })
  const [pwForm, setPwForm] = useState({ current_password:'', new_password:'', confirm:'' })
  const [saving, setSaving] = useState(false)
  const [key, setKey] = useState(apiKey)

  const saveProfile = async () => {
    setSaving(true)
    try {
      await api.patch('/auth/profile', profile)
      toast.success('Profile updated')
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  const changePw = async () => {
    if (pwForm.new_password !== pwForm.confirm) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await api.post('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password })
      toast.success('Password updated')
      setPwForm({ current_password:'', new_password:'', confirm:'' })
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const SETTING_TABS = [['profile','👤 Profile'],['security','🔐 Security'],['ai','🤖 AI Settings'],['users','👥 Team Users']]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Settings</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {SETTING_TABS.map(([id,lbl]) => <button key={id} onClick={() => setTab(id)} className={`profile-tab ${tab === id ? 'active' : ''}`}>{lbl}</button>)}
      </div>

      {tab === 'profile' && (
        <div className="card space-y-4">
          <h3 className="font-bold text-slate-900">Profile Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First Name</label><input value={profile.first_name} onChange={e=>setProfile(p=>({...p,first_name:e.target.value}))} className="input" /></div>
            <div><label className="label">Last Name</label><input value={profile.last_name} onChange={e=>setProfile(p=>({...p,last_name:e.target.value}))} className="input" /></div>
            <div className="col-span-2"><label className="label">Email</label><input value={user?.email||''} disabled className="input opacity-60 cursor-not-allowed" /></div>
            <div className="col-span-2"><label className="label">Phone</label><input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} className="input" /></div>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary">Save Profile</button>
        </div>
      )}

      {tab === 'security' && (
        <div className="card space-y-4">
          <h3 className="font-bold text-slate-900">Change Password</h3>
          <div><label className="label">Current Password</label><input type="password" value={pwForm.current_password} onChange={e=>setPwForm(p=>({...p,current_password:e.target.value}))} className="input" /></div>
          <div><label className="label">New Password</label><input type="password" value={pwForm.new_password} onChange={e=>setPwForm(p=>({...p,new_password:e.target.value}))} className="input" /></div>
          <div><label className="label">Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} className="input" /></div>
          <button onClick={changePw} disabled={saving} className="btn-primary">Update Password</button>
        </div>
      )}

      {tab === 'ai' && (
        <div className="card space-y-4">
          <h3 className="font-bold text-slate-900">Anthropic AI Settings</h3>
          <p className="text-sm text-slate-600">Your API key enables AI resume parsing, outreach drafting, JD sourcing, and candidate summarization. It is stored in your browser only and sent securely with each request.</p>
          <div>
            <label className="label">Anthropic API Key</label>
            <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-api03-…" className="input" />
          </div>
          <div className={`flex items-center gap-2 text-sm ${key?.startsWith('sk-ant-') ? 'text-green-700' : key ? 'text-amber-600' : 'text-slate-400'}`}>
            {key?.startsWith('sk-ant-') ? <><CheckCircle className="w-4 h-4" /> Key format valid — AI features enabled</> : key ? '⚠ Key format may be incorrect' : '— No key set — AI uses smart fallbacks'}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setApiKey(key); toast.success('Key saved') }} className="btn-primary">Save Key</button>
            <button onClick={() => { setKey(''); setApiKey('') }} className="btn-danger">Clear Key</button>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1">
            <div className="font-bold mb-2">All features work without a key:</div>
            <div>• ✅ Resume parsing → regex-based extraction</div>
            <div>• ✅ Outreach drafts → smart template fallback</div>
            <div>• ✅ Boolean search → rule-based generator</div>
            <div>• 🚀 With key → Claude-powered AI for all the above</div>
          </div>
        </div>
      )}

      {tab === 'users' && <TeamUsersTab />}
    </div>
  )
}

function TeamUsersTab() {
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email:'', first_name:'', last_name:'', role:'recruiter', password:'Recruiter@2024' })

  useEffect(() => { api.get('/auth/users').then(r => setUsers(r.data)).catch(() => {}) }, [])

  const create = async () => {
    try {
      await api.post('/auth/users', form)
      toast.success('User created')
      setModal(false)
      api.get('/auth/users').then(r => setUsers(r.data))
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Team Users</h3>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add User</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-semibold text-sm">{u.first_name} {u.last_name}</td>
                <td className="text-sm text-slate-600">{u.email}</td>
                <td><span className="badge badge-blue capitalize">{u.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b"><h3 className="font-bold">Add Team Member</h3><button onClick={() => setModal(false)} className="btn-icon"><X className="w-4 h-4" /></button></div>
            <div className="p-4 space-y-3">
              {[['email','Email'],['first_name','First Name'],['last_name','Last Name'],['password','Password']].map(([k,lbl]) => (
                <div key={k}><label className="label">{lbl}</label><input type={k==='password'?'password':'text'} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="input" /></div>
              ))}
              <div><label className="label">Role</label>
                <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="select">
                  {['recruiter','senior','hiring_manager','admin'].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={create} className="btn-primary flex-1 justify-center">Create User</button>
              <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
