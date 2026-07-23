import multer from "multer";
import { env } from "../config/env";
import { ApiException } from "../utils/apiException";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/octet-stream", // HWPX often reports as generic octet-stream
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "hwpx", "txt", "png", "jpg", "jpeg"]);

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(extension);

  if (!mimeOk && !extOk) {
    callback(new ApiException(400, "INVALID_FILE_TYPE", "지원하지 않는 파일 형식입니다."));
    return;
  }
  callback(null, true);
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes },
  fileFilter,
});
