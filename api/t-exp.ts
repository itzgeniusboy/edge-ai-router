// Bisect probe: express import only.
import express from "express";

const app = express();
app.get("/api/t-exp", (_req: any, res: any) => res.json({ ok: "express" }));

export default app;
