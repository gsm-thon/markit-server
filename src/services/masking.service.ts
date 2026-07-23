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

export async function generatePdfCopy(maskedText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(KOREAN_FONT_PATH).fontSize(11).text(maskedText, { lineGap: 4 });
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
