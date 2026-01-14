import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword
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
const errorBox = document.createElement("div");
const toggle = document.getElementById("togglePassword");

errorBox.className = "error-box";
errorBox.style.display = "none"; // ⬅️ PENTING
form.prepend(errorBox);

function validateName(name) {
  const clean = name.trim();

  if (!clean) return "Nama tidak boleh kosong";
  if (clean.length < 3) return "Nama terlalu pendek";
  if (!/^[A-Za-z\s]+$/.test(clean))
    return "Nama hanya boleh huruf";

  // anti spam (aaaa, bbbb, xxxx)
  if (/^(.)\1{2,}$/.test(clean.replace(/\s/g, "")))
    return "Nama tidak valid";

  return null; // VALID
}

/* HUMAN ERROR */
function humanError(code = "") {
  if (code.includes("email-already")) return "Email sudah terdaftar";
  if (code.includes("weak-password")) return "Password minimal 6 karakter";
  if (code.includes("invalid-email")) return "Format email tidak valid";
  return "Terjadi kesalahan, coba lagi";
}

/* SUBMIT */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorBox.style.display = "none";
  errorBox.textContent = "";

  // 🚫 BOT CHECK
  if (form.company && form.company.value) {
    return; // stop silent
  }

  const nameError = validateName(nameInput.value);
  if (nameError) {
    errorBox.textContent = nameError;
    errorBox.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating...";

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      name: nameInput.value,
      email: emailInput.value,
      role: "member",
      isVIP: false,
      emailVerified: false, // ⬅️ TAMBAHAN INI
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

    location.href = "index.html";

  } catch (err) {
    errorBox.textContent = humanError(err.code);
    errorBox.style.display = "block"; // ⬅️ munculkan

    btn.disabled = false;
    btn.textContent = "Create Account";
  }
});

[nameInput, emailInput, passwordInput].forEach(input => {
  input.addEventListener("input", () => {
    errorBox.style.display = "none";
  });
});

toggle.onclick = () => {
  passwordInput.type =
    passwordInput.type === "password" ? "text" : "password";

  toggle.textContent =
    passwordInput.type === "password" ? "👁️" : "🙈";
};

nameInput.addEventListener("blur", () => {
  const err = validateName(nameInput.value);
  if (err) {
    errorBox.textContent = err;
    errorBox.style.display = "block";
  }
});