import type { Request, Response, NextFunction } from "express";
import { extractText } from "../services/textExtraction.service";
import { analyzeText } from "../services/detection.service";
import { createSession, getSession, deleteSession } from "../services/scanStore.service";
import { buildMaskedText, generateTxtCopy, generatePdfCopy, generateDocxCopy } from "../services/masking.service";
import { ApiException } from "../utils/apiException";
import type { ScanMode } from "../types/scan.types";

const VALID_MODES: ScanMode[] = ["privacy", "blind_hiring"];

export async function createScan(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new ApiException(400, "INVALID_FILE_TYPE", "파일이 업로드되지 않았습니다.");
    }

    const mode = req.body.mode as ScanMode;
    if (!VALID_MODES.includes(mode)) {
      throw new ApiException(400, "INVALID_SCAN_MODE", "지원하지 않는 점검 유형입니다.");
    }

    const consent = req.body.consent === "true" || req.body.consent === true;
    if (!consent) {
      throw new ApiException(400, "INVALID_CONSENT", "민감정보 점검 동의가 필요합니다.");
    }

    const extractedText = await extractText(file.originalname, file.mimetype, file.buffer);
    const { findings, summary } = await analyzeText(extractedText, mode);

    const session = createSession({
      fileName: file.originalname,
      mode,
      extractedText,
      findings,
    });

    res.status(201).json({
      success: true,
      data: {
        scanId: session.scanId,
        fileName: session.fileName,
        mode: session.mode,
        createdAt: session.createdAt,
        extractedText: session.extractedText,
        summary,
        findings: session.findings,
      },
    });
  } catch (err) {
    next(err instanceof ApiException ? err : new ApiException(500, "ANALYSIS_FAILED", "AI/OCR 분석에 실패했습니다."));
  }
}

export function updateFinding(req: Request, res: Response, next: NextFunction) {
  try {
    const scanId = req.params.scanId as string;
    const findingId = req.params.findingId as string;
    const session = getSession(scanId);
    const finding = session.findings.find((f) => f.findingId === findingId);
    if (!finding) {
      throw new ApiException(404, "SCAN_NOT_FOUND", "해당 항목을 찾을 수 없습니다.");
    }

    const { action, replacementText, resolved } = req.body;
    if (action) finding.action = action;
    if (typeof replacementText === "string") finding.replacementText = replacementText;
    if (typeof resolved === "boolean") finding.resolved = resolved;

    res.json({
      success: true,
      data: {
        findingId: finding.findingId,
        resolved: finding.resolved,
        replacementText: finding.replacementText,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createSafeCopy(req: Request, res: Response, next: NextFunction) {
  try {
    const scanId = req.params.scanId as string;
    const session = getSession(scanId);
    const format = (req.body.format ?? "txt") as "pdf" | "docx" | "txt";

    const maskedText = buildMaskedText(session);

    let buffer: Buffer;
    let contentType: string;
    if (format === "pdf") {
      buffer = await generatePdfCopy(maskedText);
      contentType = "application/pdf";
    } else if (format === "docx") {
      buffer = await generateDocxCopy(maskedText);
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (format === "txt") {
      buffer = generateTxtCopy(maskedText);
      contentType = "text/plain; charset=utf-8";
    } else {
      throw new ApiException(400, "INVALID_FILE_TYPE", "지원하지 않는 사본 형식입니다.");
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="maskit-safe-copy.${format}"`);
    res.send(buffer);
  } catch (err) {
    next(err instanceof ApiException ? err : new ApiException(500, "SAFE_COPY_FAILED", "안전 사본 생성에 실패했습니다."));
  }
}

export function removeScan(req: Request, res: Response, next: NextFunction) {
  try {
    const scanId = req.params.scanId as string;
    getSession(scanId); // 존재/만료 검증
    deleteSession(scanId);
    res.json({ success: true, data: { scanId, deleted: true } });
  } catch (err) {
    next(err);
  }
}
