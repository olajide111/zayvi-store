import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

const region = process.env.AWS_REGION;
const roleArn = process.env.AWS_ROLE_ARN;

if (!region || !roleArn) {
  throw new Error("AWS storage is not configured. Check AWS_REGION and AWS_ROLE_ARN.");
}

export const s3Client = new S3Client({
  region,
  credentials: awsCredentialsProvider({ roleArn }),
});

export const s3BucketName = process.env.S3_BUCKET_NAME;

if (!s3BucketName) {
  throw new Error("AWS storage is not configured. Check S3_BUCKET_NAME.");
}
