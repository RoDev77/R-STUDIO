import admin from "firebase-admin";
import nodemailer from "nodemailer";
import crypto from "crypto";

/* =====================
   FIREBASE ADMIN
===================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

/* =====================
   SMTP
===================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* =====================
   CONFIG
===================== */
const COOLDOWN_SECONDS = 120;

/* =====================
   HANDLER
===================== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");

  try {
    const { email } = req.body;
    if (!email) return res.json({ ok: true });

    const hash = crypto
      .createHash("sha256")
      .update(email.toLowerCase())
      .digest("hex");

    const ref = db.collection("password_resets").doc(hash);
    const snap = await ref.get();

    // ✅ SERVER COOLDOWN (FIXED)
    if (snap.exists && snap.data().lastRequest) {
      const last = snap.data().lastRequest.toMillis();
      if ((Date.now() - last) / 1000 < COOLDOWN_SECONDS) {
        return res.json({ ok: true }); // silent
      }
    }

    // ✅ Anti enumeration
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch {
      return res.json({ ok: true });
    }

    const link = await admin.auth().generatePasswordResetLink(email, {
      url: process.env.RESET_URL,
    });

    const name =
      user.displayName || user.email.split("@")[0];

    const html = `
<div style="font-family:Inter,Arial;max-width:520px;margin:auto;padding:24px">
  <h2 style="color:#111827">Reset Password</h2>

  <p style="color:#374151">Halo <strong>${name}</strong>,</p>

  <p style="color:#374151">
    Kami menerima permintaan untuk mengatur ulang password akun kamu.
  </p>

  <div style="margin:32px 0;text-align:center">
    <a href="${link}" style="
      background:#6366f1;
      color:white;
      padding:14px 28px;
      border-radius:12px;
      text-decoration:none;
      font-weight:700;
      display:inline-block
    ">
      Reset Password
    </a>
  </div>

  <p style="font-size:14px;color:#6b7280">
    Jika kamu tidak meminta reset password, abaikan email ini.
    Link akan kedaluwarsa demi keamanan.
  </p>

  <hr style="margin:24px 0">
  <p style="font-size:12px;color:#9ca3af">
    © R Studio — Security Notification
  </p>
</div>
`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Reset Password — R Studio",
      html,
    });

    await ref.set({
      lastRequest: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("RESET ERROR:", err);
    return res.json({ ok: true });
  }
}
