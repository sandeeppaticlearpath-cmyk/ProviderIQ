// src/components/shared/StageBadge.jsx
import React from 'react'
import { STAGE_LABELS } from '../../utils/helpers'

const MAP = {
  sourced:'bg-slate-100 text-slate-600',contacted:'bg-blue-100 text-blue-700',
  screening:'bg-purple-100 text-purple-700',interview:'bg-amber-100 text-amber-700',
  offer:'bg-emerald-100 text-emerald-700',placed:'bg-green-100 text-green-800',
  rejected:'bg-red-100 text-red-600',on_hold:'bg-gray-100 text-gray-600',
}

export default function StageBadge({ stage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${MAP[stage] || 'bg-slate-100 text-slate-600'}`}>
      {STAGE_LABELS[stage] || stage || '—'}
    </span>
  )
}
