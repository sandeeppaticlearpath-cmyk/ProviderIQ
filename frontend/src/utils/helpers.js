import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

export const fmtDate = (d) => {
  if (!d) return '—'
  const p = typeof d === 'string' ? parseISO(d) : d
  return isValid(p) ? format(p, 'MMM d, yyyy') : '—'
}
export const fmtDateTime = (d) => {
  if (!d) return '—'
  const p = typeof d === 'string' ? parseISO(d) : d
  return isValid(p) ? format(p, 'MMM d, yyyy h:mm a') : '—'
}
export const fmtAgo = (d) => {
  if (!d) return '—'
  const p = typeof d === 'string' ? parseISO(d) : d
  return isValid(p) ? formatDistanceToNow(p, { addSuffix: true }) : '—'
}
export const fmtMoney = (n) => {
  if (!n) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
export const fmtPhone = (p) => p || '—'
export const ini = (f, l) => ((f||'')[0]||'') + ((l||'')[0]||'')

export const STAGES = ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold']
export const STAGE_LABELS = {
  sourced:'Sourced', contacted:'Contacted', screening:'Screening',
  interview:'Interview', offer:'Offer', placed:'Placed', rejected:'Rejected', on_hold:'On Hold'
}
export const STAGE_COLORS = {
  sourced:'badge-gray', contacted:'badge-blue', screening:'badge-purple',
  interview:'badge-amber', offer:'badge-green', placed:'badge-green', rejected:'badge-red', on_hold:'badge-gray'
}
export const STAGE_HEX = {
  sourced:'#94a3b8', contacted:'#3b82f6', screening:'#8b5cf6',
  interview:'#f59e0b', offer:'#10b981', placed:'#059669', rejected:'#ef4444', on_hold:'#9ca3af'
}

export const SPECIALTIES = [
  'Anesthesiology','Cardiology','Critical Care','Dermatology','Emergency Medicine',
  'Endocrinology','Family Medicine','Gastroenterology','Geriatrics','Hematology/Oncology',
  'Hospitalist','Infectious Disease','Internal Medicine','Nephrology','Neurology',
  'Obstetrics/Gynecology','Oncology','Ophthalmology','Orthopedic Surgery','Pathology',
  'Pediatrics','Physical Medicine','Psychiatry','Pulmonology','Radiology',
  'Rheumatology','Surgery - General','Urology','Vascular Surgery'
]

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY'
]

export const PLATFORMS = [
  { id:'email', label:'Email', icon:'✉' },
  { id:'sms', label:'SMS/Text', icon:'💬' },
  { id:'phone', label:'Phone', icon:'📞' },
  { id:'linkedin', label:'LinkedIn', icon:'💼' },
  { id:'doximity', label:'Doximity', icon:'🏥' },
  { id:'whatsapp', label:'WhatsApp', icon:'📱' },
  { id:'zoom', label:'Zoom', icon:'🎥' },
  { id:'internal', label:'Internal Note', icon:'📝' },
]

export const downloadCSV = (rows, filename) => {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = filename
  a.click()
}

export const cls = (...args) => args.filter(Boolean).join(' ')
