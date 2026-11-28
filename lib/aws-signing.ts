import crypto from "node:crypto";
import type { SourceData } from "@smithy/types";

function bytes(value: SourceData): Buffer {
  if (typeof value === "string") return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

export class NodeSha256 {
  private readonly secret?: Buffer;
  private chunks: Buffer[] = [];

  constructor(secret?: SourceData) {
    if (secret !== undefined) this.secret = Buffer.from(bytes(secret));
  }

  update(data: SourceData) {
    this.chunks.push(Buffer.from(bytes(data)));
  }

  copy() {
    const cloned = new NodeSha256(this.secret);
    cloned.chunks = this.chunks.map(chunk => Buffer.from(chunk));
    return cloned;
  }

  async digest(): Promise<Uint8Array> {
    const body = Buffer.concat(this.chunks);
    return this.secret
      ? crypto.createHmac("sha256", this.secret).update(body).digest()
      : crypto.createHash("sha256").update(body).digest();
  }
}
