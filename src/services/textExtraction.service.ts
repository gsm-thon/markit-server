import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { createWorker } from "tesseract.js";
import { ApiException } from "../utils/apiException";

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractFromHwpx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/.test(name))
    .sort();

  if (sectionFiles.length === 0) {
    throw new ApiException(400, "INVALID_FILE_TYPE", "HWPX 문서 구조를 인식할 수 없습니다.");
  }

  const texts: string[] = [];
  for (const fileName of sectionFiles) {
    const xml = await zip.files[fileName].async("string");
    const matches = xml.matchAll(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g);
    for (const match of matches) {
      texts.push(decodeXmlEntities(match[1]));
    }
  }
  return texts.join("\n");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker(["eng", "kor"]);
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function extractText(fileName: string, mimeType: string, buffer: Buffer): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractFromPdf(buffer);
  }
  if (extension === "docx") {
    return extractFromDocx(buffer);
  }
  if (extension === "hwpx") {
    return extractFromHwpx(buffer);
  }
  if (extension === "txt" || mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }
  if (["png", "jpg", "jpeg"].includes(extension) || mimeType.startsWith("image/")) {
    return extractFromImage(buffer);
  }

  throw new ApiException(400, "INVALID_FILE_TYPE", "지원하지 않는 파일 형식입니다.");
}
