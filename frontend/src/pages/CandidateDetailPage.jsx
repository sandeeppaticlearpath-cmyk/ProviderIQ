import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuthStore } from '../store'
import { fmtDate, fmtDateTime, fmtAgo, STAGE_LABELS, STAGES, SPECIALTIES, US_STATES, PLATFORMS, ini, fmtMoney } from '../utils/helpers'
import StageBadge from '../components/shared/StageBadge'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit3, Mail, Phone, Linkedin, Globe, MapPin, Briefcase, Award, FileText,
  MessageSquare, Activity, Shield, Star, Tag, Plus, Send, ChevronDown, ExternalLink,
  Download, Copy, Zap, CheckCircle, Clock, User, Building2, GraduationCap, BookOpen } from 'lucide-react'

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: User },
  { id: 'conversations', label: 'Conversations',  icon: MessageSquare },
  { id: 'submissions',   label: 'Submissions',    icon: Briefcase },
  { id: 'credentials',   label: 'Credentials',   icon: Shield },
  { id: 'activity',      label: 'Timeline',      icon: Activity },
  { id: 'ai',            label: 'AI Copilot',    icon: Zap },
]

export default function CandidateDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { apiKey } = useAuthStore()
  const [candidate, setCandidate] = useState(null)
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [convState, setConvState] = useState({ conversations: [], selected: null, messages: [], newMsg: '', platform: 'email', subject: '' })
  const [credModal, setCredModal] = useState(false)
  const [newCred, setNewCred] = useState({})

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/candidates/${id}`)
      setCandidate(data)
      setEditData(data)
      setConvState(p => ({ ...p, conversations: data.conversations || [] }))
    } catch { toast.error('Candidate not found') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/candidates/${id}`, editData)
      toast.success('Profile saved')
      setEditing(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    try {
      await api.post(`/candidates/${id}/notes`, { content: noteText })
      setNoteText(''); load(); toast.success('Note added')
    } catch { toast.error('Failed to add note') }
  }

  // Conversations
  const loadMessages = async convId => {
    try {
      const { data } = await api.get(`/candidates/${id}/conversations/${convId}/messages`)
      setConvState(p => ({ ...p, messages: data, selected: convId }))
    } catch {}
  }

  const sendMessage = async () => {
    const { newMsg, subject, platform, selected } = convState
    if (!newMsg.trim()) return
    try {
      if (selected) {
        await api.post(`/candidates/${id}/conversations/${selected}/messages`, { body: newMsg, subject, channel: platform })
      } else {
        await api.post('/outreach/send', { candidate_id: id, channel: platform, subject, body: newMsg })
      }
      toast.success('Message sent')
      setConvState(p => ({ ...p, newMsg: '' }))
      load()
      if (convState.selected) loadMessages(convState.selected)
    } catch { toast.error('Failed to send') }
  }

  const addCredential = async () => {
    try {
      await api.post(`/candidates/${id}/credentials`, newCred)
      toast.success('Credential added'); setCredModal(false); setNewCred({}); load()
    } catch { toast.error('Failed to add credential') }
  }

  const aiAction = async (action) => {
    setAiLoading(true); setAiResult(null)
    try {
      if (action === 'summary') {
        const { data } = await api.post('/ai/summarize', { candidate, api_key: apiKey })
        setAiResult({ type: 'text', content: data.summary })
      } else if (action === 'email') {
        const { data } = await api.post('/ai/draft-outreach', { candidate, channel: 'email', api_key: apiKey })
        setAiResult({ type: 'email', subject: data.subject, content: data.body })
      } else if (action === 'sms') {
        const { data } = await api.post('/ai/draft-outreach', { candidate, channel: 'sms', api_key: apiKey })
        setAiResult({ type: 'text', content: data.body })
      } else if (action === 'boolean') {
        const { data } = await api.post('/ai/boolean-search', { specialty: candidate.specialty, location: candidate.location_state, api_key: apiKey })
        setAiResult({ type: 'code', content: data.query })
      }
    } catch (e) { toast.error(e.response?.data?.error || 'AI request failed') }
    finally { setAiLoading(false) }
  }

  const StageSelector = () => (
    <select value={editing ? editData.stage : candidate?.stage}
      onChange={e => editing ? setEditData(p => ({ ...p, stage: e.target.value })) :
        api.patch(`/candidates/${id}`, { stage: e.target.value }).then(() => load())}
      className="select text-xs h-8 w-36">
      {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
    </select>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full spin" />
    </div>
  )
  if (!candidate) return <div className="p-6 text-slate-500">Candidate not found</div>

  const completionColor = candidate.profile_completion >= 80 ? 'bg-green-500' : candidate.profile_completion >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={() => nav(-1)} className="btn-icon"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
            {ini(candidate.first_name, candidate.last_name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 truncate">{candidate.full_name}</h1>
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>{candidate.specialty || '—'}</span>
              {candidate.credential && <><span>·</span><span className="font-semibold">{candidate.credential}</span></>}
              {candidate.location_state && <><span>·</span><MapPin className="w-3 h-3" /><span>{[candidate.location_city, candidate.location_state].filter(Boolean).join(', ')}</span></>}
              {candidate.years_experience && <><span>·</span><span>{candidate.years_experience}y exp</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StageBadge stage={candidate.stage} />
          <StageSelector />
          {editing ? (
            <>
              <button onClick={save} disabled={saving} className="btn-primary btn-sm">
                {saving ? <span className="spin w-3 h-3 inline-block border-2 border-white/30 border-t-white rounded-full" /> : <><CheckCircle className="w-3.5 h-3.5" /> Save</>}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
          )}
        </div>
      </div>

      {/* Profile completion bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-1.5 flex items-center gap-3">
        <span className="text-xs text-slate-500">Profile {candidate.profile_completion}%</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-xs">
          <div className={`h-full rounded-full ${completionColor}`} style={{ width: `${candidate.profile_completion}%` }} />
        </div>
        <span className="text-xs font-mono text-slate-400">{candidate.candidate_id}</span>
        {candidate.npi && (
          <a href={`https://npiregistry.cms.hhs.gov/provider-view/${candidate.npi}`} target="_blank" rel="noreferrer"
            className="text-xs font-mono text-teal-600 hover:underline flex items-center gap-1">
            NPI {candidate.npi} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0 overflow-x-auto thin-scroll flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`profile-tab flex items-center gap-1.5 ${tab === t.id ? 'active' : ''}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
            {t.id === 'conversations' && (candidate.conversations?.length > 0) &&
              <span className="badge badge-blue text-xs ml-1">{candidate.conversations.length}</span>}
            {t.id === 'credentials' && (candidate.credentials?.length > 0) &&
              <span className="badge badge-teal text-xs ml-1">{candidate.credentials.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto thin-scroll">
        <div className="p-6 max-w-6xl mx-auto">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-5">
                {/* Contact */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />Contact & Basic Info</h3>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone'],
                        ['alt_phone','Alt Phone'],['linkedin_url','LinkedIn URL'],['specialty','Specialty'],['credential','Credential (MD/DO…)'],
                        ['npi','NPI'],['location_city','City'],['location_state','State'],['years_experience','Years Exp.'],
                        ['current_employer','Current Employer'],['current_title','Current Title'],
                        ['desired_salary','Desired Salary ($)'],['employment_preference','Pref. (full_time/locum/travel)']].map(([k, lbl]) => (
                        <div key={k}>
                          <label className="label">{lbl}</label>
                          {k === 'location_state' ? (
                            <select value={editData[k] || ''} onChange={e => setEditData(p => ({ ...p, [k]: e.target.value }))} className="select">
                              <option value="">—</option>{US_STATES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input value={editData[k] || ''} onChange={e => setEditData(p => ({ ...p, [k]: e.target.value }))} className="input" />
                          )}
                        </div>
                      ))}
                      <div className="col-span-2">
                        <label className="label">Notes</label>
                        <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3} className="input" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {[
                        ['Email', candidate.email, <a href={`mailto:${candidate.email}`} className="text-brand-600 hover:underline">{candidate.email}</a>],
                        ['Phone', candidate.phone, <a href={`tel:${candidate.phone}`} className="text-brand-600 hover:underline">{candidate.phone}</a>],
                        ['Alt Phone', candidate.alt_phone, candidate.alt_phone],
                        ['Specialty', candidate.specialty, candidate.specialty],
                        ['Credential', candidate.credential, candidate.credential],
                        ['NPI', candidate.npi, candidate.npi ? <a href={`https://npiregistry.cms.hhs.gov/provider-view/${candidate.npi}`} target="_blank" rel="noreferrer" className="text-teal-600 font-mono hover:underline">{candidate.npi}</a> : null],
                        ['Location', null, [candidate.location_city, candidate.location_state, candidate.location_zip].filter(Boolean).join(', ')],
                        ['Experience', candidate.years_experience, `${candidate.years_experience} years`],
                        ['Employer', candidate.current_employer, candidate.current_employer],
                        ['Title', candidate.current_title, candidate.current_title],
                        ['Employment Pref.', candidate.employment_preference, candidate.employment_preference],
                        ['Source', candidate.source, <span className="badge badge-gray capitalize">{candidate.source}</span>],
                        ['Recruiter', candidate.recruiter_name, candidate.recruiter_name],
                        ['LinkedIn', candidate.linkedin_url, candidate.linkedin_url ? <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-600 flex items-center gap-1 hover:underline"><Linkedin className="w-3 h-3" />Profile</a> : null],
                      ].map(([lbl, raw, display]) => raw || (display && typeof display !== 'string') ? (
                        <div key={lbl} className="flex flex-col">
                          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{lbl}</span>
                          <span className="text-slate-800 mt-0.5">{display ?? raw ?? '—'}</span>
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>

                {/* Education */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-slate-400" />Education</h3>
                  {candidate.education?.length > 0
                    ? candidate.education.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{e.degree} {e.field ? `— ${e.field}` : ''}</div>
                          <div className="text-xs text-slate-500">{e.institution} {e.year ? `· ${e.year}` : ''}</div>
                        </div>
                      </div>
                    ))
                    : <p className="text-sm text-slate-400">No education on file</p>}
                </div>

                {/* Work Experience */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" />Work Experience</h3>
                  {candidate.work_experience?.length > 0
                    ? candidate.work_experience.map((w, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{w.title}</div>
                          <div className="text-xs text-slate-500">{w.organization} · {w.start_year}{w.current ? ' – Present' : w.end_year ? ` – ${w.end_year}` : ''}</div>
                        </div>
                      </div>
                    ))
                    : <p className="text-sm text-slate-400">No work history on file</p>}
                </div>

                {/* Board Certifications & Skills */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-slate-400" />Certifications & Skills</h3>
                  {candidate.certifications?.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2">Certifications</div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.certifications.map((c, i) => (
                          <span key={i} className="badge badge-amber">{c.name || c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {candidate.skills?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2">Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.map((s, i) => <span key={i} className="badge badge-blue">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {candidate.tags?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.tags.map((t, i) => <span key={i} className="badge badge-purple">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {candidate.notes && (
                  <div className="card">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-400" />Notes</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{candidate.notes}</p>
                  </div>
                )}

                {/* Add note */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-3">Add Note</h3>
                  <div className="flex gap-2">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                      placeholder="Add an internal note…" className="input flex-1 resize-none text-sm" />
                    <button onClick={addNote} disabled={!noteText.trim()} className="btn-primary self-end">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-4">
                {/* Quick actions */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    {candidate.email && <a href={`mailto:${candidate.email}`} className="btn-secondary w-full justify-start btn-sm"><Mail className="w-4 h-4 text-blue-500" />Send Email</a>}
                    {candidate.phone && <a href={`tel:${candidate.phone}`} className="btn-secondary w-full justify-start btn-sm"><Phone className="w-4 h-4 text-green-500" />Call</a>}
                    {candidate.linkedin_url && <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-start btn-sm"><Linkedin className="w-4 h-4 text-blue-700" />LinkedIn Profile</a>}
                    <button onClick={() => setTab('ai')} className="btn-secondary w-full justify-start btn-sm"><Zap className="w-4 h-4 text-purple-500" />AI Copilot</button>
                    <button onClick={() => setTab('conversations')} className="btn-secondary w-full justify-start btn-sm"><MessageSquare className="w-4 h-4 text-teal-500" />Message</button>
                  </div>
                </div>

                {/* Hospital affiliations */}
                {candidate.hospital_affiliations?.length > 0 && (
                  <div className="card">
                    <h3 className="font-bold text-slate-900 mb-3">Hospital Affiliations</h3>
                    <div className="space-y-1">
                      {candidate.hospital_affiliations.map((h, i) => (
                        <div key={i} className="text-sm text-slate-700 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />{h}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* License states */}
                {candidate.license_states?.length > 0 && (
                  <div className="card">
                    <h3 className="font-bold text-slate-900 mb-3">License States</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.license_states.map((s, i) => <span key={i} className="badge badge-teal">{s}</span>)}
                    </div>
                  </div>
                )}

                {/* Recent submissions */}
                {candidate.submissions?.length > 0 && (
                  <div className="card">
                    <h3 className="font-bold text-slate-900 mb-3">Submissions</h3>
                    <div className="space-y-2">
                      {candidate.submissions.slice(0, 4).map(s => (
                        <div key={s.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{s.job_title}</div>
                            <div className="text-xs text-slate-400">{s.facility_name} · <StageBadge stage={s.stage} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CONVERSATIONS ── */}
          {tab === 'conversations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[600px]">
              {/* Conversation list */}
              <div className="card overflow-y-auto thin-scroll">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900">Conversations</h3>
                  <button onClick={() => setConvState(p => ({ ...p, selected: null, messages: [] }))}
                    className="btn-primary btn-xs"><Plus className="w-3 h-3" /></button>
                </div>
                <div className="space-y-2">
                  {convState.conversations.map(conv => (
                    <div key={conv.id}
                      onClick={() => loadMessages(conv.id)}
                      className={`p-3 rounded-xl cursor-pointer border transition-all ${convState.selected === conv.id ? 'border-brand-300 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{PLATFORMS.find(p => p.id === conv.platform)?.icon || '💬'}</span>
                        <span className="text-xs font-bold text-slate-800 capitalize">{conv.platform}</span>
                        <span className="ml-auto text-xs text-slate-400 font-mono">{conv.message_count || 0} msgs</span>
                      </div>
                      {conv.subject && <div className="text-xs text-slate-600 truncate font-medium">{conv.subject}</div>}
                      {conv.last_message_at && <div className="text-xs text-slate-400 mt-0.5">{fmtAgo(conv.last_message_at)}</div>}
                    </div>
                  ))}
                  {convState.conversations.length === 0 &&
                    <p className="text-sm text-slate-400 text-center py-8">No conversations yet.<br />Send a message below.</p>}
                </div>
              </div>

              {/* Messages / Compose */}
              <div className="lg:col-span-2 card flex flex-col overflow-hidden">
                {/* Thread */}
                <div className="flex-1 overflow-y-auto thin-scroll space-y-3 mb-4 min-h-0">
                  {convState.messages.length > 0 ? convState.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${msg.direction === 'outbound' ? 'bg-brand-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                        {msg.subject && <div className="font-bold text-xs mb-1 opacity-80">{msg.subject}</div>}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.body}</div>
                        <div className={`text-xs mt-1.5 opacity-60`}>{fmtDateTime(msg.sent_at)} · {msg.platform}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm h-full">
                      {convState.selected ? 'No messages in this conversation' : 'Select a conversation or start a new one'}
                    </div>
                  )}
                </div>

                {/* Compose */}
                <div className="border-t border-slate-100 pt-3 space-y-2 flex-shrink-0">
                  <div className="flex gap-2">
                    <select value={convState.platform} onChange={e => setConvState(p => ({ ...p, platform: e.target.value }))} className="select text-xs h-8 w-32">
                      {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                    </select>
                    <input value={convState.subject} onChange={e => setConvState(p => ({ ...p, subject: e.target.value }))}
                      placeholder="Subject (optional for email)" className="input text-xs h-8 flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <textarea value={convState.newMsg} onChange={e => setConvState(p => ({ ...p, newMsg: e.target.value }))}
                      placeholder={`Write a ${convState.platform} message to ${candidate.full_name}…`}
                      rows={3} className="input flex-1 resize-none text-sm" />
                    <button onClick={sendMessage} disabled={!convState.newMsg.trim()} className="btn-primary self-end px-3 py-2">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SUBMISSIONS ── */}
          {tab === 'submissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Job Submissions</h3>
                <button onClick={() => nav('/jobs')} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Submit to Job</button>
              </div>
              {candidate.submissions?.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Job</th><th>Facility</th><th>Location</th><th>Stage</th><th>Rate</th><th>Submitted</th></tr></thead>
                    <tbody>
                      {candidate.submissions.map(s => (
                        <tr key={s.id}>
                          <td><div className="font-semibold text-sm text-slate-800">{s.job_title}</div></td>
                          <td className="text-sm">{s.facility_name || '—'}</td>
                          <td className="text-sm">{[s.location_city, s.location_state].filter(Boolean).join(', ') || '—'}</td>
                          <td><StageBadge stage={s.stage} /></td>
                          <td className="text-sm">{s.offered_rate ? `$${s.offered_rate}/hr` : '—'}</td>
                          <td className="text-xs text-slate-400">{fmtDate(s.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="card text-center py-12 text-slate-400">No submissions yet. Submit this candidate to an open job.</div>}
            </div>
          )}

          {/* ── CREDENTIALS ── */}
          {tab === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Credentials & Licenses</h3>
                <button onClick={() => setCredModal(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Credential</button>
              </div>
              {candidate.credentials?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {candidate.credentials.map(c => {
                    const expired = c.expiry_date && new Date(c.expiry_date) < new Date()
                    const expiring = c.expiry_date && !expired && new Date(c.expiry_date) < new Date(Date.now() + 30*24*60*60*1000)
                    return (
                      <div key={c.id} className={`card-sm border-l-4 ${expired ? 'border-l-red-500' : expiring ? 'border-l-amber-500' : 'border-l-green-500'}`}>
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-bold text-sm text-slate-900">{c.name}</div>
                          <span className={`badge ${expired ? 'badge-red' : expiring ? 'badge-amber' : 'badge-green'}`}>
                            {expired ? 'Expired' : expiring ? 'Expiring Soon' : 'Active'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div><span className="font-semibold">Type:</span> {c.type}</div>
                          {c.issuer && <div><span className="font-semibold">Issuer:</span> {c.issuer}</div>}
                          {c.license_number && <div><span className="font-semibold">License #:</span> <span className="font-mono">{c.license_number}</span></div>}
                          {c.state && <div><span className="font-semibold">State:</span> {c.state}</div>}
                          {c.expiry_date && <div><span className="font-semibold">Expires:</span> {fmtDate(c.expiry_date)}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <div className="card text-center py-12 text-slate-400">No credentials on file. Add licenses, DEA, board certifications, etc.</div>}
            </div>
          )}

          {/* ── TIMELINE ── */}
          {tab === 'activity' && (
            <div className="max-w-2xl space-y-0">
              {candidate.activities?.map((a, i) => (
                <div key={a.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                      {(a.user_name || 'S')[0]}
                    </div>
                    {i < candidate.activities.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{a.user_name || 'System'}</span>
                      <span className="badge badge-gray text-xs capitalize">{a.action?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400 ml-auto">{fmtAgo(a.created_at)}</span>
                    </div>
                    {a.description && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{a.description}</p>}
                  </div>
                </div>
              ))}
              {(!candidate.activities || candidate.activities.length === 0) &&
                <div className="text-sm text-slate-400 text-center py-12">No activity recorded yet</div>}
            </div>
          )}

          {/* ── AI COPILOT ── */}
          {tab === 'ai' && (
            <div className="max-w-2xl space-y-5">
              <div className="copilot-panel">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center"><Zap className="w-4 h-4 text-purple-600" /></div>
                  <div>
                    <div className="font-bold text-slate-900">AI Copilot</div>
                    <div className="text-xs text-slate-500">{apiKey ? '✓ Anthropic key active' : 'Add key in sidebar for better results'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '📋 Summarize Profile', action: 'summary', desc: 'Professional recruiter summary' },
                    { label: '✉ Draft Email', action: 'email', desc: 'Personalized outreach email' },
                    { label: '💬 Draft SMS', action: 'sms', desc: 'Short follow-up text' },
                    { label: '🔍 Boolean Search', action: 'boolean', desc: 'LinkedIn/Doximity query' },
                  ].map(btn => (
                    <button key={btn.action} onClick={() => aiAction(btn.action)} disabled={aiLoading}
                      className="bg-white border border-purple-200 rounded-xl p-3 text-left hover:bg-purple-50 transition-colors">
                      <div className="text-sm font-bold text-slate-800">{btn.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{btn.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {aiLoading && (
                <div className="card flex items-center gap-3 py-6 justify-center text-slate-500">
                  <div className="spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                  Generating AI response…
                </div>
              )}

              {aiResult && (
                <div className="card border-l-4 border-l-purple-500">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-slate-900">AI Result</h4>
                    <button onClick={() => navigator.clipboard.writeText(aiResult.content).then(() => toast.success('Copied!'))}
                      className="btn-ghost text-xs"><Copy className="w-3.5 h-3.5" /> Copy</button>
                  </div>
                  {aiResult.type === 'email' && aiResult.subject && (
                    <div className="mb-2 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase">Subject: </span>
                      <span className="text-sm text-slate-800">{aiResult.subject}</span>
                    </div>
                  )}
                  <pre className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${aiResult.type === 'code' ? 'font-mono bg-slate-50 p-3 rounded-lg' : ''}`}>
                    {aiResult.content}
                  </pre>
                  {aiResult.type === 'email' && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setConvState(p => ({ ...p, newMsg: aiResult.content, subject: aiResult.subject, platform: 'email' })); setTab('conversations'); }}
                        className="btn-primary btn-sm"><Send className="w-3.5 h-3.5" /> Send via Outreach</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Credential Modal */}
      {credModal && (
        <div className="modal-overlay" onClick={() => setCredModal(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Add Credential</h3>
              <div className="space-y-3">
                {[['type','Type (license/certification/dea/malpractice)'],['name','Name'],['issuer','Issuing Authority'],['license_number','License/Cert Number'],['state','State (2-letter)'],['expiry_date','Expiry Date']].map(([k,lbl]) => (
                  <div key={k}>
                    <label className="label">{lbl}</label>
                    <input type={k === 'expiry_date' ? 'date' : 'text'} value={newCred[k] || ''} onChange={e => setNewCred(p => ({ ...p, [k]: e.target.value }))} className="input" />
                  </div>
                ))}
                <div>
                  <label className="label">Notes</label>
                  <textarea value={newCred.notes || ''} onChange={e => setNewCred(p => ({ ...p, notes: e.target.value }))} rows={2} className="input" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={addCredential} className="btn-primary flex-1">Save Credential</button>
                <button onClick={() => setCredModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
