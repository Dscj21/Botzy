import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

// Using a user data path ensures persistence across updates and re-installs
// const dbPath = join(app.getPath('userData'), 'orbital_mare.db') // MOVED inside init

export class DatabaseManager {
  private db: Database.Database | undefined

  constructor() {
    // Lazy init
  }

  private initializeSchema() {
    if (!this.db) return

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    const schema = `
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        platform TEXT CHECK(platform IN ('AMZ', 'FLP')) NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        profile_id INTEGER,
        proxy_string TEXT,
        is_gst INTEGER DEFAULT 0, -- 0 = false, 1 = true
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );


      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_name TEXT NOT NULL,
        address_json TEXT, -- JSON string of address details
        card_encrypted TEXT, -- Encrypted payment info
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      /* Removed DROP TABLE IF EXISTS orders; to prevent data loss on minor updates. 
         Schema evolution handled via migrations below. */
      
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        platform TEXT,
        order_id TEXT UNIQUE,
        product_name TEXT,
        quantity INTEGER,
        price REAL,
        status TEXT,
        order_date TEXT,
        image_url TEXT,
        tracking_id TEXT,
        delivery_otp TEXT,
        delivered_date TEXT, -- Added new column
        FOREIGN KEY(account_id) REFERENCES accounts(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

    `

    this.db.exec(schema)

    // Migration for proxy_string (Dev quick fix)
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN proxy_string TEXT')
      console.log('Migrated accounts table: added proxy_string')
    } catch {
      // Ignore if column already exists
    }

    // Migration for is_gst (Dev quick fix)
    try {
      this.db.exec('ALTER TABLE accounts ADD COLUMN is_gst INTEGER DEFAULT 0')
      console.log('Migrated accounts table: added is_gst')
    } catch {
      // Ignore if column already exists
    }

    // Migration for tracking_id
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN tracking_id TEXT')
      console.log('Migrated orders table: added tracking_id')
    } catch(e) { 
        // console.log('tracking_id migration skipped')
    }

    // Migration for delivery_otp
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN delivery_otp TEXT')
      console.log('Migrated orders table: added delivery_otp')
    } catch { }

    // Migration for delivered_date
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN delivered_date TEXT')
      console.log('Migrated orders table: added delivered_date')
    } catch { }
    
    // Migration for credit_card
    try {
      this.db.exec('ALTER TABLE orders ADD COLUMN credit_card TEXT')
      console.log('Migrated orders table: added credit_card')
    } catch { }
  }

  init() {
    if (this.db) return
    const dbPath = join(app.getPath('userData'), 'orbital_mare.db') // Use persistent path
    console.log(`[Database] Initializing at ${dbPath}`)
    
    // Ensure directory exists? app.getPath guarantees user data dir
    this.db = new Database(dbPath)
    this.initializeSchema()
  }

  getDb() {
    if (!this.db) this.init()
    return this.db!
  }
}

export const dbManager = new DatabaseManager()
