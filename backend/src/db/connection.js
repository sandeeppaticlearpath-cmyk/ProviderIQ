const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('PostgreSQL pool error:', err));

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) logger.warn(`Slow query (${duration}ms): ${text.slice(0, 80)}`);
    return res;
  } catch (err) {
    logger.error('Query error:', { text: text.slice(0, 80), params, err: err.message });
    throw err;
  }
}

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

    // ─── Tenants (Organizations) ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        plan VARCHAR(50) DEFAULT 'professional',
        logo_url TEXT,
        website TEXT,
        phone TEXT,
        address TEXT,
        industry VARCHAR(100) DEFAULT 'healthcare',
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Users ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'recruiter',
        avatar_url TEXT,
        phone TEXT,
        title TEXT,
        bio TEXT,
        permissions JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      )
    `);

    // ─── Candidates ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id VARCHAR(30),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        full_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(30),
        alt_phone VARCHAR(30),
        specialty VARCHAR(150),
        subspecialty VARCHAR(150),
        credential VARCHAR(50),
        npi VARCHAR(20),
        dea_number VARCHAR(30),
        license_states JSONB DEFAULT '[]',
        location_city VARCHAR(100),
        location_state VARCHAR(50),
        location_zip VARCHAR(20),
        location_country VARCHAR(100) DEFAULT 'USA',
        willing_to_relocate BOOLEAN DEFAULT false,
        relocation_preferences JSONB DEFAULT '[]',
        years_experience INTEGER,
        current_employer VARCHAR(255),
        current_title VARCHAR(255),
        current_salary INTEGER,
        desired_salary INTEGER,
        desired_hourly NUMERIC(8,2),
        employment_preference VARCHAR(50),
        status VARCHAR(50) DEFAULT 'sourced',
        stage VARCHAR(50) DEFAULT 'sourced',
        sub_stage VARCHAR(100),
        source VARCHAR(100),
        source_detail TEXT,
        priority VARCHAR(20) DEFAULT 'normal',
        education JSONB DEFAULT '[]',
        work_experience JSONB DEFAULT '[]',
        licenses JSONB DEFAULT '[]',
        certifications JSONB DEFAULT '[]',
        board_certifications JSONB DEFAULT '[]',
        hospital_affiliations JSONB DEFAULT '[]',
        skills JSONB DEFAULT '[]',
        languages JSONB DEFAULT '[]',
        publications JSONB DEFAULT '[]',
        references JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        notes TEXT,
        internal_notes TEXT,
        assigned_recruiter_id UUID REFERENCES users(id),
        resume_file_name VARCHAR(255),
        resume_file_url TEXT,
        resume_text TEXT,
        linkedin_url TEXT,
        doximity_url TEXT,
        npi_verified BOOLEAN DEFAULT false,
        background_check_status VARCHAR(50),
        profile_completion INTEGER DEFAULT 0,
        rating NUMERIC(3,1),
        do_not_contact BOOLEAN DEFAULT false,
        gdpr_consent BOOLEAN DEFAULT true,
        visa_status VARCHAR(100),
        us_authorized BOOLEAN DEFAULT true,
        malpractice_history BOOLEAN DEFAULT false,
        available_date DATE,
        last_contacted TIMESTAMPTZ,
        last_activity TIMESTAMPTZ,
        is_archived BOOLEAN DEFAULT false,
        custom_fields JSONB DEFAULT '{}',
        integration_ids JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Conversations (multi-platform thread per candidate) ──────
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        platform_thread_id TEXT,
        subject TEXT,
        participants JSONB DEFAULT '[]',
        last_message_at TIMESTAMPTZ,
        message_count INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id),
        sender_type VARCHAR(20) DEFAULT 'recruiter',
        platform VARCHAR(50) NOT NULL,
        direction VARCHAR(10) DEFAULT 'outbound',
        subject TEXT,
        body TEXT NOT NULL,
        html_body TEXT,
        attachments JSONB DEFAULT '[]',
        status VARCHAR(30) DEFAULT 'sent',
        platform_message_id TEXT,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        read_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        failed_reason TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Jobs ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        job_code VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        requirements TEXT,
        benefits TEXT,
        specialty VARCHAR(150),
        subspecialty VARCHAR(150),
        credential_required VARCHAR(50),
        experience_years_min INTEGER,
        experience_years_max INTEGER,
        facility_name VARCHAR(255),
        facility_type VARCHAR(100),
        location_city VARCHAR(100),
        location_state VARCHAR(50),
        location_zip VARCHAR(20),
        location_country VARCHAR(100) DEFAULT 'USA',
        is_remote BOOLEAN DEFAULT false,
        employment_type VARCHAR(50),
        shift_type VARCHAR(50),
        assignment_length VARCHAR(100),
        salary_min INTEGER,
        salary_max INTEGER,
        hourly_min NUMERIC(8,2),
        hourly_max NUMERIC(8,2),
        bonus_info TEXT,
        benefits_info TEXT,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'normal',
        client_name VARCHAR(255),
        client_id UUID,
        hiring_manager VARCHAR(255),
        slots_available INTEGER DEFAULT 1,
        slots_filled INTEGER DEFAULT 0,
        start_date DATE,
        target_fill_date DATE,
        closed_date DATE,
        created_by UUID REFERENCES users(id),
        assigned_recruiter_id UUID REFERENCES users(id),
        tags JSONB DEFAULT '[]',
        custom_fields JSONB DEFAULT '{}',
        vms_job_id TEXT,
        job_board_ids JSONB DEFAULT '{}',
        views INTEGER DEFAULT 0,
        applications INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Submissions (Candidate → Job) ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        recruiter_id UUID REFERENCES users(id),
        stage VARCHAR(50) DEFAULT 'submitted',
        sub_stage VARCHAR(100),
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        interview_date TIMESTAMPTZ,
        offer_date TIMESTAMPTZ,
        start_date DATE,
        end_date DATE,
        offered_rate NUMERIC(10,2),
        bill_rate NUMERIC(10,2),
        pay_rate NUMERIC(10,2),
        fee_percent NUMERIC(5,2),
        placement_fee NUMERIC(12,2),
        rejection_reason TEXT,
        withdrawal_reason TEXT,
        notes TEXT,
        client_feedback TEXT,
        rating INTEGER,
        is_active BOOLEAN DEFAULT true,
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(candidate_id, job_id, tenant_id)
      )
    `);

    // ─── Interviews ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        interviewer_name VARCHAR(255),
        interview_type VARCHAR(50),
        scheduled_at TIMESTAMPTZ,
        duration_minutes INTEGER,
        location TEXT,
        video_link TEXT,
        status VARCHAR(50) DEFAULT 'scheduled',
        outcome VARCHAR(50),
        score INTEGER,
        feedback TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Placements ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS placements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        submission_id UUID NOT NULL REFERENCES submissions(id),
        candidate_id UUID NOT NULL REFERENCES candidates(id),
        job_id UUID NOT NULL REFERENCES jobs(id),
        recruiter_id UUID REFERENCES users(id),
        start_date DATE,
        end_date DATE,
        employment_type VARCHAR(50),
        bill_rate NUMERIC(10,2),
        pay_rate NUMERIC(10,2),
        fee_amount NUMERIC(12,2),
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Credentials & Compliance ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        issuer VARCHAR(255),
        license_number VARCHAR(100),
        issue_date DATE,
        expiry_date DATE,
        state VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        file_url TEXT,
        notes TEXT,
        alert_days_before INTEGER DEFAULT 30,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Activity log ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        description TEXT,
        old_value JSONB,
        new_value JSONB,
        metadata JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Recruiters (team metadata) ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS recruiters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(30),
        role VARCHAR(50) DEFAULT 'recruiter',
        specialty_focus JSONB DEFAULT '[]',
        territory JSONB DEFAULT '[]',
        target_placements INTEGER DEFAULT 0,
        commission_rate NUMERIC(5,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Message Templates ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        use_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Integration configs ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        config JSONB DEFAULT '{}',
        credentials JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        last_sync TIMESTAMPTZ,
        sync_status VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, type)
      )
    `);

    // ─── Saved searches ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) DEFAULT 'candidate',
        filters JSONB DEFAULT '{}',
        is_shared BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Indexes ──────────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_candidates_tenant ON candidates(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_specialty ON candidates(specialty)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_state ON candidates(location_state)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates(assigned_recruiter_id)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_npi ON candidates(npi)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email)`,
      `CREATE INDEX IF NOT EXISTS idx_candidates_fulltext ON candidates USING gin(to_tsvector('english', coalesce(full_name,'') || ' ' || coalesce(specialty,'') || ' ' || coalesce(email,'')))`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_specialty ON jobs(specialty)`,
      `CREATE INDEX IF NOT EXISTS idx_submissions_candidate ON submissions(candidate_id)`,
      `CREATE INDEX IF NOT EXISTS idx_submissions_job ON submissions(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_candidate ON messages(candidate_id)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_candidate ON conversations(candidate_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_tenant ON activity_log(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_credentials_candidate ON credentials(candidate_id)`,
      `CREATE INDEX IF NOT EXISTS idx_credentials_expiry ON credentials(expiry_date)`,
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    await client.query('COMMIT');

    // Run seed if first time
    await seedIfEmpty(pool);
    logger.info('✅ Database schema ready');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedIfEmpty(pool) {
  const { rows } = await pool.query('SELECT COUNT(*) FROM tenants');
  if (parseInt(rows[0].count) > 0) return;
  logger.info('🌱 Seeding demo data...');

  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  const tenantId = uuidv4();
  const adminId = uuidv4();
  const rec1Id = uuidv4();
  const rec2Id = uuidv4();
  const mgr1Id = uuidv4();

  await pool.query(`INSERT INTO tenants(id,name,slug,plan,industry) VALUES($1,$2,$3,$4,$5)`,
    [tenantId, 'HealthStaff Recruiters Inc.', 'healthstaff', 'enterprise', 'healthcare']);

  const adminHash = await bcrypt.hash('Admin@2024', 10);
  const recHash = await bcrypt.hash('Recruiter@2024', 10);

  await pool.query(`INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role)
    VALUES($1,$2,$3,$4,$5,$6,$7),($8,$2,$9,$10,$11,$12,$13),($14,$2,$15,$10,$16,$17,$18),($19,$2,$20,$10,$21,$22,$23)`,
    [adminId,tenantId,'admin@healthstaff.com',adminHash,'Alex','Morgan','admin',
     rec1Id,'sarah@healthstaff.com',recHash,'Sarah','Chen','recruiter',
     rec2Id,'james@healthstaff.com',recHash,'James','Rivera','recruiter',
     mgr1Id,'manager@healthstaff.com',recHash,'Karen','Wilson','hiring_manager']);

  await pool.query(`INSERT INTO recruiters(id,tenant_id,user_id,first_name,last_name,email,role,specialty_focus,territory)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9),($10,$2,$11,$12,$13,$14,$15,$16,$17)`,
    [uuidv4(),tenantId,rec1Id,'Sarah','Chen','sarah@healthstaff.com','senior',
     JSON.stringify(['Cardiology','Emergency Medicine']),JSON.stringify(['Northeast','Southeast']),
     uuidv4(),tenantId,rec2Id,'James','Rivera','james@healthstaff.com','recruiter',
     JSON.stringify(['Surgery','Orthopedics']),JSON.stringify(['Midwest','Southwest'])]);

  const SPECS=['Emergency Medicine','Internal Medicine','Family Medicine','Cardiology',
    'Orthopedic Surgery','Neurology','Psychiatry','Radiology','Anesthesiology',
    'Pediatrics','Oncology','Gastroenterology','Pulmonology','Nephrology','Dermatology',
    'Urology','Hospitalist','Obstetrics'];
  const CITIES=[['New York','NY'],['Los Angeles','CA'],['Chicago','IL'],['Houston','TX'],
    ['Phoenix','AZ'],['Philadelphia','PA'],['Dallas','TX'],['Denver','CO'],
    ['Seattle','WA'],['Nashville','TN'],['Boston','MA'],['Atlanta','GA'],
    ['Miami','FL'],['Portland','OR'],['San Diego','CA']];
  const FIRST=['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda',
    'David','Barbara','William','Elizabeth','Richard','Susan','Thomas','Karen','Charles','Sarah'];
  const LAST=['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Rodriguez','Martinez','Wilson','Anderson','Taylor','Thomas','Moore','Jackson','Lee'];
  const STAGES=['sourced','contacted','screening','interview','offer','placed','rejected'];
  const HOSPITALS=['Mayo Clinic','Cleveland Clinic','Johns Hopkins','Mass General','UCSF',
    'NYU Langone','Cedars-Sinai','Northwestern Memorial','Houston Methodist','Vanderbilt UMC'];

  const jobs = [
    ['Emergency Medicine Physician','Emergency Medicine','Mayo Clinic','Rochester','MN','full_time',220000,340000,'high','open'],
    ['Cardiologist - Interventional','Cardiology','Cleveland Clinic','Cleveland','OH','full_time',280000,480000,'high','open'],
    ['Family Medicine NP','Family Medicine','Northwestern Memorial','Chicago','IL','full_time',110000,150000,'normal','open'],
    ['Locum Hospitalist','Hospitalist','Houston Methodist','Houston','TX','locum',150000,220000,'normal','open'],
    ['Orthopedic Surgeon','Orthopedic Surgery','Cedars-Sinai','Los Angeles','CA','full_time',350000,550000,'high','open'],
    ['Psychiatrist - Outpatient','Psychiatry','NYU Langone','New York','NY','part_time',180000,280000,'normal','open'],
    ['Teleradiologist','Radiology','Stanford Health Care','Palo Alto','CA','remote',260000,380000,'normal','open'],
    ['Travel ICU RN','Critical Care','Vanderbilt UMC','Nashville','TN','travel',90000,130000,'high','open'],
    ['Neurologist - Academic','Neurology','Johns Hopkins','Baltimore','MD','full_time',230000,340000,'normal','open'],
    ['Pediatric Cardiologist','Cardiology','Boston Children\'s','Boston','MA','full_time',300000,450000,'high','open'],
  ];

  for (const j of jobs) {
    await pool.query(`INSERT INTO jobs(id,tenant_id,title,specialty,facility_name,location_city,location_state,employment_type,salary_min,salary_max,priority,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [uuidv4(),tenantId,...j,adminId]);
  }

  const rng = (arr) => arr[Math.floor(Math.random()*arr.length)];
  for (let i=0;i<100;i++) {
    const fn=rng(FIRST),ln=rng(LAST),sp=rng(SPECS),[city,state]=rng(CITIES);
    const yrs=Math.floor(Math.random()*25)+2;
    const stage=rng(STAGES);
    const hosp=rng(HOSPITALS);
    const recId=[rec1Id,rec2Id][Math.floor(Math.random()*2)];
    const cid = uuidv4();
    await pool.query(`INSERT INTO candidates(id,tenant_id,candidate_id,full_name,first_name,last_name,email,phone,specialty,npi,location_city,location_state,years_experience,current_employer,current_title,status,stage,source,assigned_recruiter_id,profile_completion,education,work_experience,certifications,skills,tags)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [cid,tenantId,`PIQ-${100001+i}`,`Dr. ${fn} ${ln}`,fn,ln,
       `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@email.com`,
       `(${Math.floor(Math.random()*800)+100}) ${Math.floor(Math.random()*900)+100}-${Math.floor(Math.random()*9000)+1000}`,
       sp,`${Math.floor(Math.random()*9000000000)+1000000000}`,city,state,yrs,
       hosp,`Attending ${sp}`,stage,stage,'manual',recId,
       Math.floor(Math.random()*40)+60,
       JSON.stringify([{degree:'MD',institution:rng(HOSPITALS),year:2024-yrs-4}]),
       JSON.stringify([{title:`Attending ${sp}`,org:hosp,start:2024-yrs,current:true}]),
       JSON.stringify([{name:`Board Certified ${sp}`,year:2024-yrs+3}]),
       JSON.stringify([sp,'Patient Care','EMR/EHR']),
       JSON.stringify(Math.random()>0.7?['hot']:Math.random()>0.5?['passive']:[])
      ]);
  }

  await pool.query(`INSERT INTO message_templates(id,tenant_id,name,channel,subject,body,category,created_by) VALUES
    ($1,$2,'Initial Outreach - Physician','email','Exciting Opportunity for {{specialty}} Professionals',
    $3,'outreach',$4),
    ($5,$2,'Follow-up SMS','sms',NULL,'Hi Dr. {{last_name}}, following up on the {{specialty}} opportunity. Available for a quick call?','follow_up',$4)`,
    [uuidv4(),tenantId,
     'Dear Dr. {{last_name}},\n\nI hope this message finds you well. I came across your profile and wanted to reach out about an exciting opportunity in {{specialty}} that may align perfectly with your background.\n\nWould you be open to a brief 15-minute call this week?\n\nBest regards,\n{{recruiter_name}}',
     adminId, uuidv4()]);

  logger.info('✅ Demo data seeded');
}

module.exports = { pool, query, initDB };
