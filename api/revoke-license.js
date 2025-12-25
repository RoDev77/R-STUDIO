import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";
import { getAuth } from "firebase-admin/auth";
import "./lib/firebaseAdmin.js"; // init admin sdk

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ success: false });

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false });

    // 🔐 VERIFY TOKEN
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ success: false });
    }

    const role = userSnap.data().role;
    if (!["admin", "owner"].includes(role)) {
      return res.status(403).json({ success: false });
    }

    const { licenseId } = req.body;
    if (!licenseId) {
      return res.status(400).json({ success: false });
    }

    await db.collection("licenses").doc(licenseId).update({
      revoked: true,
      revokedAt: Date.now(),
      revokedBy: uid
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("REVOKE ERROR:", err);
    return res.status(500).json({ success: false });
  }
}
