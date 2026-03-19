import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import api from '../utils/api'
import { fmtAgo, STAGE_HEX, fmtMoney } from '../utils/helpers'
import { Users, Briefcase, Award, TrendingUp, ArrowRight, Activity, Clock, Star } from 'lucide-react'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/dashboard/metrics').then(r => setMetrics(r.data)).catch(() => {})
    api.get('/dashboard/analytics').then(r => setAnalytics(r.data)).catch(() => {})
  }, [])

  const stageData = metrics ? Object.entries(metrics.pipeline_stages || {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: STAGE_HEX[k]
  })).filter(d => d.value > 0) : []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back — here's what's happening today</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: metrics?.total_candidates ?? '—', sub: `${metrics?.new_candidates_30d ?? 0} new this month`, icon: Users, color: 'blue', path: '/candidates' },
          { label: 'Open Jobs', value: metrics?.open_jobs ?? '—', sub: 'Active positions', icon: Briefcase, color: 'purple', path: '/jobs' },
          { label: 'In Pipeline', value: metrics?.in_pipeline ?? '—', sub: 'Active engagements', icon: TrendingUp, color: 'amber', path: '/pipeline' },
          { label: 'Placements (30d)', value: metrics?.placements_30d ?? '—', sub: `${metrics?.outreach_30d ?? 0} messages sent`, icon: Award, color: 'green', path: '/placements' },
        ].map(({ label, value, sub, icon: Icon, color, path }) => (
          <div key={label} onClick={() => nav(path)}
            className="card cursor-pointer hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-100`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            <div className="text-3xl font-black text-slate-900">{value}</div>
            <div className="text-sm font-semibold text-slate-700 mt-0.5">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline Donut */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Pipeline Breakdown</h3>
          {stageData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={2} dataKey="value">
                    {stageData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {stageData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-slate-600 truncate">{d.name}</span>
                    <span className="ml-auto font-bold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>}
        </div>

        {/* Monthly Trend */}
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-slate-900 mb-4">Candidates Added (12 months)</h3>
          {analytics?.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.monthly} barSize={20}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }} />
                <Bar dataKey="c" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-400 text-sm">Loading…</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Specialties */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Top Specialties</h3>
          <div className="space-y-2">
            {analytics?.top_specialties?.slice(0, 8).map((s, i) => {
              const max = analytics.top_specialties[0]?.c || 1
              return (
                <div key={s.specialty} className="flex items-center gap-2">
                  <div className="text-xs text-slate-500 w-3">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-medium text-slate-700 truncate">{s.specialty}</span>
                      <span className="text-xs font-bold text-slate-900 ml-2">{s.c}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(s.c / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source Mix */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Candidate Sources</h3>
          <div className="space-y-2">
            {analytics?.source_mix?.map(s => {
              const total = analytics.source_mix.reduce((a, b) => a + parseInt(b.c), 0) || 1
              return (
                <div key={s.source} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-medium text-slate-700 capitalize">{s.source || 'unknown'}</span>
                      <span className="text-xs font-bold text-slate-900">{Math.round(s.c / total * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${(s.c / total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" /> Recent Activity
          </h3>
          <div className="space-y-2">
            {metrics?.recent_activity?.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-brand-700">
                  {(a.user_name || 'S')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700 leading-snug">{a.description || a.action}</div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{fmtAgo(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
