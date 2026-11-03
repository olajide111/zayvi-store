import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { s3BucketName, s3Client } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: "Please sign in to upload images." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
    }

    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP and AVIF images are supported." },
        { status: 415 },
      );
    }

    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be no larger than 5 MB." },
        { status: 413 },
      );
    }

    const key = `products/${randomUUID()}.${extension}`;
    const body = Buffer.from(await file.arrayBuffer());

    await s3Client.send(new PutObjectCommand({
      Bucket: s3BucketName,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
      ServerSideEncryption: "AES256",
    }));

    return NextResponse.json({ success: true, key }, { status: 201 });
  } catch (error) {
    const awsError = error as {
      name?: string;
      Code?: string;
      code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };
    const errorCode = awsError.Code || awsError.code || awsError.name || "UnknownError";
    const statusCode = awsError.$metadata?.httpStatusCode;
    console.error("Zayvi product image upload failed:", {
      errorCode,
      statusCode,
      requestId: awsError.$metadata?.requestId,
    });

    return NextResponse.json(
      {
        error: "AWS upload failed.",
        diagnostic: statusCode ? `${errorCode} (HTTP ${statusCode})` : errorCode,
      },
      { status: 500 },
    );
  }
}
