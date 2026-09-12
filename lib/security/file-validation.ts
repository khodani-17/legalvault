import { fileTypeFromBuffer } from "file-type";

export const MAX_DOCUMENT_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_DOCUMENT_TYPES = {
  ".pdf": "application/pdf",

  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  ".txt": "text/plain",

  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
} as const;

type AllowedExtension =
  keyof typeof ALLOWED_DOCUMENT_TYPES;

export interface ValidatedDocumentFile {
  buffer: Buffer;
  originalName: string;
  extension: AllowedExtension;
  mimeType: string;
  detectedExtension: string | null;
  detectedMimeType: string | null;
}

function sanitizeFilename(filename: string): string {
  const basename = filename
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "document";

  const cleaned = basename
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "document";
  }

  return cleaned.slice(0, 255);
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return "";
  }

  return filename
    .slice(lastDot)
    .toLowerCase();
}

function isAllowedExtension(
  extension: string,
): extension is AllowedExtension {
  return Object.prototype.hasOwnProperty.call(
    ALLOWED_DOCUMENT_TYPES,
    extension,
  );
}

function hasPdfSignature(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }

  return buffer
    .subarray(0, 5)
    .toString("ascii") === "%PDF-";
}

function hasPngSignature(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }

  const signature = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);

  return buffer.subarray(0, 8).equals(signature);
}

function hasJpegSignature(buffer: Buffer): boolean {
  if (buffer.length < 3) {
    return false;
  }

  return (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function hasCompoundFileSignature(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }

  const signature = Buffer.from([
    0xd0,
    0xcf,
    0x11,
    0xe0,
    0xa1,
    0xb1,
    0x1a,
    0xe1,
  ]);

  return buffer.subarray(0, 8).equals(signature);
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0x00)) {
    return false;
  }

  try {
    const decoder = new TextDecoder("utf-8", {
      fatal: true,
    });

    decoder.decode(buffer);

    return true;
  } catch {
    return false;
  }
}

function isOfficeOpenXmlExtension(
  extension: string,
): boolean {
  return (
    extension === ".docx" ||
    extension === ".xlsx" ||
    extension === ".pptx"
  );
}

function isLegacyOfficeExtension(
  extension: string,
): boolean {
  return (
    extension === ".doc" ||
    extension === ".xls" ||
    extension === ".ppt"
  );
}

function isZipBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (
      (
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
      ) ||
      (
        buffer[2] === 0x05 &&
        buffer[3] === 0x06
      ) ||
      (
        buffer[2] === 0x07 &&
        buffer[3] === 0x08
      )
    )
  );
}

function validateContentSignature(
  buffer: Buffer,
  extension: AllowedExtension,
  detectedExtension: string | null,
): void {
  if (extension === ".pdf") {
    if (!hasPdfSignature(buffer)) {
      throw new Error(
        "The uploaded file is not a valid PDF.",
      );
    }

    return;
  }

  if (
    extension === ".jpg" ||
    extension === ".jpeg"
  ) {
    if (!hasJpegSignature(buffer)) {
      throw new Error(
        "The uploaded file is not a valid JPEG image.",
      );
    }

    return;
  }

  if (extension === ".png") {
    if (!hasPngSignature(buffer)) {
      throw new Error(
        "The uploaded file is not a valid PNG image.",
      );
    }

    return;
  }

  if (extension === ".txt") {
    if (!isUtf8Text(buffer)) {
      throw new Error(
        "The uploaded text file contains invalid text data.",
      );
    }

    return;
  }

  if (isLegacyOfficeExtension(extension)) {
    if (!hasCompoundFileSignature(buffer)) {
      throw new Error(
        "The uploaded Office document has an invalid file signature.",
      );
    }

    return;
  }

  if (isOfficeOpenXmlExtension(extension)) {
    if (
      !isZipBuffer(buffer) &&
      detectedExtension !== extension.slice(1)
    ) {
      throw new Error(
        "The uploaded Office document has an invalid file signature.",
      );
    }
  }
}

function validateDetectedType(
  extension: AllowedExtension,
  detectedExtension: string | null,
  detectedMimeType: string | null,
): void {
  if (extension === ".txt") {
    return;
  }

  if (!detectedExtension || !detectedMimeType) {
    throw new Error(
      "The uploaded file type could not be verified.",
    );
  }

  if (
    extension === ".jpg" &&
    detectedExtension !== "jpg" &&
    detectedExtension !== "jpeg"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }

  if (
    extension === ".jpeg" &&
    detectedExtension !== "jpg" &&
    detectedExtension !== "jpeg"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }

  if (
    extension === ".docx" &&
    detectedExtension !== "docx"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }

  if (
    extension === ".xlsx" &&
    detectedExtension !== "xlsx"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }

  if (
    extension === ".pptx" &&
    detectedExtension !== "pptx"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }

  if (
    extension === ".pdf" &&
    detectedExtension !== "pdf"
  ) {
    throw new Error(
      "The file extension does not match the actual file type.",
    );
  }
}

export async function validateDocumentFile(
  file: File,
): Promise<ValidatedDocumentFile> {
  if (!(file instanceof File)) {
    throw new Error("A valid file is required.");
  }

  if (file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error(
      "The uploaded file exceeds the 100 MB size limit.",
    );
  }

  const originalName = sanitizeFilename(file.name);
  const extension = getExtension(originalName);

  if (!isAllowedExtension(extension)) {
    throw new Error(
      "This file type is not permitted.",
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (buffer.length > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error(
      "The uploaded file exceeds the 100 MB size limit.",
    );
  }

  const detected = await fileTypeFromBuffer(buffer);

  const detectedExtension =
    detected?.ext?.toLowerCase() ?? null;

  const detectedMimeType =
    detected?.mime?.toLowerCase() ?? null;

  validateContentSignature(
    buffer,
    extension,
    detectedExtension,
  );

  validateDetectedType(
    extension,
    detectedExtension,
    detectedMimeType,
  );

  const expectedMimeType =
    ALLOWED_DOCUMENT_TYPES[extension];

  if (
    extension !== ".txt" &&
    detectedMimeType &&
    detectedMimeType !== expectedMimeType
  ) {
    throw new Error(
      "The uploaded file MIME type does not match its extension.",
    );
  }

  return {
    buffer,
    originalName,
    extension,
    mimeType: expectedMimeType,
    detectedExtension,
    detectedMimeType,
  };
}