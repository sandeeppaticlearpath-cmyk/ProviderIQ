import React, { useState } from 'react'
import api from '../../utils/api'
import { SPECIALTIES, US_STATES, STAGES, STAGE_LABELS } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function CandidateModal({ candidate, onClose, onSaved }) {
  const [form, setForm] = useState(candidate || { stage: 'sourced', source: 'manual', us_authorized: true })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.first_name || !form.last_name) return toast.error('First and last name are required')
    setSaving(true)
    try {
      if (candidate?.id) await api.patch(`/candidates/${candidate.id}`, form)
      else await api.post('/candidates', form)
      toast.success(candidate?.id ? 'Candidate updated' : 'Candidate created')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  const F = ({ label, k, type='text', opts }) => (
    <div>
      <label className="label">{label}</label>
      {opts ? (
        <select value={form[k] || ''} onChange={e => set(k, e.target.value)} className="select">
          <option value="">—</option>
          {opts.map(o => Array.isArray(o)
            ? <option key={o[0]} value={o[0]}>{o[1]}</option>
            : <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} className="input" />
      )}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{candidate?.id ? 'Edit Candidate' : 'New Candidate'}</h3>
          <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 overflow-y-auto max-h-[70vh] thin-scroll">
          <F label="First Name *" k="first_name" />
          <F label="Last Name *" k="last_name" />
          <F label="Email" k="email" type="email" />
          <F label="Phone" k="phone" />
          <F label="Specialty" k="specialty" opts={SPECIALTIES} />
          <F label="Credential (MD/DO/NP…)" k="credential" />
          <F label="NPI Number" k="npi" />
          <F label="Years Experience" k="years_experience" type="number" />
          <F label="Current Employer" k="current_employer" />
          <F label="Current Title" k="current_title" />
          <F label="City" k="location_city" />
          <F label="State" k="location_state" opts={US_STATES} />
          <F label="Stage" k="stage" opts={STAGES.map(s => [s, STAGE_LABELS[s]])} />
          <F label="Source" k="source" opts={['manual','uploaded','npi_registry','jd_sourcing','linkedin','referral','job_board']} />
          <F label="Employment Preference" k="employment_preference" opts={['full_time','part_time','locum','travel','remote','per_diem']} />
          <F label="Priority" k="priority" opts={['normal','high','low']} />
          <F label="LinkedIn URL" k="linkedin_url" />
          <F label="Desired Salary ($)" k="desired_salary" type="number" />
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} className="input" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : 'Save Candidate'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
