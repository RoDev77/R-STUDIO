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

    // ✅ SERVER COOLDOWN
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

    // ✅ PENTING: Gunakan action.html sebagai continueUrl
    const actionCodeSettings = {
      url: `${process.env.BASE_URL || 'https://rstudiolab.online'}/action.html`,
      handleCodeInApp: false
    };

    const link = await admin.auth().generatePasswordResetLink(
      email, 
      actionCodeSettings
    );

    const name = user.displayName || user.email.split("@")[0];

    const html = `
<div style="font-family:Inter,Arial;max-width:520px;margin:auto;padding:24px;background:#f9fafb">
  <div style="background:white;padding:32px;border-radius:16px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#6366f1;margin:0;font-size:28px">R STUDIO</h1>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0">Creative Dashboard</p>
    </div>

    <h2 style="color:#111827;margin:0 0 16px">Reset Password</h2>

    <p style="color:#374151;line-height:1.6">Halo <strong>${name}</strong>,</p>

    <p style="color:#374151;line-height:1.6">
      Kami menerima permintaan untuk mengatur ulang password akun kamu di R Studio.
    </p>

    <div style="margin:32px 0;text-align:center">
      <a href="${link}" style="
        background:linear-gradient(135deg,#6366f1,#7c3aed);
        color:white;
        padding:14px 32px;
        border-radius:12px;
        text-decoration:none;
        font-weight:700;
        display:inline-block;
        box-shadow:0 4px 6px rgba(99,102,241,.3)
      ">
        🔐 Reset Password
      </a>
    </div>

    <p style="font-size:13px;color:#6b7280;line-height:1.6">
      Link ini akan <strong>kedaluwarsa dalam beberapa jam</strong> demi keamanan. 
      Jika kamu tidak meminta reset password, abaikan email ini dan password kamu akan tetap aman.
    </p>

    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0">
      © ${new Date().getFullYear()} R Studio — Security Notification
    </p>
  </div>
</div>
`;

    await transporter.sendMail({
      from: `"R Studio Security" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🔐 Reset Password — R Studio",
      html,
    });

    await ref.set({
      lastRequest: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Reset password email sent to: ${email}`);
    return res.json({ ok: true });

  } catch (err) {
    console.error("RESET ERROR:", err);
    return res.json({ ok: true });
  }
}
