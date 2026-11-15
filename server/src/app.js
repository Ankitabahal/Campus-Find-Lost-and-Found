import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './db.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import claimRoutes from './routes/claims.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_URL || 'http://localhost:3000,http://localhost:5173';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export async function seedAdmin() {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@campusfind.edu').toLowerCase();
    const [rows] = await db.execute('SELECT user_id FROM User WHERE email = ?', [email]);
    if (!rows.length) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 12);
      await db.execute(
        "INSERT INTO User(full_name, username, email, password_hash, role, college_or_department) VALUES (?, ?, ?, ?, 'ADMIN', ?)",
        ['CampusFind Administrator', 'admin', email, hash, 'Administration']
      );
      console.log('Seeded admin account:', email);
    }
  } catch (e) {
    console.error('Admin seed skipped:', e.message);
  }
}

export async function initializeDatabase() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  await db.initSchema();
  await seedAdmin();
}

export function createApp() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const app = express();
  const allowedOrigins = parseAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes('*') || allowedOrigins.includes(normalized)) {
          return callback(null, true);
        }
        if (process.env.APP_URL && normalized === process.env.APP_URL.replace(/\/+$/, '')) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', async (req, res) => {
    try {
      const info = await db.healthCheck();
      res.json({ status: 'ok', app: 'CampusFind', database: info.driver });
    } catch (e) {
      res.status(503).json({ status: 'error', app: 'CampusFind', message: e.message });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/claims', claimRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  app.use((err, req, res, next) => {
    if (err?.name === 'MulterError') {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Uploaded file exceeds the 5 MB size limit.'
          : err.message;
      return res.status(400).json({ message: msg });
    }
    if (err?.message === 'Origin not allowed by CORS') {
      return res.status(403).json({ message: 'CORS origin not permitted.' });
    }
    console.error(err);
    res.status(err?.status || 500).json({ message: err?.message || 'Server error.' });
  });

  return app;
}
