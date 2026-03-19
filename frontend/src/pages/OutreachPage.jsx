import React, { useEffect, useState, useRef } from 'react'
import api from '../utils/api'
import { useAuthStore } from '../store'
import { PLATFORMS, fmtDateTime } from '../utils/helpers'
import toast from 'react-hot-toast'
import { Send, Zap, Mail, MessageSquare, RefreshCw, Upload, FileText, CheckCircle, Search, ExternalLink, Copy, Plus } from 'lucide-react'

// ═══════════════════════════════════════
// OUTREACH PAGE
// ═══════════════════════════════════════
export function OutreachPage() {
  const { apiKey } = useAuthStore()
  const [candidates, setCandidates] = useState([])
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({ candidate_id: '', channel: 'email', subject: '', body: '' })
  const [log, setLog] = useState([])
  const [drafting, setDrafting] = useState(false)
  const [reply, setReply] = useState({ input: '', suggestions: [] })
  const [tab, setTab] = useState('compose')

  useEffect(() => {
    api.get('/candidates?limit=200').then(r => setCandidates(r.data.candidates || [])).catch(() => {})
    api.get('/outreach/templates').then(r => setTemplates(r.data || [])).catch(() => {})
  }, [])

  const send = async () => {
    if (!form.candidate_id || !form.body) return toast.error('Select a candidate and write a message')
    try {
      await api.post('/outreach/send', form)
      setLog(p => [{ ...form, ts: Date.now(), name: candidates.find(c => c.id === form.candidate_id)?.full_name }, ...p.slice(0, 49)])
      toast.success('Message logged ✓')
      setForm(p => ({ ...p, body: '', subject: '' }))
    } catch { toast.error('Failed to send') }
  }

  const draftAI = async () => {
    if (!form.candidate_id) return toast.error('Select a candidate first')
    setDrafting(true)
    const cand = candidates.find(c => c.id === form.candidate_id)
    try {
      const { data } = await api.post('/ai/draft-outreach', { candidate: cand, channel: form.channel, api_key: apiKey })
      if (form.channel === 'email' && data.subject) setForm(p => ({ ...p, subject: data.subject }))
      setForm(p => ({ ...p, body: data.body || data.content || '' }))
    } catch { toast.error('AI draft failed') }
    finally { setDrafting(false) }
  }

  const aiReply = async () => {
    if (!reply.input) return
    try {
      const { data } = await api.post('/ai/chat', {
        api_key: apiKey,
        messages: [{ role: 'user', content: `A physician candidate sent: "${reply.input}". Generate 3 reply options numbered 1. 2. 3. Each under 3 sentences, professional tone for healthcare recruiting.` }]
      })
      const lines = (data.content || '').split('\n').filter(l => /^\d\./.test(l.trim()))
      setReply(p => ({ ...p, suggestions: lines }))
    } catch { toast.error('AI reply failed') }
  }

  const selCand = candidates.find(c => c.id === form.candidate_id)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Outreach</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {[['compose','✉ Compose'],['reply','💬 Reply Suggestions'],['log','📋 Log'],['templates','📝 Templates']].map(([id,lbl]) => (
          <button key={id} onClick={() => setTab(id)} className={`profile-tab ${tab === id ? 'active' : ''}`}>{lbl}</button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="card space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Candidate</label>
                  <select value={form.candidate_id} onChange={e => setForm(p => ({ ...p, candidate_id: e.target.value }))} className="select">
                    <option value="">Select candidate…</option>
                    {candidates.map(c => <option key={c.id} value={c.id}>{c.full_name} {c.specialty ? `(${c.specialty})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Channel</label>
                  <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))} className="select">
                    {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
              </div>
              {form.channel === 'email' && (
                <div>
                  <label className="label">Subject</label>
                  <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="input" placeholder="Exciting opportunity…" />
                </div>
              )}
              <div>
                <label className="label">Message</label>
                <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} className="input resize-none" placeholder="Write your message…" />
                {form.channel === 'sms' && <div className="text-right text-xs text-slate-400 mt-1">{form.body.length}/160</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={send} disabled={!form.candidate_id || !form.body} className="btn-primary flex-1 justify-center">
                  <Send className="w-4 h-4" /> Send & Log
                </button>
                <button onClick={draftAI} disabled={drafting} className="btn-secondary">
                  {drafting ? <span className="spin w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full" /> : <Zap className="w-4 h-4 text-purple-500" />}
                  AI Draft
                </button>
              </div>
            </div>
            {selCand && (
              <div className="card-sm bg-blue-50 border-blue-200">
                <div className="text-xs font-bold text-blue-700 mb-1">Selected Candidate</div>
                <div className="font-semibold text-sm text-slate-900">{selCand.full_name}</div>
                <div className="text-xs text-slate-500">{selCand.specialty} · {selCand.location_state} · {selCand.email}</div>
                <div className="flex gap-2 mt-2">
                  {selCand.email && <a href={`mailto:${selCand.email}`} className="btn-secondary btn-xs flex items-center gap-1"><Mail className="w-3 h-3" />Email</a>}
                  {selCand.phone && <a href={`tel:${selCand.phone}`} className="btn-secondary btn-xs">📞 Call</a>}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-bold text-slate-900 mb-3">Quick Links</h3>
              <div className="space-y-2">
                {[['Gmail','https://mail.google.com','✉'],['Outlook','https://outlook.live.com','📧'],['LinkedIn','https://linkedin.com/messaging','💼'],['Doximity','https://www.doximity.com/messages','🏥'],['Zoom','https://zoom.us/start/videomeeting','🎥'],['Dialpad','https://dialpad.com','📞']].map(([name, url, icon]) => (
                  <a key={name} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
                    <span>{icon}</span> {name} <ExternalLink className="w-3 h-3 ml-auto text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'reply' && (
        <div className="max-w-2xl space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 mb-3">AI Reply Suggestions</h3>
            <label className="label">Incoming Message</label>
            <textarea value={reply.input} onChange={e => setReply(p => ({ ...p, input: e.target.value }))} rows={4} className="input mb-3" placeholder="Paste the candidate's message here…" />
            <button onClick={aiReply} className="btn-primary btn-sm"><Zap className="w-3.5 h-3.5" /> Generate Replies</button>
          </div>
          {reply.suggestions.length > 0 && reply.suggestions.map((s, i) => (
            <div key={i} className="card hover:shadow-md transition cursor-pointer" onClick={() => setForm(p => ({ ...p, body: s.replace(/^\d\.\s*/, '') }))}>
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Option {i + 1} — click to use</div>
              <p className="text-sm text-slate-700">{s}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'log' && (
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Recent Outreach ({log.length})</h3>
          {log.length ? log.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-lg">{PLATFORMS.find(p => p.id === e.channel)?.icon || '💬'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{e.name}</div>
                {e.subject && <div className="text-xs text-slate-500 font-medium">{e.subject}</div>}
                <div className="text-xs text-slate-400 truncate">{e.body?.slice(0, 80)}…</div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(e.ts)}</div>
            </div>
          )) : <p className="text-sm text-slate-400">No messages sent this session.</p>}
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card hover:shadow-md transition cursor-pointer" onClick={() => { setForm(p => ({ ...p, subject: t.subject || '', body: t.body, channel: t.channel })); setTab('compose'); }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-slate-900">{t.name}</div>
                <span className="badge badge-blue capitalize">{t.channel}</span>
              </div>
              {t.subject && <div className="text-xs text-slate-500 font-medium mb-1">{t.subject}</div>}
              <p className="text-xs text-slate-600 line-clamp-3">{t.body}</p>
            </div>
          ))}
          {templates.length === 0 && <div className="col-span-2 card text-center py-12 text-slate-400">No templates yet.</div>}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// UPLOAD PAGE (CV Parse)
// ═══════════════════════════════════════
export function UploadPage() {
  const { apiKey } = useAuthStore()
  const [step, setStep] = useState(1)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [editParsed, setEditParsed] = useState({})
  const [saving, setSaving] = useState(false)
  const [filename, setFilename] = useState('')
  const [resumeText, setResumeText] = useState('')
  const fileRef = useRef()

  const processFile = async (file) => {
    setStep(2); setParsing(true); setFilename(file.name)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await api.post('/upload/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResumeText(data.text || '')
      setStep(3)
      // Parse with AI
      const parseRes = await api.post('/ai/parse-resume', { text: data.text, api_key: apiKey, filename: file.name })
      const p = parseRes.data
      setParsed(p)
      setEditParsed({
        first_name: p.firstName || '',
        last_name: p.lastName || '',
        credential: p.credential || '',
        specialty: p.specialty || '',
        npi: p.npi || '',
        email: p.email || '',
        phone: p.phone || '',
        location_city: p.city || '',
        location_state: p.state || '',
        years_experience: p.experienceYears || '',
        current_employer: p.organization || '',
        notes: p.professionalSummary || '',
        source: 'uploaded',
        resume_text: data.text,
      })
      setStep(4)
    } catch (e) { toast.error('Parsing failed: ' + e.message); setStep(1) }
    finally { setParsing(false) }
  }

  const saveProfile = async () => {
    if (!editParsed.first_name || !editParsed.last_name) return toast.error('First and last name required')
    setSaving(true)
    try {
      await api.post('/candidates', editParsed)
      toast.success('Candidate profile created ✓')
      setStep(1); setParsed(null); setEditParsed({}); setFilename('')
    } catch (e) { toast.error(e.response?.data?.error || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">CV Upload & Parse</h1>
        <p className="text-slate-500 text-sm">Upload a resume — AI extracts all details and builds a candidate profile</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Upload','Extract','AI Parse','Review & Save'].map((lbl, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${step > i+1 ? 'text-green-600' : step === i+1 ? 'text-brand-700' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > i+1 ? 'bg-green-500 text-white' : step === i+1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span className="hidden sm:inline">{lbl}</span>
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 ${step > i+1 ? 'bg-green-500' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div
          className="card border-2 border-dashed border-slate-300 hover:border-brand-400 transition-colors cursor-pointer p-12 text-center"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && processFile(e.dataTransfer.files[0]) }}>
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-bold text-slate-800 text-lg mb-2">Drop a resume here</h3>
          <p className="text-slate-500 text-sm mb-4">PDF, DOCX, or TXT · max 20MB</p>
          <button className="btn-primary">Browse Files</button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
            onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
        </div>
      )}

      {(step === 2 || step === 3) && (
        <div className="card text-center py-12">
          <div className="spin w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full inline-block mb-4" style={{ borderWidth: 3 }} />
          <h3 className="font-bold text-slate-800">{step === 2 ? 'Extracting text…' : 'AI parsing resume…'}</h3>
          <p className="text-slate-500 text-sm mt-1">{filename}</p>
        </div>
      )}

      {step === 4 && editParsed && (
        <div className="space-y-4">
          <div className="card bg-green-50 border-green-200 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <div className="font-bold text-green-800 text-sm">Resume parsed successfully!</div>
              <div className="text-xs text-green-700">{filename} · Review and correct fields below before saving</div>
            </div>
          </div>
          <div className="card">
            <h3 className="font-bold text-slate-900 mb-4">Parsed Profile — Review & Edit</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['First Name','first_name'],['Last Name','last_name'],['Email','email'],['Phone','phone'],
                ['Credential','credential'],['Specialty','specialty'],['NPI','npi'],['Years Exp.','years_experience'],
                ['Current Employer','current_employer'],['City','location_city'],['State (2-letter)','location_state']].map(([lbl, k]) => (
                <div key={k}>
                  <label className="label">{lbl}</label>
                  <input value={editParsed[k] || ''} onChange={e => setEditParsed(p => ({ ...p, [k]: e.target.value }))} className="input" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="label">Professional Summary</label>
                <textarea value={editParsed.notes || ''} onChange={e => setEditParsed(p => ({ ...p, notes: e.target.value }))} rows={3} className="input" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <><CheckCircle className="w-4 h-4" /> Save to ATS</>}
            </button>
            <button onClick={() => { setStep(1); setParsed(null); setEditParsed({}) }} className="btn-secondary">Upload Another</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// SOURCE PAGE (JD Sourcing)
// ═══════════════════════════════════════
export function SourcePage() {
  const { apiKey } = useAuthStore()
  const [jd, setJD] = useState('')
  const [opts, setOpts] = useState({ count: 15, tone: 'professional', city: '', state: '' })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!jd.trim()) return toast.error('Paste a job description first')
    if (!apiKey) return toast.error('Add Anthropic API key in sidebar')
    setLoading(true); setResults(null)
    try {
      const { data } = await api.post('/ai/jd-source', { jd, ...opts, api_key: apiKey })
      setResults(data)
    } catch (e) { toast.error(e.response?.data?.error || 'Sourcing failed') }
    finally { setLoading(false) }
  }

  const importCandidate = async (cand) => {
    const parts = (cand.name || '').replace(/^Dr\.?\s+/, '').split(' ')
    try {
      await api.post('/candidates', {
        first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '',
        credential: cand.credential, specialty: cand.specialty, current_employer: cand.organization,
        location_city: cand.city, location_state: cand.state,
        years_experience: cand.experience_years, status: 'sourced', source: 'jd_sourcing',
      })
      toast.success(`${cand.name} added to pipeline ✓`)
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const importAll = async () => {
    if (!results?.candidates) return
    let n = 0
    for (const c of results.candidates) { try { await importCandidate(c); n++ } catch {} }
    toast.success(`${n} candidates imported to pipeline!`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">JD Sourcing</h1>
        <p className="text-slate-500 text-sm">Paste a job description — AI generates matching physician candidates with personalized outreach</p>
      </div>

      {!results && (
        <div className="card space-y-4">
          <div>
            <label className="label">Job Description *</label>
            <textarea value={jd} onChange={e => setJD(e.target.value)} rows={10} className="input"
              placeholder="Paste the full job description here — specialty, location, requirements, facility type…" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Candidates to Generate</label>
              <select value={opts.count} onChange={e => setOpts(p => ({ ...p, count: +e.target.value }))} className="select">
                {[10,15,20,25,30].map(n => <option key={n} value={n}>{n} candidates</option>)}
              </select>
            </div>
            <div>
              <label className="label">Outreach Tone</label>
              <select value={opts.tone} onChange={e => setOpts(p => ({ ...p, tone: e.target.value }))} className="select">
                {['professional','friendly','urgent','consultative'].map(t => <option key={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">City Override</label>
              <input value={opts.city} onChange={e => setOpts(p => ({ ...p, city: e.target.value }))} className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label">State Override</label>
              <input value={opts.state} onChange={e => setOpts(p => ({ ...p, state: e.target.value }))} className="input" placeholder="e.g. NY" maxLength={2} />
            </div>
          </div>
          <button onClick={run} disabled={loading || !jd.trim()} className="btn-primary btn-lg w-full justify-center">
            {loading ? <><span className="spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full inline-block" /> Sourcing candidates…</> : <><Zap className="w-5 h-5" /> Run AI Sourcing</>}
          </button>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {results.role && (
            <div className="card bg-blue-50 border-blue-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['Specialty', results.role.specialty],['Location', results.role.location],['Compensation', results.role.compensation],['Candidates', results.candidates?.length]].map(([k,v]) => v ? (
                  <div key={k}><div className="text-xs font-bold text-blue-600 uppercase">{k}</div><div className="font-bold text-blue-900 text-sm">{v}</div></div>
                ) : null)}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{results.candidates?.length} Candidates Sourced</h3>
            <div className="flex gap-2">
              <button onClick={importAll} className="btn-primary btn-sm">+ Import All to Pipeline</button>
              <button onClick={() => setResults(null)} className="btn-secondary btn-sm">New Search</button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.candidates?.map((c, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-sm text-slate-500">{c.specialty} · {c.organization} · {[c.city, c.state].filter(Boolean).join(', ')}</div>
                  </div>
                  <span className={`badge ${c.confidence === 'High' ? 'badge-green' : c.confidence === 'Medium' ? 'badge-amber' : 'badge-red'}`}>{c.confidence}</span>
                </div>
                {c.email_subject && (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase">Email Draft</div>
                    <div className="text-xs font-semibold text-slate-700">Subject: {c.email_subject}</div>
                    <textarea defaultValue={c.email_body} rows={3} className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 resize-none text-slate-700" />
                    <div className="text-xs font-bold text-slate-500 uppercase mt-2">SMS Draft</div>
                    <textarea defaultValue={c.sms_body} rows={2} className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 resize-none text-slate-700" maxLength={160} />
                  </div>
                )}
                <button onClick={() => importCandidate(c)} className="btn-primary btn-sm w-full justify-center">
                  <Plus className="w-3.5 h-3.5" /> Add to Pipeline
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// PROVIDERS PAGE (Search)
// ═══════════════════════════════════════
export function ProvidersPage() {
  const { apiKey } = useAuthStore()
  const [form, setForm] = useState({ first_name: '', last_name: '', taxonomy: '', state: '', city: '', organization: '', number: '' })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [boolForm, setBoolForm] = useState({ specialty: '', location: '', additional: '' })
  const [boolResult, setBoolResult] = useState('')
  const [links, setLinks] = useState(null)
  const [tab, setTab] = useState('npi')

  const searchNPI = async () => {
    const hasInput = Object.values(form).some(v => v.trim())
    if (!hasInput) return toast.error('Enter at least one search field')
    setLoading(true); setResults(null)
    try {
      const { data } = await api.get('/npi/search', { params: { ...form, limit: 25 } })
      setResults(data)
    } catch { toast.error('NPI search failed') }
    finally { setLoading(false) }
  }

  const addToATS = async (r) => {
    const b = r.basic || {}
    const ind = r.enumeration_type === 'NPI-1'
    const tax = r.taxonomies?.find(t => t.primary) || r.taxonomies?.[0] || {}
    const adr = r.addresses?.find(a => a.address_purpose === 'LOCATION') || r.addresses?.[0] || {}
    const nm = ind ? [b.first_name, b.middle_name, b.last_name].filter(Boolean).join(' ') : (b.organization_name || 'Unknown')
    const parts = nm.split(' ')
    try {
      await api.post('/candidates', {
        first_name: ind ? (b.first_name || parts[0]) : '', last_name: ind ? (b.last_name || parts.slice(1).join(' ')) : nm,
        credential: b.credential || '', specialty: tax.desc || '', npi: r.number,
        location_city: adr.city || '', location_state: adr.state || '',
        phone: adr.telephone_number || '', source: 'npi_registry',
        current_employer: b.organization_name || '',
      })
      toast.success('Provider added to ATS ✓')
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const genBoolean = async () => {
    const { data } = await api.post('/ai/boolean-search', { ...boolForm, api_key: apiKey })
    setBoolResult(data.query)
  }

  const getLinks = async () => {
    const { data } = await api.get('/providers/search', { params: { specialty: boolForm.specialty, location: boolForm.location } })
    setLinks(data)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Provider Search</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {[['npi','🏥 NPI Registry (Live)'],['boolean','🔍 Boolean Search'],['sources','🌐 Open Sources']].map(([id,lbl]) => (
          <button key={id} onClick={() => setTab(id)} className={`profile-tab ${tab === id ? 'active' : ''}`}>{lbl}</button>
        ))}
      </div>

      {tab === 'npi' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 mb-3">Search NPPES NPI Registry — 6M+ Licensed Providers</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[['first_name','First Name'],['last_name','Last Name'],['taxonomy','Specialty/Taxonomy'],['city','City'],['state','State (2-letter)'],['organization','Organization'],['number','NPI Number']].map(([k,lbl]) => (
                <div key={k}>
                  <label className="label">{lbl}</label>
                  <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && searchNPI()} className="input" placeholder={lbl} />
                </div>
              ))}
            </div>
            <button onClick={searchNPI} disabled={loading} className="btn-primary">
              {loading ? <span className="spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <><Search className="w-4 h-4" /> Search NPI Registry</>}
            </button>
          </div>

          {results && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900">{results.result_count || results.results?.length || 0} Results</h3>
                <span className="badge badge-teal">✓ Live NPPES/CMS Data</span>
              </div>
              {results.error && <div className="card bg-red-50 border-red-200 text-red-700 text-sm p-4">{results.error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.results?.map(r => {
                  const b = r.basic || {}
                  const ind = r.enumeration_type === 'NPI-1'
                  const tax = r.taxonomies?.find(t => t.primary) || r.taxonomies?.[0] || {}
                  const adr = r.addresses?.find(a => a.address_purpose === 'LOCATION') || r.addresses?.[0] || {}
                  const nm = ind ? [b.first_name, b.middle_name, b.last_name].filter(Boolean).join(' ') : (b.organization_name || 'Unknown')
                  return (
                    <div key={r.number} className="card hover:shadow-md transition">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">{nm[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 text-sm">{nm} {b.credential && <span className="text-slate-500 font-normal text-xs">· {b.credential}</span>}</div>
                          <div className="font-mono text-xs text-teal-600">NPI: {r.number}</div>
                        </div>
                        <span className={`badge ${b.status === 'A' ? 'badge-green' : 'badge-red'}`}>{b.status === 'A' ? '✓ Active' : 'Inactive'}</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5 mb-3">
                        {tax.desc && <div><span className="font-semibold">Specialty:</span> {tax.desc}</div>}
                        {(adr.city || adr.state) && <div><span className="font-semibold">Location:</span> {[adr.address_1, adr.city, adr.state].filter(Boolean).join(', ')}</div>}
                        {adr.telephone_number && <div><span className="font-semibold">Phone:</span> {adr.telephone_number}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addToATS(r)} className="btn-primary btn-xs flex-1 justify-center">+ Add to ATS</button>
                        <a href={`https://npiregistry.cms.hhs.gov/provider-view/${r.number}`} target="_blank" rel="noreferrer"
                          className="btn-secondary btn-xs flex items-center gap-1"><ExternalLink className="w-3 h-3" /></a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'boolean' && (
        <div className="max-w-2xl space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 mb-3">AI Boolean Search Generator</h3>
            <div className="space-y-3">
              {[['specialty','Specialty'],['location','Location (City, State)'],['additional','Additional Keywords']].map(([k,lbl]) => (
                <div key={k}><label className="label">{lbl}</label><input value={boolForm[k]} onChange={e => setBoolForm(p => ({ ...p, [k]: e.target.value }))} className="input" /></div>
              ))}
              <button onClick={genBoolean} className="btn-primary btn-sm"><Zap className="w-3.5 h-3.5" /> Generate Boolean Query</button>
            </div>
          </div>
          {boolResult && (
            <div className="card border-l-4 border-l-purple-500">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900">Boolean Query</h4>
                <button onClick={() => navigator.clipboard.writeText(boolResult).then(() => toast.success('Copied!'))} className="btn-ghost text-xs"><Copy className="w-3.5 h-3.5" /></button>
              </div>
              <pre className="font-mono text-sm text-slate-700 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap break-words">{boolResult}</pre>
              <div className="flex gap-2 mt-3">
                <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(boolResult)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><ExternalLink className="w-3.5 h-3.5" /> LinkedIn</a>
                <a href={`https://www.doximity.com/search#query=${encodeURIComponent(boolResult)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><ExternalLink className="w-3.5 h-3.5" /> Doximity</a>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-bold text-slate-900 mb-1">Search Open Provider Databases</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Specialty</label><input value={boolForm.specialty} onChange={e => setBoolForm(p => ({ ...p, specialty: e.target.value }))} className="input" placeholder="Cardiology, EM…" /></div>
              <div><label className="label">Location</label><input value={boolForm.location} onChange={e => setBoolForm(p => ({ ...p, location: e.target.value }))} className="input" placeholder="New York, NY" /></div>
            </div>
            <button onClick={getLinks} className="btn-primary btn-sm">Get Search Links</button>
          </div>
          {links && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(links.links || {}).map(([board, url]) => (
                <a key={board} href={url} target="_blank" rel="noreferrer"
                  className="card-sm hover:shadow-md transition flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {{npi:'🏥',healthgrades:'⭐',doximity:'👨‍⚕️',linkedin:'💼',practicematch:'🔍',physiciansPractice:'📋',aafp:'🩺',ziprecruiter:'📍',sharecare:'💊'}[board] || '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 capitalize">{board.replace(/([A-Z])/g,' $1').trim()}</div>
                    <div className="text-xs text-slate-400 truncate">{url.split('?')[0]}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OutreachPage
