import fs from "fs";
import path from "path";
import { resolveGs, run } from "./pdfOptimize";

const PREVIEW_PAGE_COUNT = 10;

// Extracts the first `PREVIEW_PAGE_COUNT` pages of a PDF into `outputPath` for a
// locked-content "view demo" teaser. Cached — the caller should skip calling this
// again once outputPath already exists. Returns false (and leaves no file behind)
// if Ghostscript isn't installed or extraction fails, so a missing optimizer
// never breaks the demo feature, just makes it unavailable.
export async function generatePdfPreview(sourcePath: string, outputPath: string): Promise<boolean> {
  const gs = await resolveGs();
  if (!gs) {
    console.warn("[pdfPreview] Ghostscript not found on PATH — cannot generate demo preview");
    return false;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tmpOutput = `${outputPath}.tmp`;

  try {
    await run(gs, [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dFirstPage=1`,
      `-dLastPage=${PREVIEW_PAGE_COUNT}`,
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-dSAFER",
      `-sOutputFile=${tmpOutput}`,
      sourcePath,
    ]);

    if (!fs.existsSync(tmpOutput) || fs.statSync(tmpOutput).size === 0) {
      throw new Error("Ghostscript produced an empty preview file");
    }

    fs.renameSync(tmpOutput, outputPath);
    return true;
  } catch (error) {
    console.warn("[pdfPreview] Failed to generate demo preview:", error);
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
    return false;
  }
}
