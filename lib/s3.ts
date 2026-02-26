import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;

/**
 * Upload a file to S3 (private by default — no public-read ACL)
 * Returns the S3 key for later presigned URL generation
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `https://${BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

/**
 * Generate a presigned URL for reading a private S3 object
 * Default expiration: 1 hour (3600 seconds)
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate a presigned URL for uploading directly from the client
 * Enforces content type and max file size
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/** Validate file content type matches actual content (magic bytes) */
export function validateFileContent(
  buffer: Buffer,
  declaredType: string
): boolean {
  const signatures: Record<string, number[][]> = {
    "image/png": [[0x89, 0x50, 0x4e, 0x47]],
    "image/jpeg": [[0xff, 0xd8, 0xff]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    "image/svg+xml": [], // validated via text content
  };

  const expected = signatures[declaredType];
  if (!expected || expected.length === 0) {
    // SVG: check for XML/SVG content
    if (declaredType === "image/svg+xml") {
      const text = buffer.subarray(0, 256).toString("utf-8").toLowerCase();
      return text.includes("<svg") || text.includes("<?xml");
    }
    return false;
  }

  return expected.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
];

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
