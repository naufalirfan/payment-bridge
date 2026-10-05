import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel ? path.join('/tmp', 'payment_bridge.db') : path.resolve(__dirname, '..', 'payment_bridge.db');

export const db = new DatabaseSync(dbPath);

// Enable foreign keys, WAL mode, and schema migrations
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    last_ping_at TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_email TEXT,
    base_amount REAL NOT NULL,
    unique_code INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'MANUAL_TRANSFER',
    payment_url TEXT,
    status TEXT DEFAULT 'PENDING',
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mutations (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    raw_payload TEXT NOT NULL,
    amount REAL NOT NULL,
    sender_name TEXT,
    matched_invoice_id TEXT,
    package_name TEXT,
    app_title TEXT,
    received_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(device_id) REFERENCES devices(id),
    FOREIGN KEY(matched_invoice_id) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    status_code INTEGER,
    response_body TEXT,
    attempts INTEGER DEFAULT 1,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(invoice_id) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_matching ON invoices (status, total_amount, expires_at);
  CREATE INDEX IF NOT EXISTS idx_mutations_received ON mutations (received_at);
`);

// Try adding new columns to existing schema safely
try { db.exec("ALTER TABLE mutations ADD COLUMN sender_name TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN customer_email TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'MANUAL_TRANSFER';"); } catch (e) {}
try { db.exec("ALTER TABLE invoices ADD COLUMN payment_url TEXT;"); } catch (e) {}

// Initialize default settings if not exists
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

const defaultSettings = {
  webhook_url: 'https://webhook.site/test-payment-bridge',
  webhook_secret: 'ph_sec_' + crypto.randomBytes(16).toString('hex'),
  retry_attempts: '3',
  retry_delay_seconds: '5',
  strict_device_mode: '0',
  doku_enabled: '1',
  doku_client_id: '',
  doku_secret_key: '',
  doku_is_production: '0'
};

for (const [key, val] of Object.entries(defaultSettings)) {
  const existing = getSettingStmt.get(key);
  if (!existing) {
    setSettingStmt.run(key, val);
  }
}

// Seed default device if none exists
const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
if (deviceCount === 0) {
  const seedDevice = db.prepare('INSERT INTO devices (id, name, secret_key, last_ping_at, is_active) VALUES (?, ?, ?, ?, ?)');
  seedDevice.run('PH-AND-01', 'Samsung Galaxy A15 (Payment Hub)', 'ph_dev_' + crypto.randomBytes(16).toString('hex'), new Date().toISOString(), 1);
}
