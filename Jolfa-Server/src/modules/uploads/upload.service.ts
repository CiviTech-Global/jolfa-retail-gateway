import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";

const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);
const MAX_FILE_SIZE = env.MAX_FILE_SIZE;

/**
 * Extension is derived from the (validated) mimetype rather than the client
 * supplied filename: the filename is attacker controlled and a mismatched or
 * missing extension would otherwise be written to disk verbatim.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

/** Magic-number prefixes, so a renamed .exe cannot pass as image/png. */
const MAGIC_NUMBERS: Array<{ mime: string; test: (buffer: Buffer) => boolean }> = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { mime: "image/gif", test: (b) => b.subarray(0, 3).toString("ascii") === "GIF" },
];

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function formatMaxFileSize(): string {
  return `${Math.round(MAX_FILE_SIZE / (1024 * 1024))} مگابایت`;
}

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export async function saveUploadFile(
  buffer: Buffer,
  _originalName: string,
  mimetype: string,
): Promise<UploadedFile> {
  const normalizedMime = mimetype.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    throw new AppError(
      "فقط تصویر با فرمت JPG، PNG، WebP یا GIF مجاز است",
      400,
      "INVALID_FILE_TYPE",
    );
  }

  if (buffer.length === 0) {
    throw new AppError("فایل انتخاب‌شده خالی است", 400, "EMPTY_FILE");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new AppError(
      `حجم فایل باید کمتر از ${formatMaxFileSize()} باشد`,
      413,
      "FILE_TOO_LARGE",
    );
  }

  const signatureMatches = MAGIC_NUMBERS.some(
    (entry) => entry.mime === normalizedMime && entry.test(buffer),
  );
  if (!signatureMatches) {
    throw new AppError(
      "محتوای فایل با فرمت اعلام‌شده مطابقت ندارد",
      400,
      "INVALID_FILE_CONTENT",
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}${MIME_EXTENSIONS[normalizedMime]}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return {
    filename,
    size: buffer.length,
    mimetype: normalizedMime,
    // Absolute, matching demo.service.ts — a relative path would resolve
    // against the web app's origin, not the API's, and render broken.
    url: `${env.APP_URL}${env.PUBLIC_UPLOAD_PATH}/${filename}`,
  };
}
