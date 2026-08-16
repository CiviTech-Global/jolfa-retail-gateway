import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../shared/app-error.js";
import { env } from "../../config/env.js";

const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);
const MAX_FILE_SIZE = env.MAX_FILE_SIZE;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export interface UploadedFile {
  url: string;
  filename: string;
}

export async function saveUploadFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
): Promise<UploadedFile> {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new AppError("Only image files are allowed", 400, "INVALID_FILE_TYPE");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new AppError("File size must be less than 5 MB", 400, "FILE_TOO_LARGE");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = extname(originalName).toLowerCase() || ".bin";
  const filename = `${randomUUID()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await writeFile(filepath, buffer);

  return {
    filename,
    url: `${env.PUBLIC_UPLOAD_PATH}/${filename}`,
  };
}
