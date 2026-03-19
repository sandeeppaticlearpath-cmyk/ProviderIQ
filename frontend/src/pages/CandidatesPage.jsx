import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
import { SPECIALTIES, US_STATES, STAGES, STAGE_LABELS, fmtDate, downloadCSV, ini } from '../utils/helpers'
import { Search, Plus, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Trash2, UserCheck, Tag, X, SlidersHorizontal } from 'lucide-react'
import StageBadge from '../components/shared/StageBadge'
import CandidateModal from '../components/candidates/CandidateModal'
import toast from 'react-hot-toast'

export default function CandidatesPage() {
  const nav = useNavigate()
  const location = useLocation()
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [recruiters, setRecruiters] = useState([])
  const [filters, setFilters] = useState({ q: '', specialty: '', stage: '', state: '', recruiter_id: '', source: '', priority: '' })
  const LIMIT = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
      const { data } = await api.get('/candidates', { params })
      setCandidates(data.candidates)
      setTotal(data.total)
    } catch { toast.error('Failed to load candidates') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/recruiters').then(r => setRecruiters(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (location.state?.openNew) { setShowModal(true); window.history.replaceState({}, '') } }, [location.state])

  const setFilter = (k, v) => { setFilters(p => ({ ...p, [k]: v })); setPage(1) }
  const clearFilters = () => { setFilters({ q: '', specialty: '', stage: '', state: '', recruiter_id: '', source: '', priority: '' }); setPage(1) }
  const hasFilters = Object.values(filters).some(Boolean)

  const toggleSelect = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelected(selected.length === candidates.length ? [] : candidates.map(c => c.id))

  const bulkAction = async (action, data = {}) => {
    if (!selected.length) return toast.error('Select candidates first')
    try {
      await api.post('/candidates/bulk', { action, candidate_ids: selected, data })
      toast.success(`Updated ${selected.length} candidates`)
      setSelected([]); load()
    } catch { toast.error('Bulk action failed') }
  }

  const exportCSV = async () => {
    const { data } = await api.get('/candidates', { params: { ...filters, limit: 9999, page: 1 } })
    downloadCSV(data.candidates.map(c => ({
      ID: c.candidate_id, Name: c.full_name, Email: c.email, Phone: c.phone,
      Specialty: c.specialty, Stage: c.stage, State: c.location_state,
      City: c.location_city, NPI: c.npi, Experience: c.years_experience,
      Employer: c.current_employer, Source: c.source, Recruiter: c.recruiter_name,
      Added: fmtDate(c.created_at)
    })), `provideriq_candidates_${new Date().toISOString().slice(0,10)}.csv`)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Candidates</h1>
          <p className="text-slate-500 text-sm">{total.toLocaleString()} total candidates</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.length > 0 && (
            <>
              <select onChange={e => { if (e.target.value) { bulkAction('stage_change', { stage: e.target.value }); e.target.value = '' } }}
                className="select text-xs h-8 w-36">
                <option value="">Move {selected.length} to…</option>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <select onChange={e => { if (e.target.value) { bulkAction('assign', { recruiter_id: e.target.value }); e.target.value = '' } }}
                className="select text-xs h-8 w-40">
                <option value="">Assign to…</option>
                {recruiters.map(r => <option key={r.id} value={r.user_id || r.id}>{r.first_name} {r.last_name}</option>)}
              </select>
              <button onClick={() => bulkAction('archive')} className="btn-danger btn-sm"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={() => setShowFilters(p => !p)} className={`btn-secondary btn-sm gap-1.5 ${hasFilters ? 'ring-2 ring-brand-500' : ''}`}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
          </button>
          <button onClick={exportCSV} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Candidate</button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={filters.q} onChange={e => setFilter('q', e.target.value)}
              placeholder="Search name, email, NPI, specialty, employer…"
              className="input pl-9 h-9" />
          </div>
          <button onClick={load} className="btn-icon"><RefreshCw className={`w-4 h-4 ${loading ? 'spin' : ''}`} /></button>
          {hasFilters && <button onClick={clearFilters} className="btn-ghost text-red-500 text-xs"><X className="w-3.5 h-3.5" /> Clear</button>}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100">
            <select value={filters.specialty} onChange={e => setFilter('specialty', e.target.value)} className="select text-xs h-8">
              <option value="">All Specialties</option>
              {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.stage} onChange={e => setFilter('stage', e.target.value)} className="select text-xs h-8">
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <select value={filters.state} onChange={e => setFilter('state', e.target.value)} className="select text-xs h-8">
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.recruiter_id} onChange={e => setFilter('recruiter_id', e.target.value)} className="select text-xs h-8">
              <option value="">All Recruiters</option>
              {recruiters.map(r => <option key={r.id} value={r.user_id || r.id}>{r.first_name} {r.last_name}</option>)}
            </select>
            <select value={filters.source} onChange={e => setFilter('source', e.target.value)} className="select text-xs h-8">
              <option value="">All Sources</option>
              {['manual','uploaded','npi_registry','jd_sourcing','linkedin','referral','job_board'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)} className="select text-xs h-8">
              <option value="">Any Priority</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" checked={selected.length === candidates.length && candidates.length > 0} onChange={toggleAll} className="rounded" /></th>
              <th>Candidate</th>
              <th>Specialty</th>
              <th>Location</th>
              <th>NPI</th>
              <th>Exp.</th>
              <th>Stage</th>
              <th>Recruiter</th>
              <th>Source</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-16 text-slate-400">
                <div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full spin mb-2" /><br />Loading candidates…
              </td></tr>
            ) : candidates.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-16 text-slate-400">No candidates found</td></tr>
            ) : candidates.map(c => (
              <tr key={c.id} className={selected.includes(c.id) ? 'bg-brand-50' : ''}>
                <td><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" /></td>
                <td>
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => nav(`/candidates/${c.id}`)}>
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                      {ini(c.first_name, c.last_name)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 hover:text-brand-600 text-sm">{c.full_name}</div>
                      <div className="text-xs text-slate-400">{c.candidate_id} · {c.email || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="text-sm">{c.specialty || '—'}</td>
                <td className="text-sm">{[c.location_city, c.location_state].filter(Boolean).join(', ') || '—'}</td>
                <td>
                  {c.npi ? (
                    <a href={`https://npiregistry.cms.hhs.gov/provider-view/${c.npi}`} target="_blank" rel="noreferrer"
                      className="font-mono text-xs text-teal-600 hover:underline" onClick={e => e.stopPropagation()}>
                      {c.npi}
                    </a>
                  ) : '—'}
                </td>
                <td className="text-sm">{c.years_experience ? `${c.years_experience}y` : '—'}</td>
                <td><StageBadge stage={c.stage} /></td>
                <td className="text-xs text-slate-500">{c.recruiter_name || '—'}</td>
                <td><span className="badge badge-gray capitalize text-xs">{c.source || '—'}</span></td>
                <td className="text-xs text-slate-400">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT, total)} of {total}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary btn-sm"><ChevronLeft className="w-3.5 h-3.5" /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return <button key={p} onClick={() => setPage(p)} className={`btn-sm px-3 ${p === page ? 'btn-primary' : 'btn-secondary'}`}>{p}</button>
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-secondary btn-sm"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {showModal && <CandidateModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}
    </div>
  )
}
