import path from "node:path";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph } from "docx";
import type { ScanSession } from "../types/scan.types";

const KOREAN_FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.ttf");

export function buildMaskedText(session: ScanSession): string {
  const resolvedFindings = session.findings
    .filter((f) => f.resolved)
    .sort((a, b) => b.startOffset - a.startOffset);

  let result = session.extractedText;
  for (const finding of resolvedFindings) {
    const fallback = finding.action === "replace" ? finding.suggestion : null;
    const replacement = finding.action === "delete" ? "" : finding.replacementText ?? fallback ?? "[가림]";
    result = result.slice(0, finding.startOffset) + replacement + result.slice(finding.endOffset);
  }
  return result;
}

export function generateTxtCopy(maskedText: string): Buffer {
  return Buffer.from(maskedText, "utf-8");
}

// pdfkit은 줄바꿈으로 "\n"만 인식하고 "\r"은 그대로 문자로 렌더링을 시도한다.
// NotoSansKR은 "\r"/"\t"/제로폭 공백 등 제어문자에 대해 빈 글리프가 아닌 실제 윤곽선(.notdef 사각형)을
// 가지고 있어서, 이런 문자가 섞여 있으면 화면에 네모 박스로 보인다. PDF 렌더링 직전에 제거/정규화한다.
function sanitizeForPdf(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[​-‍﻿]/g, "");
}

export async function generatePdfCopy(maskedText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(KOREAN_FONT_PATH).fontSize(11).text(sanitizeForPdf(maskedText), { lineGap: 4 });
    doc.end();
  });
}

export async function generateDocxCopy(maskedText: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: maskedText
          .split("\n")
          .map((line) => new Paragraph({ text: line })),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
