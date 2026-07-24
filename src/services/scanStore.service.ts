import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "./db";
import { ApiException } from "../utils/apiException";
import type { ScanSession, ScanMode, Finding, FindingAction } from "../types/scan.types";
import { env } from "../config/env";

interface ScanSessionRow extends RowDataPacket {
  scan_id: string;
  file_name: string;
  mode: string;
  created_at: Date;
  expires_at: Date;
  extracted_text: string;
}

interface FindingRow extends RowDataPacket {
  finding_id: string;
  scan_id: string;
  type: string;
  label: string;
  original_text: string;
  reason: string;
  severity: string;
  action: string;
  suggestion: string | null;
  page: number;
  start_offset: number;
  end_offset: number;
  resolved: number;
  replacement_text: string | null;
}

function rowToFinding(row: FindingRow): Finding {
  return {
    findingId: row.finding_id,
    type: row.type,
    label: row.label,
    originalText: row.original_text,
    reason: row.reason,
    severity: row.severity as Finding["severity"],
    action: row.action as FindingAction,
    suggestion: row.suggestion,
    page: row.page,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    resolved: Boolean(row.resolved),
    replacementText: row.replacement_text,
  };
}

export async function createSession(
  data: Omit<ScanSession, "scanId" | "createdAt" | "expiresAt">
): Promise<ScanSession> {
  const scanId = `scan_${randomUUID()}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + env.scanTtlMs);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO scan_sessions (scan_id, file_name, mode, created_at, expires_at, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [scanId, data.fileName, data.mode, createdAt, expiresAt, data.extractedText]
    );

    for (const f of data.findings) {
      await conn.query(
        `INSERT INTO findings
         (finding_id, scan_id, type, label, original_text, reason, severity, action, suggestion, page, start_offset, end_offset, resolved, replacement_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.findingId,
          scanId,
          f.type,
          f.label,
          f.originalText,
          f.reason,
          f.severity,
          f.action,
          f.suggestion,
          f.page,
          f.startOffset,
          f.endOffset,
          f.resolved ? 1 : 0,
          f.replacementText,
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return {
    scanId,
    fileName: data.fileName,
    mode: data.mode,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    extractedText: data.extractedText,
    findings: data.findings,
  };
}

export async function getSession(scanId: string): Promise<ScanSession> {
  const [sessionRows] = await pool.query<ScanSessionRow[]>("SELECT * FROM scan_sessions WHERE scan_id = ?", [
    scanId,
  ]);
  const row = sessionRows[0];
  if (!row) {
    throw new ApiException(404, "SCAN_NOT_FOUND", "점검 세션을 찾을 수 없습니다.");
  }
  if (row.expires_at.getTime() < Date.now()) {
    await deleteSession(scanId);
    throw new ApiException(410, "SCAN_EXPIRED", "점검 세션이 만료되었습니다.");
  }

  const [findingRows] = await pool.query<FindingRow[]>(
    "SELECT * FROM findings WHERE scan_id = ? ORDER BY start_offset ASC",
    [scanId]
  );

  return {
    scanId: row.scan_id,
    fileName: row.file_name,
    mode: row.mode as ScanMode,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    extractedText: row.extracted_text,
    findings: findingRows.map(rowToFinding),
  };
}

export async function updateFinding(
  scanId: string,
  findingId: string,
  updates: { action?: FindingAction; replacementText?: string | null; resolved?: boolean }
): Promise<Finding> {
  await getSession(scanId); // 존재/만료 검증

  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (updates.action !== undefined) {
    setClauses.push("action = ?");
    values.push(updates.action);
  }
  if (updates.replacementText !== undefined) {
    setClauses.push("replacement_text = ?");
    values.push(updates.replacementText);
  }
  if (updates.resolved !== undefined) {
    setClauses.push("resolved = ?");
    values.push(updates.resolved ? 1 : 0);
  }

  if (setClauses.length > 0) {
    values.push(scanId, findingId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE findings SET ${setClauses.join(", ")} WHERE scan_id = ? AND finding_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      throw new ApiException(404, "SCAN_NOT_FOUND", "해당 항목을 찾을 수 없습니다.");
    }
  }

  const [rows] = await pool.query<FindingRow[]>("SELECT * FROM findings WHERE scan_id = ? AND finding_id = ?", [
    scanId,
    findingId,
  ]);
  const row = rows[0];
  if (!row) {
    throw new ApiException(404, "SCAN_NOT_FOUND", "해당 항목을 찾을 수 없습니다.");
  }
  return rowToFinding(row);
}

export async function deleteSession(scanId: string): Promise<void> {
  await pool.query("DELETE FROM scan_sessions WHERE scan_id = ?", [scanId]);
}

export function startExpiryCleanup(): NodeJS.Timeout {
  const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
  const timer = setInterval(() => {
    pool.query("DELETE FROM scan_sessions WHERE expires_at < NOW()").catch((err) => {
      console.error("만료 세션 정리 실패:", err);
    });
  }, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}
