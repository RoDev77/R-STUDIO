import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";

export default async function handler(req, res) {
  // ✅ PRE-FLIGHT HARUS PALING ATAS
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 AUTH
  if (req.headers.authorization !== process.env.SUPER_ADMIN_SECRET) {
    return res.status(401).json({ success: false });
  }

  try {
    const { licenseId } = req.body || {};
    if (!licenseId) {
      return res.status(400).json({ success: false, error: "Missing licenseId" });
    }

    const db = getFirestore(); // 🔑 WAJIB
    await db
      .collection("licenses")
      .doc(licenseId)
      .update({ revoked: true });

    return res.json({ success: true });
  } catch (err) {
    console.error("REVOKE LICENSE ERROR:", err);
    return res.status(500).json({ success: false });
  }
}
