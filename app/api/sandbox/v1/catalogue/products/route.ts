import { sandboxExampleResponse } from "@/lib/developer-sandbox";

export function GET(request: Request) {
  return sandboxExampleResponse(request, "catalogue");
}
