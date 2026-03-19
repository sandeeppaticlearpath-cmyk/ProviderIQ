require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDB } = require('./db/connection');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const jobRoutes = require('./routes/jobs');
const pipelineRoutes = require('./routes/pipeline');
const providerRoutes = require('./routes/providers');
const outreachRoutes = require('./routes/outreach');
const analyticsRoutes = require('./routes/analytics');
const recruiterRoutes = require('./routes/recruiters');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');
const integrationRoutes = require('./routes/integrations');
const activityRoutes = require('./routes/activity');
const dashboardRoutes = require('./routes/dashboard');
const conversationRoutes = require('./routes/conversations');
const credentialRoutes = require('./routes/credentials');
const bobRoutes = require('./routes/bob');
const managerRoutes = require('./routes/manager');
const npiRoutes = require('./routes/npi');
const aiRoutes = require('./routes/ai');
const jobBoardRoutes = require('./routes/jobboards');
const submissionRoutes = require('./routes/submissions');
const interviewRoutes = require('./routes/interviews');
const placementRoutes = require('./routes/placements');

const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// ─── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(null, true); // permissive for now — lock down in prod
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Org-ID'],
}));

// ─── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.http(msg.trim()) } }));

// ─── Rate limiting ────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 2000 }));
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 30 }));

// ─── Health ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'healthy', version: '2.0.0',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

app.get('/', (req, res) => res.json({ message: 'ProviderIQ API v2.0 🚀', docs: '/health' }));

// ─── Public routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/npi', npiRoutes); // NPI proxy (no auth needed for search)

// ─── Protected routes ─────────────────────────────────────────
app.use('/api/candidates', authenticateToken, candidateRoutes);
app.use('/api/candidates', authenticateToken, conversationRoutes);
app.use('/api/candidates', authenticateToken, credentialRoutes);
app.use('/api/jobs', authenticateToken, jobRoutes);
app.use('/api/jobs', authenticateToken, submissionRoutes);
app.use('/api/pipeline', authenticateToken, pipelineRoutes);
app.use('/api/providers', authenticateToken, providerRoutes);
app.use('/api/outreach', authenticateToken, outreachRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/recruiters', authenticateToken, recruiterRoutes);
app.use('/api/search', authenticateToken, searchRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/integrations', authenticateToken, integrationRoutes);
app.use('/api/activity', authenticateToken, activityRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/bob', authenticateToken, bobRoutes);
app.use('/api/manager', authenticateToken, managerRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/jobboards', authenticateToken, jobBoardRoutes);
app.use('/api/interviews', authenticateToken, interviewRoutes);
app.use('/api/placements', authenticateToken, placementRoutes);

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start ───────────────────────────────────────────────────
async function bootstrap() {
  try {
    await initDB();
    logger.info('✅ Database initialized');
    app.listen(PORT, () => {
      logger.info(`🚀 ProviderIQ API running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
module.exports = app;
