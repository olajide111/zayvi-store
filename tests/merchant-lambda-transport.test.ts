import assert from "node:assert/strict";
import test from "node:test";
import { createMerchantLambdaTransport } from "../lib/merchant-lambda-transport";
import { createMerchantPrivateService } from "../lib/merchant-private-service";

const config = {
  deployment: "preview",
  roleArn: "arn:aws:iam::123456789012:role/test-web-role",
  functionArn: "arn:aws:lambda:eu-west-2:123456789012:function:zayvi-preview-merchant-registration:live",
};
const credentials = async () => ({ accessKeyId: "TEST_ACCESS_KEY", secretAccessKey: "test-signing-value" });
const lookup = { version: 1, operation: "merchant.session.lookup", sessionHash: "a".repeat(64) } as const;

test("merchant transport signs one synchronous invocation to the pinned alias and dispatches only the direct payload", async () => {
  const queries: string[] = [];
  const noDatabaseWrites = { async connect() { throw new Error("Unexpected database write"); } };
  const service = createMerchantPrivateService({
    deployment: "preview", providerIssuer: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Test",
  }, new Uint8Array(32), {
    registrationPool: noDatabaseWrites, applicationPool: noDatabaseWrites,
    lookup: {
      async query(sql, params) {
        queries.push(sql);
        assert.deepEqual(params, [lookup.sessionHash, "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Test"]);
        return { rows: [] };
      },
    },
  });

  let requests = 0;
  const call = createMerchantLambdaTransport(config, {
    credentials,
    fetcher: async (url, options) => {
      requests++;
      assert.equal(url, "https://lambda.eu-west-2.amazonaws.com/2015-03-31/functions/" + encodeURIComponent(config.functionArn) + "/invocations");
      assert.equal(options?.redirect, "error");
      assert.equal(options?.cache, "no-store");
      assert(options?.signal);
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("x-amz-invocation-type"), "RequestResponse");
      assert.match(headers.get("authorization")!, /^AWS4-HMAC-SHA256 .*\/eu-west-2\/lambda\/aws4_request/);
      assert.deepEqual(JSON.parse(String(options?.body)), lookup);
      return Response.json(await service(JSON.parse(String(options?.body))));
    },
  });

  assert.deepEqual(await call(lookup), { version: 1, ok: true, session: null });
  assert.equal(requests, 1);
  assert.deepEqual(queries, ["SELECT * FROM zayvi_registration.resolve_session($1,$2)"]);
  await assert.rejects(service({ version: "2.0", rawPath: "/api/owner", body: JSON.stringify(lookup) }), /Invalid private merchant request/);
  await assert.rejects(service({ ...lookup, tenantId: "caller-picked" }));
  assert.equal(queries.length, 1);
});

test("merchant transport rejects other deployments and never retries failed or oversized invocations", async () => {
  for (const override of [
    { deployment: "production" },
    { roleArn: config.roleArn.replace("123456789012", "123456789013") },
    { functionArn: config.functionArn.replace(":live", ":different") },
    { functionArn: config.functionArn.replace("zayvi-preview-merchant-registration", "zayvi-preview-api") },
  ]) assert.throws(() => createMerchantLambdaTransport({ ...config, ...override }), /dedicated/);

  for (const response of [
    () => new Response("AWS private error", { status: 403 }),
    () => new Response("Lambda private error", { headers: { "X-Amz-Function-Error": "Unhandled" } }),
    () => new Response(JSON.stringify("x".repeat(25 * 1024))),
    () => new Response("Invalid JSON"),
  ]) {
    let calls = 0;
    const invoke = createMerchantLambdaTransport(config, {
      credentials, fetcher: async () => { calls++; return response(); },
    });
    await assert.rejects(invoke(lookup), { message: "Private merchant registration service is unavailable." });
    assert.equal(calls, 1);
  }
});
