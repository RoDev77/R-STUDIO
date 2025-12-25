import { cors } from "./_cors.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  
  const { type } = req.query;

  if (type === "copyright") {
    return res.json({
      success: true,
      text: "© R STUDIO"
    });
  }

  if (type === "health") {
    return res.json({
      success: true,
      status: "ok"
    });
  }

  return res.status(404).json({ error: "INVALID_META_TYPE" });
}