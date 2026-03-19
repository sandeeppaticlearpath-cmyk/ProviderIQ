// ═══════════════════════════════════════
// PipelinePage.jsx
// ═══════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { STAGES, STAGE_LABELS, STAGE_HEX, SPECIALTIES, ini } from '../utils/helpers'
import StageBadge from '../components/shared/StageBadge'
import toast from 'react-hot-toast'
import { RefreshCw, LayoutGrid, Table2, Filter } from 'lucide-react'

export function PipelinePage() {
  const nav = useNavigate()
  const [board, setBoard] = useState({})
  const [view, setView] = useState('kanban')
  const [specialty, setSpecialty] = useState('')
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/pipeline/board', { params: { specialty } })
      setBoard(data)
    } catch { toast.error('Failed to load pipeline') }
    finally { setLoading(false) }
  }, [specialty])

  useEffect(() => { load() }, [load])

  const move = async (candidateId, newStage) => {
    try {
      await api.post('/pipeline/move', { candidate_id: candidateId, stage: newStage })
      toast.success(`Moved to ${STAGE_LABELS[newStage]}`)
      load()
    } catch { toast.error('Failed to move') }
  }

  const onDrop = (e, stage) => {
    e.preventDefault()
    if (dragging && dragging.stage !== stage) move(dragging.id, stage)
    setDragOver(null); setDragging(null)
  }

  const total = Object.values(board).reduce((a, arr) => a + (arr?.length || 0), 0)

  return (
    <div className="p-6 flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Pipeline</h1>
          <p className="text-slate-500 text-sm">{total} candidates across {STAGES.length} stages</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={specialty} onChange={e => setSpecialty(e.target.value)} className="select text-xs h-8 w-44">
            <option value="">All Specialties</option>
            {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={load} className="btn-icon"><RefreshCw className={`w-4 h-4 ${loading ? 'spin' : ''}`} /></button>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {[['kanban', LayoutGrid], ['table', Table2]].map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === v ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto thin-scroll pb-2 flex-1">
          {STAGES.map(stage => {
            const cards = board[stage] || []
            return (
              <div key={stage} className="flex-shrink-0 w-64"
                onDragOver={e => { e.preventDefault(); setDragOver(stage) }}
                onDrop={e => onDrop(e, stage)}
                onDragLeave={() => setDragOver(null)}>
                <div className={`rounded-xl border-2 h-full flex flex-col ${dragOver === stage ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'} transition-colors`}>
                  <div className="p-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_HEX[stage] }} />
                    <span className="font-bold text-sm text-slate-800">{STAGE_LABELS[stage]}</span>
                    <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{cards.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto thin-scroll p-2 space-y-2">
                    {cards.map(c => (
                      <div key={c.id}
                        draggable
                        onDragStart={() => setDragging({ id: c.id, stage })}
                        className="kanban-card bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md cursor-pointer group"
                        onClick={() => nav(`/candidates/${c.id}`)}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                            {(c.full_name || '?')[0]}
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate">{c.full_name}</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">{c.specialty || '—'}</div>
                        {c.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-2">
                            {c.tags.slice(0,2).map((t,i) => <span key={i} className="badge badge-purple text-xs">{t}</span>)}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{[c.location_city, c.location_state].filter(Boolean).join(', ')}</span>
                          {c.phone && (
                            <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                              className="text-xs text-brand-600 hover:underline">📞</a>
                          )}
                        </div>
                        <select value={stage} onClick={e => e.stopPropagation()}
                          onChange={e => move(c.id, e.target.value)}
                          className="mt-2 w-full select text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                        </select>
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-300">Drop here or no candidates</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="table-wrap overflow-y-auto flex-1">
          <table>
            <thead><tr><th>Name</th><th>Specialty</th><th>Location</th><th>Stage</th><th>NPI</th><th>Phone</th><th>Move to</th></tr></thead>
            <tbody>
              {STAGES.flatMap(stage => (board[stage] || []).map(c => (
                <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/candidates/${c.id}`)}>
                  <td><div className="font-semibold text-sm text-slate-900">{c.full_name}</div></td>
                  <td className="text-sm">{c.specialty || '—'}</td>
                  <td className="text-sm">{[c.location_city, c.location_state].filter(Boolean).join(', ') || '—'}</td>
                  <td><StageBadge stage={c.stage || stage} /></td>
                  <td className="font-mono text-xs text-teal-600">{c.npi || '—'}</td>
                  <td className="text-sm">{c.phone || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <select value={stage} onChange={e => move(c.id, e.target.value)} className="select text-xs h-7 w-28">
                      {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PipelinePage
