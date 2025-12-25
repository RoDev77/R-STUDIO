import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { licenseId, uid } = req.body || {};
    if (!licenseId || !uid) {
      return res.status(400).json({ success: false, error: "Missing data" });
    }

    const db = getFirestore();

    // 🔐 ambil user
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ success: false, error: "User not found" });
    }

    const user = userSnap.data();

    // 🚫 BLOK MEMBER & VIP
    if (!["admin", "owner"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "No permission" });
    }

    await db.collection("licenses").doc(licenseId).update({
      revoked: true,
      revokedAt: Date.now(),
      revokedBy: uid,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("REVOKE ERROR:", err);
    return res.status(500).json({ success: false });
  }
}
