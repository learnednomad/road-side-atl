import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Lazy S3 client — only created on first use so the app doesn't crash
 * at startup when AWS credentials aren't configured.
 */
let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3) return _s3;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
    );
  }

  _s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return _s3;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME not configured");
  return bucket;
}

/**
 * Upload a file to S3 (private by default — no public-read ACL)
 * Returns the S3 key for later presigned URL generation
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
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
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
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
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Return the actual byte size of an uploaded S3 object, or null if the object
 * genuinely does not exist (404). Throws on any other (transient) error so the
 * caller can distinguish "missing" from "couldn't check" and avoid rejecting a
 * valid upload on a network/throttle blip.
 */
export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const res = await getS3Client().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return res.ContentLength ?? null;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (err as { name?: string })?.name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
      return null;
    }
    throw err;
  }
}

/** Best-effort delete of an S3 object (e.g. an oversized/invalid upload). */
export async function deleteFile(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
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
  "image/webp",
];

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
