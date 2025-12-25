import { cors } from "./_cors.js";

export default function handler(req, res) {
  // ⬅️ WAJIB
  if (cors(req, res)) return;

  res.status(200).json({
    ok: true,
    status: "online",
    time: Date.now(),
  });
}
