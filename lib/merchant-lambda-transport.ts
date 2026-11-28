import { SignatureV4 } from "@smithy/signature-v4";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { NodeSha256 } from "./aws-signing";
import type { MerchantPrivateRequest } from "./merchant-registration-runtime";

type Config = { deployment: string; roleArn: string; functionArn: string };
type CredentialsProvider = ReturnType<typeof awsCredentialsProvider>;
const region = "eu-west-2";
const host = "lambda.eu-west-2.amazonaws.com";
const maxPayload = 24 * 1024;
const unavailable = () => new Error("Private merchant registration service is unavailable.");

async function readReply(response: Response) {
  if (!response.body) throw unavailable();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode()) as unknown;
      size += value.byteLength;
      if (size > maxPayload) {
        void reader.cancel().catch(() => {});
        throw unavailable();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/** Invoke only the dedicated, aliased Preview Lambda using Vercel OIDC and AWS IAM. */
export function createMerchantLambdaTransport(config: Config, adapters: {
  credentials?: CredentialsProvider;
  fetcher?: typeof fetch;
} = {}) {
  const roleAccount = /^arn:aws:iam::(\d{12}):role\/[A-Za-z0-9_+=,.@/-]+$/.exec(config.roleArn)?.[1];
  const functionAccount = /^arn:aws:lambda:eu-west-2:(\d{12}):function:zayvi-preview-merchant-registration:live$/.exec(config.functionArn)?.[1];
  if (config.deployment !== "preview" || !roleAccount || roleAccount !== functionAccount) {
    throw new Error("A dedicated same-account Preview merchant Lambda and IAM role are required.");
  }

  const credentials = adapters.credentials ?? awsCredentialsProvider({
    roleArn: config.roleArn,
    clientConfig: { region, maxAttempts: 1 },
    policy: JSON.stringify({ Version: "2012-10-17", Statement: [{
      Effect: "Allow", Action: "lambda:InvokeFunction", Resource: config.functionArn,
    }] }),
  });
  const fetcher = adapters.fetcher ?? fetch;
  const path = "/2015-03-31/functions/" + encodeURIComponent(config.functionArn) + "/invocations";
  const signer = new SignatureV4({ credentials, region, service: "lambda", sha256: NodeSha256 });

  return async (message: MerchantPrivateRequest): Promise<unknown> => {
    try {
      const body = JSON.stringify(message);
      if (Buffer.byteLength(body) > maxPayload) throw unavailable();
      const signed = await signer.sign({
        protocol: "https:", hostname: host, method: "POST", path,
        headers: { host, "content-type": "application/json", "x-amz-invocation-type": "RequestResponse" },
        body,
      });
      const response = await fetcher("https://" + host + path, {
        method: "POST", headers: signed.headers, body, redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status !== 200 || response.headers.has("x-amz-function-error")) {
        void response.body?.cancel().catch(() => {});
        throw unavailable();
      }
      return await readReply(response);
    } catch {
      throw unavailable();
    }
  };
}
