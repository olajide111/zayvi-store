import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

let cached:
  | {
      client: S3Client;
      bucketName: string;
    }
  | undefined;

export function getS3Storage() {
  if (cached) return cached;

  const region = process.env.AWS_REGION;
  const roleArn = process.env.AWS_ROLE_ARN;
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!region || !roleArn || !bucketName) {
    throw new Error(
      "AWS storage is not configured. Check AWS_REGION, AWS_ROLE_ARN and S3_BUCKET_NAME."
    );
  }

  cached = {
    client: new S3Client({
      region,
      credentials: awsCredentialsProvider({ roleArn }),
    }),
    bucketName,
  };

  return cached;
}
