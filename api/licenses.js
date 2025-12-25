import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getFirestore(); // 🔑 FIX UTAMA
    const snap = await db.collection("licenses").get();

    const licenses = snap.docs.map(doc => ({
      licenseId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      licenses,
    });
  } catch (err) {
    console.error("LICENSE LIST ERROR:", err);
    return res.status(500).json({ success: false });
  }
}
