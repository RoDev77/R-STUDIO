import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import admin from "firebase-admin";

/* 🔥 Firebase Admin */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

/* ☁️ Cloudflare R2 */
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).end();
    }

    /* 1️⃣ Auth */
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = await admin.auth().verifyIdToken(token);

    /* 2️⃣ Firestore */
    const snap = await admin
      .firestore()
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!snap.exists) return res.status(403).end();

    const user = snap.data();
    const isAllowed =
      user.isVIP === true ||
      user.role === "admin" ||
      user.role === "owner";

    if (!isAllowed) return res.status(403).json({ error: "VIP only" });

    /* 3️⃣ Get file */
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "CarrySystemV1Byrodiii.rbxm",
    });

    const data = await s3.send(cmd);
    const buffer = await streamToBuffer(data.Body);

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=CarrySystemV1Byrodiii.rbxm"
    );
    res.setHeader("Content-Type", "application/octet-stream");

    res.send(buffer);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
