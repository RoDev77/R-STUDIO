import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";
import admin from "firebase-admin";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ success: false });

  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer "))
      return res.status(401).json({ success: false });

    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await admin.auth().verifyIdToken(idToken);

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists)
      return res.status(403).json({ success: false });

    const role = userSnap.data().role;
    if (role !== "admin" && role !== "owner")
      return res.status(403).json({ success: false });

    const { licenseId } = req.body;
    if (!licenseId)
      return res.status(400).json({ success: false });

    await db.collection("licenses").doc(licenseId).update({
      revoked: true
    });

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false });
  }
}
