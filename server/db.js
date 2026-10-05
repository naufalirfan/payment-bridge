import { createClient } from "@libsql/client/web";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "libsql://payment-bridge-db-naufalirfan.aws-ap-northeast-1.turso.io";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTEyMzY4MDIsImlkIjoiMDFhMTBlMDgtNmYwMS03MmU5LWExNDQtYzE2ZjM2YzQ0ZDIxIiwia2lkIjoiblRsYmdNTlhxcmRubDVHdUNkR3kzREhMckRjZ2J2b1FQVVJJUjRWWDZ2MCIsInJpZCI6IjkwMjU2MTU1LWNmMjctNGU0NC04MGEyLWUwYjA3YjJlMGJiOCJ9.OF1id5IV7pJN95uO54GRSq1HsSf4znF8b5-_usWLZSl8e0zSIm57TMATVSvY2vFbEwxkzoMsbPEjsAQZOCGLAw";

export const isTurso = Boolean(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN);

let tursoClient = null;
let localDb = null;

if (isTurso) {
  try {
    tursoClient = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN
    });
    console.log("[DB] Connected to Turso Cloud LibSQL:", TURSO_DATABASE_URL);
  } catch (err) {
    console.error("[DB] Failed to connect to Turso, falling back to SQLite:", err);
  }
}

if (!tursoClient) {
  const isVercel = Boolean(process.env.VERCEL);
  const dbPath = isVercel ? path.join('/tmp', 'payment_bridge.db') : path.resolve(__dirname, '..', 'payment_bridge.db');
  localDb = new DatabaseSync(dbPath);
  console.log("[DB] Connected to Local SQLite:", dbPath);
}

// Unified Database Wrapper
class DatabaseWrapper {
  constructor() {
    this.isTurso = Boolean(tursoClient);
    this.client = tursoClient;
    this.local = localDb;
  }

  // Async query methods
  async query(sql, args = []) {
    if (this.client) {
      const res = await this.client.execute({ sql, args });
      return res.rows;
    }
    return this.local.prepare(sql).all(...args);
  }

  async get(sql, args = []) {
    if (this.client) {
      const res = await this.client.execute({ sql, args });
      return res.rows[0] || null;
    }
    return this.local.prepare(sql).get(...args) || null;
  }

  async all(sql, args = []) {
    return this.query(sql, args);
  }

  async run(sql, args = []) {
    if (this.client) {
      const res = await this.client.execute({ sql, args });
      return { changes: res.rowsAffected, lastInsertRowid: res.lastInsertRowid };
    }
    return this.local.prepare(sql).run(...args);
  }

  async exec(sql) {
    if (this.client) {
      return this.client.executeMultiple ? this.client.executeMultiple(sql) : this.client.execute(sql);
    }
    return this.local.exec(sql);
  }

  // Backward-compatible prepare interface
  prepare(sql) {
    const self = this;
    return {
      get(...args) {
        if (self.local) {
          return self.local.prepare(sql).get(...args);
        }
        // Async fallback for Turso when called synchronously
        return null;
      },
      all(...args) {
        if (self.local) {
          return self.local.prepare(sql).all(...args);
        }
        return [];
      },
      run(...args) {
        if (self.local) {
          return self.local.prepare(sql).run(...args);
        }
        self.client.execute({ sql, args }).catch(e => console.error('[DB run async error]:', e));
        return { changes: 1 };
      }
    };
  }
}

export const db = new DatabaseWrapper();

// Initialize Local Schema if using local SQLite
if (localDb) {
  localDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

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
  `);

  const salt = "pb_salt_2026";
  const defaultHash = crypto.createHash("sha256").update("admin123" + salt).digest("hex");
  const admin = localDb.prepare("SELECT * FROM users WHERE username = ?").get("admin");
  if (!admin) {
    localDb.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)").run("usr_admin_01", "admin", defaultHash, "admin");
  }
}
