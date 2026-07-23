import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { ApiException } from "../utils/apiException";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiException) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ success: false, error: { code: "FILE_TOO_LARGE", message: "파일 용량이 너무 큽니다." } });
    return;
  }

  console.error(err);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "알 수 없는 오류가 발생했습니다." } });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "요청한 경로를 찾을 수 없습니다." } });
}
