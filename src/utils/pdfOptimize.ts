import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const GS_CANDIDATES = process.platform === "win32" ? ["gswin64c", "gswin32c", "gs"] : ["gs"];
const EXEC_TIMEOUT_MS = 2 * 60 * 1000; // large scanned PDFs can take a while to recompress

function run(bin: string, args: string[], timeoutMs = EXEC_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function findBinary(candidates: string[]): Promise<string | null> {
  for (const bin of candidates) {
    try {
      await run(bin, ["--version"], 10_000);
      return bin;
    } catch {
      // not on PATH (or not runnable) — try the next candidate
    }
  }
  return null;
}

let gsBinaryPromise: Promise<string | null> | null = null;
let qpdfBinaryPromise: Promise<string | null> | null = null;

const resolveGs = () => (gsBinaryPromise ??= findBinary(GS_CANDIDATES));
const resolveQpdf = () => (qpdfBinaryPromise ??= findBinary(["qpdf"]));

export interface OptimizeResult {
  optimized: boolean;
  originalSize: number;
  finalSize: number;
}

// Recompresses + linearizes a PDF in place with Ghostscript/qpdf, moving the
// original into `backupDir` first so a bad compression can always be
// reverted by hand. Downsamples images to 200 DPI (300 for scanned text/mono
// pages) rather than Ghostscript's /screen preset (72 DPI), which is too
// aggressive for exam papers with small print and formulae.
// No-ops (keeps the original file untouched) if gs/qpdf aren't installed, or
// if anything in the pipeline fails — a missing optimizer must never block
// an upload.
export async function optimizePdfInPlace(
  filePath: string,
  backupDir: string
): Promise<OptimizeResult> {
  const originalSize = fs.statSync(filePath).size;
  const fallback: OptimizeResult = { optimized: false, originalSize, finalSize: originalSize };

  const gs = await resolveGs();
  if (!gs) {
    console.warn("[pdfOptimize] Ghostscript not found on PATH — skipping PDF compression");
    return fallback;
  }

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const gsOutput = path.join(dir, `${base}.gs-tmp.pdf`);
  const linOutput = path.join(dir, `${base}.lin-tmp.pdf`);

  try {
    await run(gs, [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dPDFSETTINGS=/printer",
      "-dColorImageResolution=200",
      "-dGrayImageResolution=200",
      "-dMonoImageResolution=300",
      "-dJPEGQ=80",
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-dSAFER",
      `-sOutputFile=${gsOutput}`,
      filePath,
    ]);

    if (!fs.existsSync(gsOutput) || fs.statSync(gsOutput).size === 0) {
      throw new Error("Ghostscript produced an empty output file");
    }

    let candidatePath = gsOutput;
    const qpdf = await resolveQpdf();
    if (qpdf) {
      try {
        await run(qpdf, ["--linearize", gsOutput, linOutput]);
        if (fs.existsSync(linOutput) && fs.statSync(linOutput).size > 0) {
          candidatePath = linOutput;
        }
      } catch {
        // Linearization is a nice-to-have; fall back to the gs-only output.
      }
    }

    const candidateSize = fs.statSync(candidatePath).size;
    if (candidateSize >= originalSize) {
      return fallback;
    }

    fs.mkdirSync(backupDir, { recursive: true });
    fs.renameSync(filePath, path.join(backupDir, path.basename(filePath)));
    fs.renameSync(candidatePath, filePath);

    return { optimized: true, originalSize, finalSize: candidateSize };
  } catch (error) {
    console.warn("[pdfOptimize] Failed to optimize PDF, keeping original:", error);
    return fallback;
  } finally {
    for (const tmp of [gsOutput, linOutput]) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
}
