import mysql from "mysql2/promise";
import { env } from "../config/env";

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_sessions (
      scan_id VARCHAR(64) PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      mode VARCHAR(20) NOT NULL,
      created_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      extracted_text LONGTEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS findings (
      finding_id VARCHAR(64) PRIMARY KEY,
      scan_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) NOT NULL,
      label VARCHAR(100) NOT NULL,
      original_text TEXT NOT NULL,
      reason TEXT NOT NULL,
      severity VARCHAR(10) NOT NULL,
      action VARCHAR(10) NOT NULL,
      suggestion TEXT NULL,
      page INT NOT NULL,
      start_offset INT NOT NULL,
      end_offset INT NOT NULL,
      resolved TINYINT(1) NOT NULL DEFAULT 0,
      replacement_text TEXT NULL,
      FOREIGN KEY (scan_id) REFERENCES scan_sessions(scan_id) ON DELETE CASCADE,
      INDEX idx_scan_id (scan_id)
    )
  `);
}
