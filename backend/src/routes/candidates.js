const express = require('express');
const { query } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const STAGES = ['sourced','contacted','screening','interview','offer','placed','rejected','on_hold'];

// GET /api/candidates — list with full filtering
router.get('/', async (req, res) => {
  try {
    const { q='', specialty='', status='', state='', recruiter_id='', stage='',
            source='', tag='', priority='', page=1, limit=25, sort='created_at', order='DESC' } = req.query;
    const offset = (parseInt(page)-1) * parseInt(limit);
    const conditions = ['c.tenant_id=$1','c.is_archived=false'];
    const params = [req.tenantId];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(c.full_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.specialty ILIKE $${params.length} OR c.npi ILIKE $${params.length} OR c.candidate_id ILIKE $${params.length} OR c.current_employer ILIKE $${params.length})`);
    }
    if (specialty) { params.push(`%${specialty}%`); conditions.push(`c.specialty ILIKE $${params.length}`); }
    if (status || stage) { params.push(status||stage); conditions.push(`c.stage=$${params.length}`); }
    if (state) { params.push(state); conditions.push(`c.location_state=$${params.length}`); }
    if (recruiter_id) { params.push(recruiter_id); conditions.push(`c.assigned_recruiter_id=$${params.length}`); }
    if (source) { params.push(source); conditions.push(`c.source=$${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`c.priority=$${params.length}`); }
    if (tag) { params.push(`%${tag}%`); conditions.push(`c.tags::text ILIKE $${params.length}`); }

    const whereClause = conditions.join(' AND ');
    const safeSort = ['created_at','updated_at','full_name','specialty','stage','last_contacted'].includes(sort) ? sort : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countRes = await query(`SELECT COUNT(*) FROM candidates c WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await query(
      `SELECT c.*, u.first_name||' '||u.last_name as recruiter_name
       FROM candidates c
       LEFT JOIN users u ON u.id=c.assigned_recruiter_id
       WHERE ${whereClause}
       ORDER BY c.${safeSort} ${safeOrder}
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );

    res.json({ total, page: parseInt(page), limit: parseInt(limit), candidates: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candidates/stats
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT stage, COUNT(*) as count FROM candidates WHERE tenant_id=$1 AND is_archived=false GROUP BY stage`,
      [req.tenantId]
    );
    const total_res = await query('SELECT COUNT(*) FROM candidates WHERE tenant_id=$1 AND is_archived=false', [req.tenantId]);
    const by_stage = {};
    STAGES.forEach(s => { by_stage[s] = 0; });
    rows.forEach(r => { by_stage[r.stage] = parseInt(r.count); });
    res.json({ total: parseInt(total_res.rows[0].count), by_stage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candidates/:id — full profile
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.first_name||' '||u.last_name as recruiter_name, u.email as recruiter_email
       FROM candidates c LEFT JOIN users u ON u.id=c.assigned_recruiter_id
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, req.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Candidate not found' });
    const candidate = rows[0];

    // Fetch related data in parallel
    const [actRes, credRes, subRes, convRes] = await Promise.all([
      query(`SELECT al.*, u.first_name||' '||u.last_name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.entity_id=$1 ORDER BY al.created_at DESC LIMIT 50`, [req.params.id]),
      query(`SELECT * FROM credentials WHERE candidate_id=$1 ORDER BY expiry_date ASC`, [req.params.id]),
      query(`SELECT s.*, j.title as job_title, j.facility_name, j.location_city, j.location_state FROM submissions s JOIN jobs j ON j.id=s.job_id WHERE s.candidate_id=$1 ORDER BY s.created_at DESC`, [req.params.id]),
      query(`SELECT conv.*, COUNT(m.id) as message_count FROM conversations conv LEFT JOIN messages m ON m.conversation_id=conv.id WHERE conv.candidate_id=$1 GROUP BY conv.id ORDER BY conv.last_message_at DESC`, [req.params.id]),
    ]);

    candidate.activities = actRes.rows;
    candidate.credentials = credRes.rows;
    candidate.submissions = subRes.rows;
    candidate.conversations = convRes.rows;

    // Track view
    await query('UPDATE candidates SET last_activity=NOW() WHERE id=$1', [req.params.id]);

    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates — create
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (b.email) {
      const dup = await query('SELECT id FROM candidates WHERE email=$1 AND tenant_id=$2 AND is_archived=false', [b.email, req.tenantId]);
      if (dup.rows.length) return res.status(409).json({ error: 'Candidate with this email already exists', existing_id: dup.rows[0].id });
    }
    const count = await query('SELECT COUNT(*) FROM candidates WHERE tenant_id=$1', [req.tenantId]);
    const cid = uuidv4();
    const { rows } = await query(
      `INSERT INTO candidates(id,tenant_id,candidate_id,full_name,first_name,last_name,email,phone,specialty,subspecialty,credential,npi,location_city,location_state,years_experience,current_employer,current_title,status,stage,source,assigned_recruiter_id,notes,tags,skills,education,work_experience,linkedin_url,visa_status,us_authorized,employment_preference,priority)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       RETURNING *`,
      [cid, req.tenantId, `PIQ-${100001+parseInt(count.rows[0].count)}`,
       `${b.first_name||''} ${b.last_name||''}`.trim() || b.full_name || 'Unknown',
       b.first_name||'', b.last_name||'', b.email||null, b.phone||null,
       b.specialty||null, b.subspecialty||null, b.credential||null, b.npi||null,
       b.location_city||null, b.location_state||null, b.years_experience||null,
       b.current_employer||null, b.current_title||null,
       b.stage||'sourced', b.stage||'sourced', b.source||'manual',
       b.assigned_recruiter_id||req.user.id, b.notes||null,
       JSON.stringify(b.tags||[]), JSON.stringify(b.skills||[]),
       JSON.stringify(b.education||[]), JSON.stringify(b.work_experience||[]),
       b.linkedin_url||null, b.visa_status||null, b.us_authorized!==false,
       b.employment_preference||null, b.priority||'normal']
    );
    await logActivity(req.tenantId, 'candidate', cid, req.user.id, 'created', 'Profile created');
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/candidates/:id — update
router.patch('/:id', async (req, res) => {
  try {
    const b = req.body;
    const fields = ['full_name','first_name','last_name','email','phone','alt_phone','specialty',
      'subspecialty','credential','npi','location_city','location_state','location_zip','years_experience',
      'current_employer','current_title','current_salary','desired_salary','status','stage','sub_stage',
      'source','priority','notes','internal_notes','assigned_recruiter_id','linkedin_url','doximity_url',
      'visa_status','us_authorized','employment_preference','willing_to_relocate','do_not_contact',
      'available_date','rating'];
    const jsonFields = ['education','work_experience','licenses','certifications','board_certifications',
      'hospital_affiliations','skills','languages','tags','relocation_preferences'];

    const sets = []; const vals = [req.params.id, req.tenantId];
    fields.forEach(f => {
      if (f in b) { sets.push(`${f}=$${vals.length+1}`); vals.push(b[f]); }
    });
    jsonFields.forEach(f => {
      if (f in b) { sets.push(`${f}=$${vals.length+1}`); vals.push(JSON.stringify(b[f])); }
    });
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    sets.push('updated_at=NOW()');

    const old = b.stage;
    const { rows } = await query(
      `UPDATE candidates SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`, vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (b.stage && b.stage !== old) {
      await logActivity(req.tenantId, 'candidate', req.params.id, req.user.id, 'stage_change', `Stage → ${b.stage}`);
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/candidates/:id — archive
router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE candidates SET is_archived=true,updated_at=NOW() WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    await logActivity(req.tenantId, 'candidate', req.params.id, req.user.id, 'archived', 'Candidate archived');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates/:id/notes
router.post('/:id/notes', async (req, res) => {
  try {
    const { content, is_internal } = req.body;
    await logActivity(req.tenantId, 'candidate', req.params.id, req.user.id,
      is_internal ? 'internal_note' : 'note', content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candidates/:id/timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT al.*, u.first_name||' '||u.last_name as user_name, u.avatar_url
       FROM activity_log al LEFT JOIN users u ON u.id=al.user_id
       WHERE al.entity_id=$1 ORDER BY al.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates/bulk — bulk operations
router.post('/bulk', async (req, res) => {
  try {
    const { action, candidate_ids, data } = req.body;
    if (!candidate_ids?.length) return res.status(400).json({ error: 'No candidates specified' });
    const placeholders = candidate_ids.map((_,i) => `$${i+2}`).join(',');

    if (action === 'stage_change') {
      await query(`UPDATE candidates SET stage=$1,status=$1,updated_at=NOW() WHERE id IN (${placeholders}) AND tenant_id=$${candidate_ids.length+2}`,
        [data.stage, ...candidate_ids, req.tenantId]);
    } else if (action === 'assign') {
      await query(`UPDATE candidates SET assigned_recruiter_id=$1,updated_at=NOW() WHERE id IN (${placeholders}) AND tenant_id=$${candidate_ids.length+2}`,
        [data.recruiter_id, ...candidate_ids, req.tenantId]);
    } else if (action === 'tag') {
      for (const id of candidate_ids) {
        const { rows } = await query('SELECT tags FROM candidates WHERE id=$1', [id]);
        const existing = rows[0]?.tags || [];
        const merged = [...new Set([...existing, data.tag])];
        await query('UPDATE candidates SET tags=$1 WHERE id=$2', [JSON.stringify(merged), id]);
      }
    } else if (action === 'archive') {
      await query(`UPDATE candidates SET is_archived=true WHERE id IN (${placeholders}) AND tenant_id=$${candidate_ids.length+2}`,
        [...candidate_ids, req.tenantId]);
    }
    res.json({ success: true, affected: candidate_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function logActivity(tenantId, entityType, entityId, userId, action, description, meta={}) {
  try {
    await query(
      'INSERT INTO activity_log(id,tenant_id,entity_type,entity_id,user_id,action,description,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [uuidv4(), tenantId, entityType, entityId, userId, action, description, JSON.stringify(meta)]
    );
  } catch(e) {}
}

module.exports = router;
module.exports.logActivity = logActivity;
