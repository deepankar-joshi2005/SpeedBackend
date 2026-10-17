import fs from "fs";
import path from "path";
import multer from "multer";

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadImport = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/html",
      "application/xhtml+xml",
    ];
    if (!allowed.includes(file.mimetype) && !/\.(xlsx|xls|csv|html?)$/i.test(file.originalname)) {
      cb(new Error("Only .xlsx, .xls, .csv, or .html files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const PYQ_DIR = path.join(UPLOADS_DIR, "pyq");
if (!fs.existsSync(PYQ_DIR)) {
  fs.mkdirSync(PYQ_DIR, { recursive: true });
}

const EBOOK_DIR = path.join(UPLOADS_DIR, "ebooks");
if (!fs.existsSync(EBOOK_DIR)) {
  fs.mkdirSync(EBOOK_DIR, { recursive: true });
}

// Pre-compression backups live outside `uploads/` so they're never reachable
// over HTTP, even by path-guessing — only the optimized copy is served.
const PDF_ORIGINALS_DIR = path.join(__dirname, "../../pdf-originals");
export const PYQ_ORIGINALS_DIR = path.join(PDF_ORIGINALS_DIR, "pyq");
export const EBOOK_ORIGINALS_DIR = path.join(PDF_ORIGINALS_DIR, "ebooks");
if (!fs.existsSync(PYQ_ORIGINALS_DIR)) {
  fs.mkdirSync(PYQ_ORIGINALS_DIR, { recursive: true });
}
if (!fs.existsSync(EBOOK_ORIGINALS_DIR)) {
  fs.mkdirSync(EBOOK_ORIGINALS_DIR, { recursive: true });
}

const pdfFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const isPdf = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
  if (!isPdf) {
    cb(new Error("Only PDF files are allowed"));
    return;
  }
  cb(null, true);
};

const pdfFilename: multer.DiskStorageOptions["filename"] = (_req, file, cb) => {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  cb(null, `${Date.now()}-${safeName}`);
};

export const uploadPyqPdf = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PYQ_DIR),
    filename: pdfFilename,
  }),
  fileFilter: pdfFileFilter,
});

export const uploadEbookPdf = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EBOOK_DIR),
    filename: pdfFilename,
  }),
  fileFilter: pdfFileFilter,
});
