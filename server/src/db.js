import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function resolveMysqlConfig() {
  const driver = (process.env.DB_DRIVER || 'auto').toLowerCase();
  if (driver === 'sqlite') return null;

  const url = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || (
    process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')
      ? process.env.DATABASE_URL
      : ''
  );

  if (url) {
    return { uri: url };
  }

  const host = process.env.MYSQLHOST || process.env.DB_HOST;
  const user = process.env.MYSQLUSER || process.env.DB_USER;
  const password = process.env.MYSQLPASSWORD ?? process.env.DB_PASSWORD ?? '';
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'smart_lost_found';
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);

  if (host && user) {
    return { host, port, user, password, database };
  }

  if (driver === 'mysql') {
    throw new Error('DB_DRIVER is set to mysql, but MYSQL_URL or DB_HOST/DB_USER are not configured.');
  }

  return null;
}

function createMysqlPool(cfg) {
  const baseOptions = {
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  };

  if (cfg.uri) {
    const parsed = new URL(cfg.uri);
    const dbName = parsed.pathname.replace(/^\//, '') || 'railway';
    return mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: dbName,
      ...baseOptions,
    });
  }

  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ...baseOptions,
  });
}

async function createSqliteAdapter() {
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = path.resolve(process.env.LOCAL_SQLITE_PATH || '.local-dev/campusfind.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA journal_mode = WAL;');

  function translateSql(sql) {
    return sql
      .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO')
      .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  }

  function normalizeParam(val) {
    if (val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  }

  return {
    driver: 'sqlite',
    dbPath,
    async execute(sql, params = []) {
      const translated = translateSql(sql).trim();
      const safeParams = params.map(normalizeParam);
      const isRead = /^(SELECT|PRAGMA|WITH)\b/i.test(translated);
      const stmt = sqlite.prepare(translated);
      if (isRead) {
        const rows = stmt.all(...safeParams);
        return [rows, []];
      }
      const info = stmt.run(...safeParams);
      return [
        {
          insertId: Number(info.lastInsertRowid || 0),
          affectedRows: Number(info.changes || 0),
        },
        [],
      ];
    },
    async execRaw(sql) {
      sqlite.exec(sql);
    },
  };
}

let activeDriver = 'mysql';
let mysqlPool = null;
let sqliteAdapter = null;

const mysqlCfg = resolveMysqlConfig();
if (mysqlCfg) {
  mysqlPool = createMysqlPool(mysqlCfg);
  activeDriver = 'mysql';
} else {
  sqliteAdapter = await createSqliteAdapter();
  activeDriver = 'sqlite';
}

const MYSQL_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS User (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone_number VARCHAR(15),
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    college_or_department VARCHAR(120),
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS Item_Report (
    item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT UNSIGNED NOT NULL,
    report_type VARCHAR(10) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    item_date DATE NOT NULL,
    location VARCHAR(200) NOT NULL,
    image_url VARCHAR(2048),
    status VARCHAR(25) NOT NULL DEFAULT 'PUBLISHED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_reporter FOREIGN KEY (reporter_id) REFERENCES User(user_id),
    CONSTRAINT chk_report_type CHECK (report_type IN ('LOST','FOUND'))
  )`,
  `CREATE TABLE IF NOT EXISTS Claim (
    claim_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT UNSIGNED NOT NULL,
    claimant_id INT UNSIGNED NOT NULL,
    proof_details VARCHAR(1000) NOT NULL,
    proof_image_url VARCHAR(2048),
    claim_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_id INT UNSIGNED NULL,
    review_notes VARCHAR(1000),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    FOREIGN KEY (item_id) REFERENCES Item_Report(item_id),
    FOREIGN KEY (claimant_id) REFERENCES User(user_id),
    FOREIGN KEY (admin_id) REFERENCES User(user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS Match_Record (
    match_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lost_item_id BIGINT UNSIGNED NOT NULL,
    found_item_id BIGINT UNSIGNED NOT NULL,
    match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    match_reason VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_pair (lost_item_id, found_item_id),
    FOREIGN KEY (lost_item_id) REFERENCES Item_Report(item_id),
    FOREIGN KEY (found_item_id) REFERENCES Item_Report(item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS Handover (
    handover_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    claim_id BIGINT UNSIGNED NOT NULL UNIQUE,
    handover_place VARCHAR(200) NOT NULL,
    handover_date DATETIME NULL,
    receiver_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    finder_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    handover_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    notes VARCHAR(500),
    FOREIGN KEY (claim_id) REFERENCES Claim(claim_id)
  )`,
  `CREATE TABLE IF NOT EXISTS Notification (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    notification_type VARCHAR(30) NOT NULL,
    message VARCHAR(500) NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
  )`,
];

const SQLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS User (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone_number VARCHAR(15),
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  college_or_department VARCHAR(120),
  account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Item_Report (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  report_type VARCHAR(10) NOT NULL CHECK (report_type IN ('LOST','FOUND')),
  item_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  item_date DATE NOT NULL,
  location VARCHAR(200) NOT NULL,
  image_url VARCHAR(2048),
  status VARCHAR(25) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES User(user_id)
);

CREATE TABLE IF NOT EXISTS Claim (
  claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  claimant_id INTEGER NOT NULL,
  proof_details VARCHAR(1000) NOT NULL,
  proof_image_url VARCHAR(2048),
  claim_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  admin_id INTEGER NULL,
  review_notes VARCHAR(1000),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  FOREIGN KEY (item_id) REFERENCES Item_Report(item_id),
  FOREIGN KEY (claimant_id) REFERENCES User(user_id),
  FOREIGN KEY (admin_id) REFERENCES User(user_id)
);

CREATE TABLE IF NOT EXISTS Match_Record (
  match_id INTEGER PRIMARY KEY AUTOINCREMENT,
  lost_item_id INTEGER NOT NULL,
  found_item_id INTEGER NOT NULL,
  match_score REAL NOT NULL DEFAULT 0,
  match_reason VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (lost_item_id, found_item_id),
  FOREIGN KEY (lost_item_id) REFERENCES Item_Report(item_id),
  FOREIGN KEY (found_item_id) REFERENCES Item_Report(item_id)
);

CREATE TABLE IF NOT EXISTS Handover (
  handover_id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL UNIQUE,
  handover_place VARCHAR(200) NOT NULL,
  handover_date DATETIME NULL,
  receiver_confirmed INTEGER NOT NULL DEFAULT 0,
  finder_confirmed INTEGER NOT NULL DEFAULT 0,
  handover_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  notes VARCHAR(500),
  FOREIGN KEY (claim_id) REFERENCES Claim(claim_id)
);

CREATE TABLE IF NOT EXISTS Notification (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  notification_type VARCHAR(30) NOT NULL,
  message VARCHAR(500) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES User(user_id)
);

CREATE INDEX IF NOT EXISTS idx_item_search ON Item_Report(report_type, category, status, item_date);
CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification(user_id, is_read, created_at);
`;

const db = {
  driver: activeDriver,
  async execute(sql, params = []) {
    if (activeDriver === 'mysql') {
      return mysqlPool.execute(sql, params);
    }
    return sqliteAdapter.execute(sql, params);
  },
  async initSchema() {
    if (activeDriver === 'mysql') {
      for (const stmt of MYSQL_SCHEMA_STATEMENTS) {
        await mysqlPool.execute(stmt);
      }
      // Ensure indexes exist safely without failing if already present
      const indexes = [
        ['Item_Report', 'idx_item_search', 'CREATE INDEX idx_item_search ON Item_Report(report_type, category, status, item_date)'],
        ['Notification', 'idx_notification_user', 'CREATE INDEX idx_notification_user ON Notification(user_id, is_read, created_at)'],
      ];
      for (const [table, idxName, ddl] of indexes) {
        try {
          const [rows] = await mysqlPool.execute(
            'SELECT COUNT(1) AS cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
            [table, idxName]
          );
          if (!rows[0]?.cnt) {
            await mysqlPool.execute(ddl);
          }
        } catch {
          // Ignore if index creation is unsupported or already exists
        }
      }
      return;
    }
    await sqliteAdapter.execRaw(SQLITE_SCHEMA_SQL);
  },
  async healthCheck() {
    await this.execute('SELECT 1 AS ok');
    return { driver: activeDriver };
  },
};

export default db;
