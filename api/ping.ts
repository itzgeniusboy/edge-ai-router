// Minimal serverless health probe — imports nothing from server.ts.
// Used to isolate FUNCTION_INVOCATION_FAILED (infra vs app import chain).
export default function handler(req: any, res: any) {
  res.status(200).json({ pong: true, ts: Date.now() });
}
