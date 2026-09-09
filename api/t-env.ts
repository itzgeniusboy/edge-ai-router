// Bisect probe: dotenv import only.
import dotenv from "dotenv";

dotenv.config();

export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: "dotenv" });
}
