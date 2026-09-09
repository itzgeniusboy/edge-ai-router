// Single-gateway health check (zero-dependency serverless function).
export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: "ok",
    hasServerApiKey: !!process.env.GEMINI_API_KEY,
  });
}
