// ═══════════════════════════════════════════════════════
// NPI Registry Proxy Route
// ═══════════════════════════════════════════════════════
const npiRouter = require('express').Router();
const axios = require('axios');

npiRouter.get('/search', async (req, res) => {
  try {
    const params = { version: '2.1', limit: req.query.limit || 25, ...req.query };
    delete params.limit; params.limit = req.query.limit || 25;
    const r = await axios.get('https://npiregistry.cms.hhs.gov/api/', {
      params, timeout: 15000,
      headers: { 'User-Agent': 'ProviderIQ/2.0' }
    });
    res.json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message, results: [], result_count: 0 });
  }
});

npiRouter.get('/verify/:npi', async (req, res) => {
  try {
    const r = await axios.get('https://npiregistry.cms.hhs.gov/api/', {
      params: { version: '2.1', number: req.params.npi },
      timeout: 10000
    });
    const result = r.data?.results?.[0] || null;
    res.json({ verified: !!result, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.npiRouter = npiRouter;

// ═══════════════════════════════════════════════════════
// AI Route (Anthropic proxy + open search tools)
// ═══════════════════════════════════════════════════════
const aiRouter = require('express').Router();
const { query: dbQuery } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

aiRouter.post('/chat', async (req, res) => {
  const { messages, api_key, max_tokens = 1000 } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!key) return res.status(400).json({ error: 'No Anthropic API key provided' });
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens,
      system: 'You are ProviderIQ AI — an expert healthcare recruiter assistant. Be concise and actionable.',
      messages
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 60000 });
    res.json({ content: r.data.content?.[0]?.text || '' });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

aiRouter.post('/parse-resume', async (req, res) => {
  const { text, api_key, filename } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!key) {
    // Fallback regex parsing
    return res.json(regexParseResume(text, filename || ''));
  }
  const clean = text.replace(/%PDF-[\d.]+/g,'').replace(/[^\x20-\x7E\n\r\t]/g,' ').replace(/ {3,}/g,'  ').slice(0, 4000);
  const prompt = `Parse this healthcare resume. Return ONLY valid JSON, no markdown.\n{"firstName":"","lastName":"","credential":"MD/DO/NP/PA-C/RN/CRNA/etc","specialty":"","npi":"10-digit or empty","organization":"current employer","city":"","state":"2-letter","phone":"","email":"","experienceYears":null,"education":"degree and institution","boardCertifications":"","professionalSummary":"2-3 sentences","skills":[],"languages":[]}\n\nResume:\n${clean}`;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 30000 });
    let txt = r.data.content?.[0]?.text?.trim() || '{}';
    txt = txt.replace(/^```json\s*|\s*```$/g, '');
    res.json(JSON.parse(txt));
  } catch (err) {
    res.json(regexParseResume(text, filename || ''));
  }
});

aiRouter.post('/draft-outreach', async (req, res) => {
  const { candidate, job, channel, tone, api_key } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  const jobCtx = job ? ` for a ${job.title} role at ${job.facility_name}, ${job.location_city} ${job.location_state}` : '';
  if (!key) {
    return res.json({
      subject: `Exciting Opportunity for ${candidate.specialty} Professionals`,
      body: `Dear Dr. ${candidate.last_name},\n\nI came across your profile and wanted to reach out about an exciting ${candidate.specialty} opportunity${jobCtx}.\n\nWould you be open to a brief conversation?\n\nBest regards`
    });
  }
  const p = channel === 'sms'
    ? `Write a physician recruitment SMS under 155 chars${jobCtx}. Candidate: Dr. ${candidate.last_name}, ${candidate.specialty}. Return ONLY the SMS text.`
    : `Write a ${tone||'professional'} physician recruitment email${jobCtx}. Candidate: Dr. ${candidate.last_name}, ${candidate.specialty}, ${candidate.location_city} ${candidate.location_state}. Max 120 words. Return ONLY JSON: {"subject":"...","body":"..."}`;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 600,
      messages: [{ role: 'user', content: p }]
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 30000 });
    let txt = r.data.content?.[0]?.text?.trim() || '';
    txt = txt.replace(/^```json\s*|\s*```$/g, '');
    if (channel === 'sms') return res.json({ body: txt.slice(0,160) });
    res.json(JSON.parse(txt));
  } catch (err) {
    res.json({ subject: `${candidate.specialty} Opportunity`, body: `Dear Dr. ${candidate.last_name}, I have an exciting opportunity that may interest you.` });
  }
});

aiRouter.post('/summarize', async (req, res) => {
  const { candidate, api_key } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!key) return res.json({ summary: `Dr. ${candidate.last_name} is a ${candidate.specialty} professional with ${candidate.years_experience} years of experience based in ${candidate.location_city}, ${candidate.location_state}.` });
  const p = `Write a 3-sentence professional recruiter summary for: ${candidate.full_name}, ${candidate.specialty}, ${candidate.years_experience} years, ${candidate.current_employer}, ${candidate.location_city} ${candidate.location_state}. Focus on clinical strengths and market positioning.`;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 300,
      messages: [{ role: 'user', content: p }]
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 20000 });
    res.json({ summary: r.data.content?.[0]?.text?.trim() || '' });
  } catch (err) {
    res.json({ summary: `${candidate.full_name} is an experienced ${candidate.specialty} professional.` });
  }
});

aiRouter.post('/boolean-search', async (req, res) => {
  const { specialty, location, additional, api_key } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!key) {
    let q = specialty ? `"${specialty}"` : '"physician"';
    if (location) q += ` AND "${location}"`;
    q += ' AND ("MD" OR "DO" OR "physician" OR "NP")';
    if (additional) q += ` AND "${additional}"`;
    return res.json({ query: q });
  }
  const p = `Generate a Boolean search query for LinkedIn/Doximity for: Specialty="${specialty}", Location="${location}", Additional="${additional}". Return ONLY the Boolean string.`;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 400,
      messages: [{ role: 'user', content: p }]
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 20000 });
    res.json({ query: r.data.content?.[0]?.text?.trim() || '' });
  } catch (err) {
    res.json({ query: `"${specialty}" AND "${location}" AND ("MD" OR "DO")` });
  }
});

aiRouter.post('/jd-source', async (req, res) => {
  const { jd, count=20, tone='professional', city='', state='', api_key } = req.body;
  const key = api_key || process.env.ANTHROPIC_API_KEY || '';
  if (!key) return res.status(400).json({ error: 'API key required for JD sourcing' });
  const p = `Healthcare physician recruitment engine. Analyze this Job Description:\n---\n${jd.slice(0,3000)}\n---\n${city||state?`Location: ${[city,state].filter(Boolean).join(', ')}\n`:''}\nGenerate exactly ${count} matching physician profiles. For each, draft a personalized ${tone} outreach email (3-4 sentences) AND SMS under 140 chars.\n\nReturn ONLY valid JSON:\n{"role":{"specialty":"","location":"","compensation":"","key_requirements":[]},"candidates":[{"name":"Dr. Full Name MD","credential":"MD","specialty":"","organization":"","city":"","state":"","experience_years":0,"confidence":"High","email_subject":"","email_body":"","sms_body":""}]}`;
  try {
    const r = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514', max_tokens: 8000,
      messages: [{ role: 'user', content: p }]
    }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 90000 });
    let txt = r.data.content?.[0]?.text?.trim() || '{}';
    txt = txt.replace(/^```json\s*|\s*```$/g, '');
    res.json(JSON.parse(txt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function regexParseResume(text, filename) {
  const emailM = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const phoneM = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
  const npiM = text.match(/\bNPI[:\s#]*(\d{10})\b/i);
  const credM = text.match(/\b(MD|DO|NP|PA-C|RN|CRNA|PharmD|PT|DDS|DMD)\b/);
  const stateM = text.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  const specs = ['Cardiology','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','Oncology','Orthopedic Surgery','Pediatrics','Psychiatry','Radiology','Anesthesiology','Surgery','Dermatology','Urology','Gastroenterology','Hospitalist','Pulmonology','Nephrology'];
  const spec = specs.find(s => text.toLowerCase().includes(s.toLowerCase())) || '';
  const expM = text.match(/(\d{1,2})\+?\s*years?\s*(of\s*)?(experience|practice)/i);
  const nameRe = /^(Dr\.?\s+)?([A-Z][a-z]+)(\s+[A-Z][a-z]+){1,3}(,?\s*(MD|DO|NP|PA-C|RN))?$/;
  let nameLine = '';
  for (const line of text.split('\n').slice(0, 30)) {
    const l = line.trim();
    if (!l || l.length > 60 || /[%<>{}\[\]]/.test(l)) continue;
    const letters = (l.match(/[a-zA-Z]/g)||[]).length;
    if (l && letters/l.length < 0.6) continue;
    if (nameRe.test(l)) { nameLine = l.replace(/,?\s*(MD|DO|NP|PA-C|RN)$/i,'').replace(/^Dr\.?\s+/i,'').trim(); break; }
  }
  const parts = nameLine.split(' ');
  return {
    firstName: parts[0]||'', lastName: parts.slice(1).join(' ')||'',
    credential: credM?.[1]||'', specialty: spec, npi: npiM?.[1]||'',
    organization: '', city: '', state: stateM?.[1]||'',
    phone: phoneM?.[0]||'', email: emailM?.[0]||'',
    experienceYears: expM?parseInt(expM[1]):null,
    education: '', boardCertifications: '', professionalSummary: '', skills: [], languages: []
  };
}

module.exports.aiRouter = aiRouter;

// ═══════════════════════════════════════════════════════
// Dashboard Route
// ═══════════════════════════════════════════════════════
const dashRouter = require('express').Router();

dashRouter.get('/metrics', async (req, res) => {
  try {
    const tid = req.tenantId;
    const [cStats, jStats, mStats, recent, placed30, sourced30] = await Promise.all([
      dbQuery(`SELECT stage, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY stage`, [tid]),
      dbQuery(`SELECT status, COUNT(*) c FROM jobs WHERE tenant_id=$1 GROUP BY status`, [tid]),
      dbQuery(`SELECT COUNT(*) c FROM messages WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '30 days'`, [tid]),
      dbQuery(`SELECT al.action, al.description, al.created_at, u.first_name||' '||u.last_name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.tenant_id=$1 ORDER BY al.created_at DESC LIMIT 15`, [tid]),
      dbQuery(`SELECT COUNT(*) c FROM candidates WHERE tenant_id=$1 AND stage='placed' AND updated_at > NOW()-INTERVAL '30 days'`, [tid]),
      dbQuery(`SELECT COUNT(*) c FROM candidates WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '30 days'`, [tid]),
    ]);
    const byStage = {};
    ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold'].forEach(s=>byStage[s]=0);
    cStats.rows.forEach(r=>byStage[r.stage]=(byStage[r.stage]||0)+parseInt(r.c));
    const byJobStatus = {};
    jStats.rows.forEach(r=>byJobStatus[r.status]=parseInt(r.c));
    const total = Object.values(byStage).reduce((a,b)=>a+b,0);
    const inPipeline = (byStage.contacted||0)+(byStage.screening||0)+(byStage.interview||0)+(byStage.offer||0);
    res.json({
      total_candidates: total, in_pipeline: inPipeline,
      open_jobs: byJobStatus.open||0, placements_30d: parseInt(placed30.rows[0].c),
      new_candidates_30d: parseInt(sourced30.rows[0].c),
      outreach_30d: parseInt(mStats.rows[0].c),
      pipeline_stages: byStage, recent_activity: recent.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

dashRouter.get('/analytics', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const tid = req.tenantId;
    const [weekly, topSpecs, topStates, sourceMix, timeToFill] = await Promise.all([
      dbQuery(`SELECT DATE_TRUNC('week', created_at) as week, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '${parseInt(period)} days' GROUP BY 1 ORDER BY 1`, [tid]),
      dbQuery(`SELECT specialty, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false AND specialty IS NOT NULL GROUP BY specialty ORDER BY c DESC LIMIT 10`, [tid]),
      dbQuery(`SELECT location_state, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false AND location_state IS NOT NULL GROUP BY location_state ORDER BY c DESC LIMIT 10`, [tid]),
      dbQuery(`SELECT source, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false AND source IS NOT NULL GROUP BY source ORDER BY c DESC`, [tid]),
      dbQuery(`SELECT AVG(EXTRACT(EPOCH FROM (s.updated_at - s.submitted_at))/86400)::INTEGER as avg_days FROM submissions s WHERE s.tenant_id=$1 AND s.stage='placed'`, [tid]),
    ]);
    res.json({
      weekly_candidates: weekly.rows,
      top_specialties: topSpecs.rows,
      top_states: topStates.rows,
      source_mix: sourceMix.rows,
      avg_days_to_fill: timeToFill.rows[0]?.avg_days || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.dashRouter = dashRouter;

// ═══════════════════════════════════════════════════════
// Pipeline Route
// ═══════════════════════════════════════════════════════
const pipelineRouter = require('express').Router();
const { logActivity } = require('./candidates');

pipelineRouter.get('/board', async (req, res) => {
  try {
    const { specialty, recruiter_id } = req.query;
    let where = 'c.tenant_id=$1 AND c.is_archived=false';
    const params = [req.tenantId];
    if (specialty) { params.push(specialty); where += ` AND c.specialty=$${params.length}`; }
    if (recruiter_id) { params.push(recruiter_id); where += ` AND c.assigned_recruiter_id=$${params.length}`; }
    const { rows } = await dbQuery(
      `SELECT c.id,c.candidate_id,c.full_name,c.specialty,c.location_city,c.location_state,
              c.phone,c.email,c.npi,c.stage,c.tags,c.priority,c.rating,
              c.assigned_recruiter_id,u.first_name||' '||u.last_name as recruiter_name,
              c.last_contacted,c.available_date
       FROM candidates c LEFT JOIN users u ON u.id=c.assigned_recruiter_id
       WHERE ${where} ORDER BY c.updated_at DESC`, params
    );
    const board = {};
    ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold'].forEach(s=>board[s]=[]);
    rows.forEach(r => { if (board[r.stage]) board[r.stage].push(r); });
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

pipelineRouter.post('/move', async (req, res) => {
  try {
    const { candidate_id, stage, note } = req.body;
    const validStages = ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold'];
    if (!validStages.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
    const old = await dbQuery('SELECT stage FROM candidates WHERE id=$1 AND tenant_id=$2', [candidate_id, req.tenantId]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });
    await dbQuery('UPDATE candidates SET stage=$1,status=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3', [stage, candidate_id, req.tenantId]);
    await logActivity(req.tenantId, 'candidate', candidate_id, req.user.id, 'stage_change',
      `${old.rows[0].stage} → ${stage}${note?`: ${note}`:''}`, { from: old.rows[0].stage, to: stage });
    res.json({ success: true, candidate_id, stage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.pipelineRouter = pipelineRouter;

// ═══════════════════════════════════════════════════════
// Jobs Route
// ═══════════════════════════════════════════════════════
const jobsRouter = require('express').Router();

jobsRouter.get('/', async (req, res) => {
  try {
    const { status, specialty, q, page=1, limit=25 } = req.query;
    const conditions = ['j.tenant_id=$1']; const params = [req.tenantId];
    if (status) { params.push(status); conditions.push(`j.status=$${params.length}`); }
    if (specialty) { params.push(`%${specialty}%`); conditions.push(`j.specialty ILIKE $${params.length}`); }
    if (q) { params.push(`%${q}%`); conditions.push(`(j.title ILIKE $${params.length} OR j.facility_name ILIKE $${params.length} OR j.specialty ILIKE $${params.length})`); }
    const where = conditions.join(' AND ');
    const total = (await dbQuery(`SELECT COUNT(*) FROM jobs j WHERE ${where}`, params)).rows[0].count;
    params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
    const { rows } = await dbQuery(
      `SELECT j.*, u.first_name||' '||u.last_name as recruiter_name,
              (SELECT COUNT(*) FROM submissions s WHERE s.job_id=j.id) as submission_count
       FROM jobs j LEFT JOIN users u ON u.id=j.assigned_recruiter_id
       WHERE ${where} ORDER BY j.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ total: parseInt(total), jobs: rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

jobsRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await dbQuery('SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const subs = await dbQuery(
      `SELECT s.*, c.full_name, c.specialty, c.location_city, c.location_state FROM submissions s JOIN candidates c ON c.id=s.candidate_id WHERE s.job_id=$1 ORDER BY s.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], submissions: subs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

jobsRouter.post('/', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO jobs(id,tenant_id,title,specialty,subspecialty,credential_required,facility_name,facility_type,location_city,location_state,employment_type,shift_type,assignment_length,salary_min,salary_max,hourly_min,hourly_max,description,requirements,benefits,priority,status,client_name,hiring_manager,slots_available,start_date,target_fill_date,created_by,assigned_recruiter_id,tags)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
      [uuidv4(),req.tenantId,b.title,b.specialty,b.subspecialty,b.credential_required,b.facility_name,b.facility_type,
       b.location_city,b.location_state,b.employment_type,b.shift_type,b.assignment_length,
       b.salary_min,b.salary_max,b.hourly_min,b.hourly_max,b.description,b.requirements,b.benefits,
       b.priority||'normal',b.status||'open',b.client_name,b.hiring_manager,b.slots_available||1,
       b.start_date,b.target_fill_date,req.user.id,b.assigned_recruiter_id||req.user.id,
       JSON.stringify(b.tags||[])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

jobsRouter.patch('/:id', async (req, res) => {
  try {
    const b = req.body;
    const fields = ['title','specialty','facility_name','location_city','location_state','employment_type',
      'salary_min','salary_max','hourly_min','hourly_max','description','requirements','status','priority',
      'client_name','hiring_manager','slots_available','start_date','target_fill_date','assigned_recruiter_id','benefits'];
    const sets = ['updated_at=NOW()']; const vals = [req.params.id, req.tenantId];
    fields.forEach(f => { if (f in b) { sets.push(`${f}=$${vals.length+1}`); vals.push(b[f]); } });
    if (b.tags !== undefined) { sets.push(`tags=$${vals.length+1}`); vals.push(JSON.stringify(b.tags)); }
    const { rows } = await dbQuery(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`, vals);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

jobsRouter.delete('/:id', async (req, res) => {
  try {
    await dbQuery('UPDATE jobs SET status=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3', ['closed', req.params.id, req.tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submissions sub-route
jobsRouter.get('/:id/submissions', async (req, res) => {
  try {
    const { rows } = await dbQuery(
      `SELECT s.*, c.full_name, c.specialty, c.location_city, c.location_state, c.phone, c.email, c.npi
       FROM submissions s JOIN candidates c ON c.id=s.candidate_id
       WHERE s.job_id=$1 AND s.tenant_id=$2 ORDER BY s.submitted_at DESC`,
      [req.params.id, req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.jobsRouter = jobsRouter;

// ═══════════════════════════════════════════════════════
// Submissions
// ═══════════════════════════════════════════════════════
const subsRouter = require('express').Router({ mergeParams: true });

subsRouter.post('/:jobId/submit', async (req, res) => {
  try {
    const { candidate_id, note, offered_rate, bill_rate } = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO submissions(id,tenant_id,candidate_id,job_id,recruiter_id,stage,notes,offered_rate,bill_rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(candidate_id,job_id,tenant_id) DO UPDATE SET stage=EXCLUDED.stage,notes=EXCLUDED.notes,updated_at=NOW() RETURNING *`,
      [uuidv4(),req.tenantId,candidate_id,req.params.jobId,req.user.id,'submitted',note,offered_rate,bill_rate]
    );
    await logActivity(req.tenantId,'candidate',candidate_id,req.user.id,'submitted',`Submitted to job`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.subsRouter = subsRouter;

// ═══════════════════════════════════════════════════════
// Conversations & Messages
// ═══════════════════════════════════════════════════════
const convRouter = require('express').Router({ mergeParams: true });

convRouter.get('/:candidateId/conversations', async (req, res) => {
  try {
    const { rows } = await dbQuery(
      `SELECT conv.*, COUNT(m.id)::int as message_count,
              MAX(m.sent_at) as last_message_at
       FROM conversations conv LEFT JOIN messages m ON m.conversation_id=conv.id
       WHERE conv.candidate_id=$1 AND conv.tenant_id=$2
       GROUP BY conv.id ORDER BY MAX(m.sent_at) DESC NULLS LAST`,
      [req.params.candidateId, req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

convRouter.get('/:candidateId/conversations/:convId/messages', async (req, res) => {
  try {
    const { rows } = await dbQuery(
      `SELECT m.*, u.first_name||' '||u.last_name as sender_name FROM messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 AND m.tenant_id=$2 ORDER BY m.sent_at ASC`,
      [req.params.convId, req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

convRouter.post('/:candidateId/conversations', async (req, res) => {
  try {
    const { platform, subject } = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO conversations(id,tenant_id,candidate_id,platform,subject) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [uuidv4(),req.tenantId,req.params.candidateId,platform,subject]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

convRouter.post('/:candidateId/conversations/:convId/messages', async (req, res) => {
  try {
    const { body, subject, channel, direction='outbound', attachments=[] } = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO messages(id,tenant_id,conversation_id,candidate_id,sender_id,platform,direction,subject,body,attachments)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [uuidv4(),req.tenantId,req.params.convId,req.params.candidateId,req.user.id,
       channel||'email',direction,subject,body,JSON.stringify(attachments)]);
    await dbQuery('UPDATE conversations SET last_message_at=NOW(),message_count=message_count+1 WHERE id=$1', [req.params.convId]);
    await logActivity(req.tenantId,'candidate',req.params.candidateId,req.user.id,'message_sent',`${channel||'Email'} sent`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.convRouter = convRouter;

// ═══════════════════════════════════════════════════════
// Credentials
// ═══════════════════════════════════════════════════════
const credRouter = require('express').Router({ mergeParams: true });

credRouter.get('/:candidateId/credentials', async (req, res) => {
  try {
    const { rows } = await dbQuery('SELECT * FROM credentials WHERE candidate_id=$1 AND tenant_id=$2 ORDER BY expiry_date ASC', [req.params.candidateId, req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

credRouter.post('/:candidateId/credentials', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO credentials(id,tenant_id,candidate_id,type,name,issuer,license_number,issue_date,expiry_date,state,status,notes,alert_days_before)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [uuidv4(),req.tenantId,req.params.candidateId,b.type,b.name,b.issuer,b.license_number,b.issue_date,b.expiry_date,b.state,b.status||'active',b.notes,b.alert_days_before||30]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

credRouter.patch('/:candidateId/credentials/:credId', async (req, res) => {
  try {
    const b = req.body;
    const fields = ['type','name','issuer','license_number','issue_date','expiry_date','state','status','notes'];
    const sets = ['updated_at=NOW()']; const vals = [req.params.credId, req.tenantId];
    fields.forEach(f => { if (f in b) { sets.push(`${f}=$${vals.length+1}`); vals.push(b[f]); } });
    const { rows } = await dbQuery(`UPDATE credentials SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`, vals);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

credRouter.get('/credentials/expiring', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const { rows } = await dbQuery(
      `SELECT cr.*, c.full_name, c.specialty FROM credentials cr JOIN candidates c ON c.id=cr.candidate_id WHERE cr.tenant_id=$1 AND cr.expiry_date BETWEEN NOW() AND NOW()+INTERVAL '${parseInt(days)} days' ORDER BY cr.expiry_date ASC`,
      [req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.credRouter = credRouter;

// ═══════════════════════════════════════════════════════
// Upload — Resume parsing
// ═══════════════════════════════════════════════════════
const uploadRouter = require('express').Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20*1024*1024 } });

uploadRouter.post('/resume', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, buffer, mimetype } = req.file;
    let text = '';
    const ext = originalname.toLowerCase().split('.').pop();
    if (ext === 'txt') {
      text = buffer.toString('utf-8');
    } else if (ext === 'pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        text = data.text;
      } catch(e) {
        // Fallback: extract printable chars
        text = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g,' ').replace(/ {3,}/g,' ');
      }
    } else if (ext === 'docx' || ext === 'doc') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch(e) {
        text = buffer.toString('utf-8', 0, buffer.length, 'replace');
      }
    }
    res.json({ text: text.slice(0, 8000), filename: originalname, mimetype });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.uploadRouter = uploadRouter;

// ═══════════════════════════════════════════════════════
// Providers (open source search aggregator)
// ═══════════════════════════════════════════════════════
const provRouter = require('express').Router();

// Healthgrades open search stub (no paid API needed — links to public data)
provRouter.get('/search', async (req, res) => {
  const { q, specialty, state, city } = req.query;
  // Returns search params for open sources — actual scraping done client-side via links
  res.json({
    npi_search: `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(q||'')}&taxonomy_description=${encodeURIComponent(specialty||'')}&state=${state||''}&city=${encodeURIComponent(city||'')}&limit=25`,
    healthgrades_url: `https://www.healthgrades.com/find-a-doctor/search?what=${encodeURIComponent(specialty||q||'')}&where=${encodeURIComponent([city,state].filter(Boolean).join(', '))}`,
    doximity_url: `https://www.doximity.com/search#query=${encodeURIComponent([q,specialty].filter(Boolean).join(' '))}`,
    linkedin_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([q,specialty,'physician'].filter(Boolean).join(' '))}`,
    sharecare_url: `https://www.sharecare.com/doctor/search?q=${encodeURIComponent(specialty||q||'')}&location=${encodeURIComponent([city,state].filter(Boolean).join(', '))}`,
    sources: ['NPPES/CMS','Healthgrades','Doximity','LinkedIn','Sharecare'],
    note: 'Use NPI API for structured data; other sources provide profile links'
  });
});

module.exports.provRouter = provRouter;

// ═══════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════
const analyticsRouter = require('express').Router();

analyticsRouter.get('/overview', async (req, res) => {
  try { res.json(await getAnalyticsData(req.tenantId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

async function getAnalyticsData(tid) {
  const [specs, states, stages, sources, monthly, recruiterPerf] = await Promise.all([
    dbQuery(`SELECT specialty, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY specialty ORDER BY c DESC LIMIT 10`, [tid]),
    dbQuery(`SELECT location_state, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY location_state ORDER BY c DESC LIMIT 10`, [tid]),
    dbQuery(`SELECT stage, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY stage`, [tid]),
    dbQuery(`SELECT source, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY source ORDER BY c DESC`, [tid]),
    dbQuery(`SELECT TO_CHAR(DATE_TRUNC('month',created_at),'Mon YY') as month, COUNT(*) c FROM candidates WHERE tenant_id=$1 AND created_at > NOW()-INTERVAL '12 months' GROUP BY 1 ORDER BY DATE_TRUNC('month',MIN(created_at))`, [tid]),
    dbQuery(`SELECT u.first_name||' '||u.last_name as name, COUNT(c.id) total, SUM(CASE WHEN c.stage='placed' THEN 1 ELSE 0 END) placed FROM users u LEFT JOIN candidates c ON c.assigned_recruiter_id=u.id AND c.tenant_id=$1 WHERE u.tenant_id=$1 AND u.role='recruiter' GROUP BY u.id,u.first_name,u.last_name`, [tid]),
  ]);
  return { specialties: specs.rows, states: states.rows, stages: stages.rows, sources: sources.rows, monthly: monthly.rows, recruiter_performance: recruiterPerf.rows };
}

module.exports.analyticsRouter = analyticsRouter;

// ═══════════════════════════════════════════════════════
// Recruiters
// ═══════════════════════════════════════════════════════
const recRouter = require('express').Router();

recRouter.get('/', async (req, res) => {
  try {
    const { rows } = await dbQuery(
      `SELECT r.*, u.avatar_url, COUNT(c.id)::int as candidate_count,
              SUM(CASE WHEN c.stage='placed' THEN 1 ELSE 0 END)::int as placements
       FROM recruiters r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN candidates c ON c.assigned_recruiter_id=r.user_id AND c.tenant_id=r.tenant_id
       WHERE r.tenant_id=$1 GROUP BY r.id, u.avatar_url ORDER BY r.first_name`, [req.tenantId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message }); }
});

recRouter.post('/', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await dbQuery(
      `INSERT INTO recruiters(id,tenant_id,user_id,first_name,last_name,email,phone,role,specialty_focus,territory,target_placements,commission_rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [uuidv4(),req.tenantId,b.user_id||null,b.first_name,b.last_name,b.email,b.phone,b.role||'recruiter',
       JSON.stringify(b.specialty_focus||[]),JSON.stringify(b.territory||[]),b.target_placements||0,b.commission_rate||null]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

recRouter.patch('/:id', async (req, res) => {
  try {
    const b = req.body;
    const fields = ['first_name','last_name','email','phone','role','target_placements','commission_rate'];
    const sets=['updated_at=NOW()']; const vals=[req.params.id,req.tenantId];
    fields.forEach(f=>{if(f in b){sets.push(`${f}=$${vals.length+1}`);vals.push(b[f]);}});
    if(b.specialty_focus){sets.push(`specialty_focus=$${vals.length+1}`);vals.push(JSON.stringify(b.specialty_focus));}
    if(b.territory){sets.push(`territory=$${vals.length+1}`);vals.push(JSON.stringify(b.territory));}
    const {rows}=await dbQuery(`UPDATE recruiters SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,vals);
    res.json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

recRouter.delete('/:id', async (req, res) => {
  try {
    await dbQuery('DELETE FROM recruiters WHERE id=$1 AND tenant_id=$2',[req.params.id,req.tenantId]);
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.recRouter = recRouter;

// ═══════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════
const searchRouter = require('express').Router();

searchRouter.get('/specialties', async (req, res) => {
  try {
    const {rows}=await dbQuery(`SELECT DISTINCT specialty FROM candidates WHERE tenant_id=$1 AND specialty IS NOT NULL ORDER BY specialty`,[req.tenantId]);
    res.json(rows.map(r=>r.specialty));
  } catch(err){res.status(500).json({error:err.message});}
});

searchRouter.get('/global', async (req, res) => {
  try {
    const {q=''}=req.query;
    if(!q||q.length<2) return res.json({candidates:[],jobs:[]});
    const [cands,jobs]=await Promise.all([
      dbQuery(`SELECT id,candidate_id,full_name,specialty,location_state,'candidate' as type FROM candidates WHERE tenant_id=$1 AND is_archived=false AND (full_name ILIKE $2 OR specialty ILIKE $2 OR email ILIKE $2 OR npi ILIKE $2) LIMIT 10`,[req.tenantId,`%${q}%`]),
      dbQuery(`SELECT id,title,facility_name,location_city,'job' as type FROM jobs WHERE tenant_id=$1 AND status='open' AND (title ILIKE $2 OR specialty ILIKE $2 OR facility_name ILIKE $2) LIMIT 5`,[req.tenantId,`%${q}%`]),
    ]);
    res.json({candidates:cands.rows,jobs:jobs.rows});
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.searchRouter = searchRouter;

// ═══════════════════════════════════════════════════════
// Outreach
// ═══════════════════════════════════════════════════════
const outreachRouter = require('express').Router();

outreachRouter.get('/templates', async (req, res) => {
  try {
    const {rows}=await dbQuery('SELECT * FROM message_templates WHERE tenant_id=$1 AND is_active=true ORDER BY name',[req.tenantId]);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

outreachRouter.post('/templates', async (req, res) => {
  try {
    const b=req.body;
    const {rows}=await dbQuery(
      `INSERT INTO message_templates(id,tenant_id,name,channel,subject,body,category,variables,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [uuidv4(),req.tenantId,b.name,b.channel,b.subject,b.body,b.category,JSON.stringify(b.variables||[]),req.user.id]);
    res.status(201).json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

outreachRouter.post('/send', async (req, res) => {
  try {
    const {candidate_id,channel,subject,body,conversation_id}=req.body;
    let convId = conversation_id;
    if (!convId) {
      const existing = await dbQuery('SELECT id FROM conversations WHERE candidate_id=$1 AND platform=$2 AND tenant_id=$3 LIMIT 1',[candidate_id,channel,req.tenantId]);
      if (existing.rows.length) { convId=existing.rows[0].id; }
      else {
        const newConv=await dbQuery('INSERT INTO conversations(id,tenant_id,candidate_id,platform,subject) VALUES($1,$2,$3,$4,$5) RETURNING id',[uuidv4(),req.tenantId,candidate_id,channel,subject]);
        convId=newConv.rows[0].id;
      }
    }
    const {rows}=await dbQuery(
      `INSERT INTO messages(id,tenant_id,conversation_id,candidate_id,sender_id,platform,direction,subject,body) VALUES($1,$2,$3,$4,$5,$6,'outbound',$7,$8) RETURNING *`,
      [uuidv4(),req.tenantId,convId,candidate_id,req.user.id,channel,subject,body]);
    await dbQuery('UPDATE conversations SET last_message_at=NOW(),message_count=message_count+1 WHERE id=$1',[convId]);
    await logActivity(req.tenantId,'candidate',candidate_id,req.user.id,'message_sent',`${channel} message sent${subject?': '+subject:''}`);
    res.status(201).json({success:true,message:rows[0],conversation_id:convId});
  } catch(err){res.status(500).json({error:err.message});}
});

outreachRouter.get('/history/:candidateId', async (req, res) => {
  try {
    const {rows}=await dbQuery(
      `SELECT m.*, conv.platform, u.first_name||' '||u.last_name as sender_name FROM messages m JOIN conversations conv ON conv.id=m.conversation_id LEFT JOIN users u ON u.id=m.sender_id WHERE m.candidate_id=$1 AND m.tenant_id=$2 ORDER BY m.sent_at DESC`,
      [req.params.candidateId,req.tenantId]);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.outreachRouter = outreachRouter;

// ═══════════════════════════════════════════════════════
// BOB (Book of Business)
// ═══════════════════════════════════════════════════════
const bobRouter = require('express').Router();

bobRouter.get('/', async (req, res) => {
  try {
    const {recruiter_id=''}=req.query;
    const where='c.tenant_id=$1 AND c.is_archived=false'+(recruiter_id?` AND c.assigned_recruiter_id='${recruiter_id}'`:'');
    const [cands,stages]=await Promise.all([
      dbQuery(`SELECT c.*,u.first_name||' '||u.last_name as recruiter_name FROM candidates c LEFT JOIN users u ON u.id=c.assigned_recruiter_id WHERE ${where} ORDER BY c.updated_at DESC LIMIT 200`,[req.tenantId]),
      dbQuery(`SELECT stage,COUNT(*)c FROM candidates c WHERE ${where} GROUP BY stage`,[req.tenantId]),
    ]);
    const stageMap={};
    ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold'].forEach(s=>stageMap[s]=0);
    stages.rows.forEach(r=>stageMap[r.stage]=(stageMap[r.stage]||0)+parseInt(r.c));
    res.json({candidates:cands.rows,stages:stageMap});
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.bobRouter = bobRouter;

// ═══════════════════════════════════════════════════════
// Manager
// ═══════════════════════════════════════════════════════
const managerRouter = require('express').Router();

managerRouter.get('/', async (req, res) => {
  try {
    const [recs,totals]=await Promise.all([
      dbQuery(`SELECT r.*, u.avatar_url, COUNT(c.id)::int as candidate_count,
               SUM(CASE WHEN c.stage='placed' THEN 1 ELSE 0 END)::int as placements,
               SUM(CASE WHEN c.stage NOT IN ('placed','rejected') THEN 1 ELSE 0 END)::int as active
               FROM recruiters r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN candidates c ON c.assigned_recruiter_id=r.user_id AND c.tenant_id=r.tenant_id
               WHERE r.tenant_id=$1 GROUP BY r.id,u.avatar_url ORDER BY r.first_name`,[req.tenantId]),
      dbQuery(`SELECT COUNT(*)::int total,(SELECT COUNT(*)::int FROM candidates WHERE tenant_id=$1 AND stage='placed') placed FROM candidates WHERE tenant_id=$1 AND is_archived=false`,[req.tenantId]),
    ]);
    res.json({recruiters:recs.rows,total_candidates:totals.rows[0].total,total_placed:totals.rows[0].placed});
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.managerRouter = managerRouter;

// ═══════════════════════════════════════════════════════
// Activity
// ═══════════════════════════════════════════════════════
const activityRouter = require('express').Router();

activityRouter.get('/', async (req, res) => {
  try {
    const {entity_id,entity_type,limit=50}=req.query;
    let where='al.tenant_id=$1'; const params=[req.tenantId];
    if(entity_id){params.push(entity_id);where+=` AND al.entity_id=$${params.length}`;}
    if(entity_type){params.push(entity_type);where+=` AND al.entity_type=$${params.length}`;}
    const {rows}=await dbQuery(`SELECT al.*,u.first_name||' '||u.last_name as user_name,u.avatar_url FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE ${where} ORDER BY al.created_at DESC LIMIT ${parseInt(limit)}`,params);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.activityRouter = activityRouter;

// ═══════════════════════════════════════════════════════
// Integrations config
// ═══════════════════════════════════════════════════════
const integrationsRouter = require('express').Router();

integrationsRouter.get('/', async (req, res) => {
  try {
    const {rows}=await dbQuery('SELECT id,type,name,is_active,last_sync,sync_status,created_at FROM integrations WHERE tenant_id=$1',[req.tenantId]);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

integrationsRouter.put('/:type', async (req, res) => {
  try {
    const {name,config,is_active}=req.body;
    const {rows}=await dbQuery(
      `INSERT INTO integrations(id,tenant_id,type,name,config,is_active) VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(tenant_id,type) DO UPDATE SET name=EXCLUDED.name,config=EXCLUDED.config,is_active=EXCLUDED.is_active,updated_at=NOW() RETURNING id,type,name,is_active`,
      [uuidv4(),req.tenantId,req.params.type,name,JSON.stringify(config||{}),is_active!==false]);
    res.json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.integrationsRouter = integrationsRouter;

// ═══════════════════════════════════════════════════════
// Job Boards (integration stubs — add API keys later)
// ═══════════════════════════════════════════════════════
const jobBoardsRouter = require('express').Router();

const JOB_BOARD_LINKS = {
  indeed: (title,location) => `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}&l=${encodeURIComponent(location)}`,
  linkedin: (title,location) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}`,
  healthgrades: (spec) => `https://www.healthgrades.com/find-a-doctor/search?what=${encodeURIComponent(spec)}`,
  practicematch: (spec,state) => `https://www.practicematch.com/physician-job-search?specialty=${encodeURIComponent(spec)}&state=${state}`,
  physiciansPractice: (spec) => `https://www.physicianspractice.com/jobs?specialty=${encodeURIComponent(spec)}`,
  aafp: (spec) => `https://cfmatch.aafp.org/search/jobs?specialty=${encodeURIComponent(spec)}`,
  doximity: (spec,state) => `https://www.doximity.com/jobs?specialty=${encodeURIComponent(spec)}&state=${state}`,
  ziprecruiter: (title) => `https://www.ziprecruiter.com/Jobs/Medical/-in-,US?q=${encodeURIComponent(title)}`,
};

jobBoardsRouter.get('/links', async (req, res) => {
  const {title='',specialty='',location='',state=''} = req.query;
  const links = {};
  Object.entries(JOB_BOARD_LINKS).forEach(([board, fn]) => {
    try { links[board] = fn(title||specialty, location||state, specialty, state); }
    catch(e) { links[board] = '#'; }
  });
  res.json({ links, boards: Object.keys(JOB_BOARD_LINKS) });
});

jobBoardsRouter.get('/status', async (req, res) => {
  const {rows}=await dbQuery('SELECT type,is_active,last_sync FROM integrations WHERE tenant_id=$1',[req.tenantId]).catch(()=>({rows:[]}));
  const configured = rows.reduce((acc,r)=>{acc[r.type]=r;return acc;},{});
  res.json({
    boards: [
      {id:'indeed',name:'Indeed',type:'job_board',status:configured.indeed?.is_active?'connected':'available',requires_api_key:true},
      {id:'linkedin',name:'LinkedIn',type:'job_board',status:configured.linkedin?.is_active?'connected':'available',requires_api_key:true},
      {id:'doximity',name:'Doximity',type:'provider_search',status:'available_via_link',requires_api_key:false},
      {id:'npi_registry',name:'NPI Registry',type:'provider_search',status:'connected',requires_api_key:false},
      {id:'healthgrades',name:'Healthgrades',type:'provider_search',status:'available_via_link',requires_api_key:false},
      {id:'practicematch',name:'PracticeMatch',type:'job_board',status:'available_via_link',requires_api_key:true},
      {id:'bullhorn',name:'Bullhorn',type:'ats_migration',status:'available',requires_api_key:true},
      {id:'ceipal',name:'Ceipal',type:'ats_migration',status:'available',requires_api_key:true},
      {id:'google_calendar',name:'Google Calendar',type:'calendar',status:'available',requires_api_key:true},
      {id:'outlook',name:'Outlook/MS365',type:'email',status:'available',requires_api_key:true},
      {id:'twilio',name:'Twilio SMS',type:'sms',status:configured.twilio?.is_active?'connected':'available',requires_api_key:true},
      {id:'sendgrid',name:'SendGrid',type:'email',status:configured.sendgrid?.is_active?'connected':'available',requires_api_key:true},
      {id:'zoom',name:'Zoom',type:'video',status:'available_via_link',requires_api_key:false},
      {id:'dialpad',name:'Dialpad',type:'calling',status:'available_via_link',requires_api_key:false},
      {id:'ring_central',name:'RingCentral',type:'calling',status:'available',requires_api_key:true},
    ]
  });
});

module.exports.jobBoardsRouter = jobBoardsRouter;

// ═══════════════════════════════════════════════════════
// Interviews
// ═══════════════════════════════════════════════════════
const interviewsRouter = require('express').Router();

interviewsRouter.get('/', async (req, res) => {
  try {
    const {candidate_id,job_id}=req.query;
    let where='i.tenant_id=$1'; const params=[req.tenantId];
    if(candidate_id){params.push(candidate_id);where+=` AND i.candidate_id=$${params.length}`;}
    if(job_id){params.push(job_id);where+=` AND i.job_id=$${params.length}`;}
    const {rows}=await dbQuery(`SELECT i.*,c.full_name,j.title FROM interviews i JOIN candidates c ON c.id=i.candidate_id JOIN jobs j ON j.id=i.job_id WHERE ${where} ORDER BY i.scheduled_at`,params);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

interviewsRouter.post('/', async (req, res) => {
  try {
    const b=req.body;
    const {rows}=await dbQuery(
      `INSERT INTO interviews(id,tenant_id,candidate_id,job_id,submission_id,interviewer_name,interview_type,scheduled_at,duration_minutes,location,video_link,status,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [uuidv4(),req.tenantId,b.candidate_id,b.job_id,b.submission_id,b.interviewer_name,b.interview_type,b.scheduled_at,b.duration_minutes,b.location,b.video_link,b.status||'scheduled',b.notes]);
    await logActivity(req.tenantId,'candidate',b.candidate_id,req.user.id,'interview_scheduled',`Interview scheduled: ${b.interview_type||'Interview'}`);
    res.status(201).json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

interviewsRouter.patch('/:id', async (req, res) => {
  try {
    const b=req.body;
    const fields=['status','outcome','score','feedback','notes','scheduled_at'];
    const sets=['updated_at=NOW()']; const vals=[req.params.id,req.tenantId];
    fields.forEach(f=>{if(f in b){sets.push(`${f}=$${vals.length+1}`);vals.push(b[f]);}});
    const {rows}=await dbQuery(`UPDATE interviews SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,vals);
    res.json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.interviewsRouter = interviewsRouter;

// ═══════════════════════════════════════════════════════
// Placements
// ═══════════════════════════════════════════════════════
const placementsRouter = require('express').Router();

placementsRouter.get('/', async (req, res) => {
  try {
    const {rows}=await dbQuery(
      `SELECT p.*,c.full_name,j.title,j.facility_name,u.first_name||' '||u.last_name as recruiter_name FROM placements p JOIN candidates c ON c.id=p.candidate_id JOIN jobs j ON j.id=p.job_id LEFT JOIN users u ON u.id=p.recruiter_id WHERE p.tenant_id=$1 ORDER BY p.created_at DESC`,
      [req.tenantId]);
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

placementsRouter.post('/', async (req, res) => {
  try {
    const b=req.body;
    const {rows}=await dbQuery(
      `INSERT INTO placements(id,tenant_id,submission_id,candidate_id,job_id,recruiter_id,start_date,end_date,employment_type,bill_rate,pay_rate,fee_amount,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [uuidv4(),req.tenantId,b.submission_id,b.candidate_id,b.job_id,b.recruiter_id||req.user.id,b.start_date,b.end_date,b.employment_type,b.bill_rate,b.pay_rate,b.fee_amount,b.notes]);
    // Mark candidate as placed
    await dbQuery('UPDATE candidates SET stage=$1,status=$1,updated_at=NOW() WHERE id=$2',['placed',b.candidate_id]);
    await logActivity(req.tenantId,'candidate',b.candidate_id,req.user.id,'placed','Candidate placed ✓');
    res.status(201).json(rows[0]);
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports.placementsRouter = placementsRouter;
