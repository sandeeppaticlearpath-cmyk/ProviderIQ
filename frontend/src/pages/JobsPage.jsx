import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../utils/api'
import { SPECIALTIES, US_STATES, fmtDate, fmtMoney, ini } from '../utils/helpers'
import StageBadge from '../components/shared/StageBadge'
import toast from 'react-hot-toast'
import { Plus, Search, RefreshCw, Briefcase, MapPin, DollarSign, Users, ArrowLeft, Edit3, X, ExternalLink, Clock } from 'lucide-react'

function JobModal({ job, onClose, onSaved }) {
  const [form, setForm] = useState(job || { status: 'open', priority: 'normal', employment_type: 'full_time', slots_available: 1 })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.title) return toast.error('Title is required')
    setSaving(true)
    try {
      if (job?.id) await api.patch(`/jobs/${job.id}`, form)
      else await api.post('/jobs', form)
      toast.success(job?.id ? 'Job updated' : 'Job created')
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const F = ({ label, k, type = 'text', opts, half }) => (
    <div className={half ? '' : ''}>
      <label className="label">{label}</label>
      {opts ? (
        <select value={form[k] || ''} onChange={e => set(k, e.target.value)} className="select">
          <option value="">—</option>
          {opts.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}
        </select>
      ) : <input type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} className="input" />}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{job?.id ? 'Edit Job' : 'New Job Opening'}</h3>
          <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 overflow-y-auto max-h-[70vh] thin-scroll">
          <div className="col-span-2"><F label="Job Title *" k="title" /></div>
          <F label="Specialty" k="specialty" opts={SPECIALTIES} />
          <F label="Credential Required" k="credential_required" />
          <F label="Facility / Client Name" k="facility_name" />
          <F label="Facility Type" k="facility_type" />
          <F label="City" k="location_city" />
          <F label="State" k="location_state" opts={US_STATES} />
          <F label="Employment Type" k="employment_type" opts={[['full_time','Full-Time'],['part_time','Part-Time'],['locum','Locum Tenens'],['travel','Travel'],['remote','Remote/Telehealth'],['per_diem','Per Diem']]} />
          <F label="Shift" k="shift_type" opts={['Days','Nights','Evenings','Rotating','Flexible']} />
          <F label="Salary Min ($)" k="salary_min" type="number" />
          <F label="Salary Max ($)" k="salary_max" type="number" />
          <F label="Hourly Min ($/hr)" k="hourly_min" type="number" />
          <F label="Hourly Max ($/hr)" k="hourly_max" type="number" />
          <F label="Slots Available" k="slots_available" type="number" />
          <F label="Status" k="status" opts={[['open','Open'],['on_hold','On Hold'],['closed','Closed'],['filled','Filled']]} />
          <F label="Priority" k="priority" opts={['high','normal','low']} />
          <F label="Start Date" k="start_date" type="date" />
          <F label="Target Fill Date" k="target_fill_date" type="date" />
          <div className="col-span-2"><F label="Client / Hiring Manager" k="client_name" /></div>
          <div className="col-span-2">
            <label className="label">Job Description</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={4} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Requirements</label>
            <textarea value={form.requirements || ''} onChange={e => set('requirements', e.target.value)} rows={3} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Benefits / Bonus Info</label>
            <textarea value={form.benefits || ''} onChange={e => set('benefits', e.target.value)} rows={2} className="input" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : 'Save Job'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function JobsPage() {
  const nav = useNavigate()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editJob, setEditJob] = useState(null)
  const [filters, setFilters] = useState({ status: 'open', q: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/jobs', { params: filters })
      setJobs(data.jobs); setTotal(data.total)
    } catch {} finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  const STATUS_COLOR = { open: 'badge-green', on_hold: 'badge-amber', closed: 'badge-gray', filled: 'badge-blue' }
  const PRIO_COLOR = { high: 'text-red-500', normal: 'text-slate-400', low: 'text-slate-300' }
  const TYPE_LABEL = { full_time:'Full-Time', part_time:'Part-Time', locum:'Locum', travel:'Travel', remote:'Remote', per_diem:'Per Diem' }

  return (
    <div className="p-6 space-y-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Jobs</h1>
          <p className="text-slate-500 text-sm">{total} positions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-icon"><RefreshCw className={`w-4 h-4 ${loading ? 'spin' : ''}`} /></button>
          <button onClick={() => { setEditJob(null); setModal(true) }} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Job</button>
        </div>
      </div>

      <div className="card p-3 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={filters.q} onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} placeholder="Search jobs…" className="input pl-9 h-9" />
        </div>
        {[['status','All Status', [['','All Status'],['open','Open'],['on_hold','On Hold'],['closed','Closed'],['filled','Filled']]],
          ['specialty','All Specialties', [['', 'All Specialties'], ...SPECIALTIES.map(s => [s,s])]]
        ].map(([k, ph, opts]) => (
          <select key={k} value={filters[k] || ''} onChange={e => setFilters(p => ({ ...p, [k]: e.target.value }))} className="select text-xs h-9 w-36">
            {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-16 text-slate-400">
            <div className="spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full inline-block" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="col-span-3 card text-center py-16 text-slate-400">No jobs found. Create your first job opening.</div>
        ) : jobs.map(j => (
          <div key={j.id} className={`card hover:shadow-md transition-shadow cursor-pointer ${j.priority === 'high' ? 'border-l-4 border-l-red-400' : ''}`}
            onClick={() => nav(`/jobs/${j.id}`)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm truncate">{j.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{j.facility_name || 'Facility TBD'}</div>
              </div>
              <span className={`badge ${STATUS_COLOR[j.status] || 'badge-gray'} ml-2 capitalize`}>{j.status?.replace('_',' ')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {j.specialty && <span className="badge badge-blue">{j.specialty}</span>}
              {j.employment_type && <span className="badge badge-gray">{TYPE_LABEL[j.employment_type] || j.employment_type}</span>}
              {j.priority === 'high' && <span className="badge badge-red">🔥 High Priority</span>}
              {(j.is_remote || j.employment_type === 'remote') && <span className="badge badge-teal">Remote</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
              {(j.location_city || j.location_state) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[j.location_city, j.location_state].filter(Boolean).join(', ')}</span>}
              {(j.salary_min || j.salary_max) && <span className="flex items-center gap-1 font-semibold text-green-700"><DollarSign className="w-3 h-3" />{[j.salary_min && fmtMoney(j.salary_min), j.salary_max && fmtMoney(j.salary_max)].filter(Boolean).join(' – ')}</span>}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{j.submission_count || 0} submissions</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(j.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {modal && <JobModal job={editJob} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

export function JobDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [job, setJob] = useState(null)
  const [editing, setEditing] = useState(false)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])

  useEffect(() => {
    api.get(`/jobs/${id}`).then(r => { setJob(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
  if (!job) return <div className="p-6 text-slate-500">Job not found</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="btn-icon"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900">{job.title}</h1>
          <p className="text-slate-500 text-sm">{job.facility_name} · {[job.location_city, job.location_state].filter(Boolean).join(', ')}</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-secondary btn-sm"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Status', job.status?.replace('_',' '), 'badge-green'],['Priority', job.priority, 'badge-amber'],['Slots', `${job.slots_filled||0}/${job.slots_available||1} filled`, 'badge-blue'],['Submissions', job.submissions?.length || 0, 'badge-gray']].map(([l, v, cls]) => (
          <div key={l} className="card-sm text-center">
            <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{l}</div>
            <span className={`badge ${cls} capitalize`}>{v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            {[['Specialty', job.specialty],['Employment Type', job.employment_type],['Credential', job.credential_required],['Salary', [job.salary_min && fmtMoney(job.salary_min), job.salary_max && fmtMoney(job.salary_max)].filter(Boolean).join(' – ')],['Hourly', [job.hourly_min && `$${job.hourly_min}/hr`, job.hourly_max && `$${job.hourly_max}/hr`].filter(Boolean).join(' – ')],['Start Date', fmtDate(job.start_date)],['Target Fill', fmtDate(job.target_fill_date)],['Client', job.client_name]].map(([k,v]) => v ? (
              <div key={k} className="flex gap-2"><dt className="text-slate-400 font-semibold w-28 flex-shrink-0">{k}:</dt><dd className="text-slate-800">{v}</dd></div>
            ) : null)}
          </dl>
        </div>
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-3">Description</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job.description || 'No description provided.'}</p>
          {job.requirements && <><h4 className="font-bold text-slate-900 mt-4 mb-2">Requirements</h4><p className="text-sm text-slate-700 whitespace-pre-wrap">{job.requirements}</p></>}
          {job.benefits && <><h4 className="font-bold text-slate-900 mt-4 mb-2">Benefits</h4><p className="text-sm text-slate-700 whitespace-pre-wrap">{job.benefits}</p></>}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Submissions ({job.submissions?.length || 0})</h3>
        </div>
        {job.submissions?.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Candidate</th><th>Specialty</th><th>Location</th><th>Stage</th><th>Rate</th><th>Submitted</th></tr></thead>
              <tbody>
                {job.submissions.map(s => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => nav(`/candidates/${s.candidate_id}`)}>
                    <td className="font-semibold text-sm text-brand-600 hover:underline">{s.full_name}</td>
                    <td className="text-sm">{s.specialty || '—'}</td>
                    <td className="text-sm">{[s.location_city, s.location_state].filter(Boolean).join(', ') || '—'}</td>
                    <td><StageBadge stage={s.stage} /></td>
                    <td className="text-sm">{s.offered_rate ? `$${s.offered_rate}/hr` : '—'}</td>
                    <td className="text-xs text-slate-400">{fmtDate(s.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-400">No submissions yet.</p>}
      </div>

      {modal && <JobModal job={job} onClose={() => setModal(false)} onSaved={() => { setModal(false); api.get(`/jobs/${id}`).then(r => setJob(r.data)) }} />}
    </div>
  )
}

export default JobsPage
