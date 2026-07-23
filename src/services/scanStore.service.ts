import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { ApiException } from "../utils/apiException";
import type { ScanSession } from "../types/scan.types";

const sessions = new Map<string, ScanSession>();
const expiryTimers = new Map<string, NodeJS.Timeout>();

export function createSession(data: Omit<ScanSession, "scanId" | "createdAt" | "expiresAt">): ScanSession {
  const scanId = `scan_${randomUUID()}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + env.scanTtlMs);

  const session: ScanSession = {
    ...data,
    scanId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  sessions.set(scanId, session);

  const timer = setTimeout(() => deleteSession(scanId), env.scanTtlMs);
  timer.unref();
  expiryTimers.set(scanId, timer);

  return session;
}

export function getSession(scanId: string): ScanSession {
  const session = sessions.get(scanId);
  if (!session) {
    throw new ApiException(404, "SCAN_NOT_FOUND", "점검 세션을 찾을 수 없습니다.");
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteSession(scanId);
    throw new ApiException(410, "SCAN_EXPIRED", "점검 세션이 만료되었습니다.");
  }
  return session;
}

export function deleteSession(scanId: string): boolean {
  const timer = expiryTimers.get(scanId);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(scanId);
  }
  return sessions.delete(scanId);
}
