import { getFirestore } from "./lib/firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = getFirestore();

    const snap = await db
      .collection("connection_logs")
      .orderBy("time", "desc")
      .limit(50)
      .get();

    const logs = snap.docs.map(d => d.data());

    return res.status(200).json({ success: true, logs });

  } catch (err) {
    console.error("LOGS ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
