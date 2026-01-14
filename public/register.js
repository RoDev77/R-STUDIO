import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ELEMENT */
const form = document.getElementById("registerForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const btn = document.querySelector(".submit");
const toggle = document.getElementById("togglePassword");

/* ERROR BOX */
const errorBox = document.createElement("div");
errorBox.className = "error-box";
errorBox.style.display = "none";
form.prepend(errorBox);

/* VALIDASI NAMA */
function validateName(name) {
  const clean = name.trim();

  if (!clean) return "Nama tidak boleh kosong";
  if (clean.length < 3) return "Nama terlalu pendek";
  if (!/^[A-Za-z\s]+$/.test(clean)) return "Nama hanya boleh huruf";
  if (/^(.)\1{2,}$/.test(clean.replace(/\s/g, "")))
    return "Nama tidak valid";

  return null;
}

/* HUMAN ERROR */
function humanError(code = "") {
  if (code.includes("email-already")) return "Email sudah terdaftar";
  if (code.includes("weak-password")) return "Password minimal 6 karakter";
  if (code.includes("invalid-email")) return "Format email tidak valid";
  if (code.includes("permission-denied"))
    return "Akses database ditolak";
  return "Terjadi kesalahan, coba lagi";
}

/* SUBMIT */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  errorBox.textContent = "";

  // 🚫 BOT CHECK
  if (form.company && form.company.value) return;

  const nameError = validateName(nameInput.value);
  if (nameError) {
    errorBox.textContent = nameError;
    errorBox.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating...";

  let userCred = null;

  try {
    /* 1️⃣ CREATE AUTH */
    userCred = await createUserWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );

    /* 2️⃣ CREATE FIRESTORE DOC */
    await setDoc(doc(db, "users", userCred.user.uid), {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      role: "member",
      isVIP: false,
      emailVerified: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

    /* 3️⃣ SUCCESS */
    location.replace("index.html");

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    // 🔥 ROLLBACK USER JIKA FIRESTORE GAGAL
    if (userCred?.user) {
      try {
        await deleteUser(userCred.user);
        console.warn("Auth user rollbacked");
      } catch (e) {
        console.error("Rollback failed:", e);
      }
    }

    errorBox.textContent = humanError(err.code || "");
    errorBox.style.display = "block";

    btn.disabled = false;
    btn.textContent = "Create Account";
  }
});

/* HIDE ERROR ON INPUT */
[nameInput, emailInput, passwordInput].forEach(input => {
  input.addEventListener("input", () => {
    errorBox.style.display = "none";
  });
});

/* TOGGLE PASSWORD */
toggle.onclick = () => {
  const isPass = passwordInput.type === "password";
  passwordInput.type = isPass ? "text" : "password";
  toggle.textContent = isPass ? "🙈" : "👁️";
};

/* VALIDASI BLUR */
nameInput.addEventListener("blur", () => {
  const err = validateName(nameInput.value);
  if (err) {
    errorBox.textContent = err;
    errorBox.style.display = "block";
  }
});
