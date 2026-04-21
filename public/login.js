import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// ✅ Kalau sudah login, langsung ke home
onAuthStateChanged(auth, user => {
  if (user) location.href = "home.html";
});

/* ELEMENT */
const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const toggle = document.getElementById("togglePwd");
const pwdInput = document.getElementById("password");
const btn = document.getElementById("loginBtn");

toggle.onclick = () => {
  passwordInput.type =
    passwordInput.type === "password" ? "text" : "password";

  toggle.textContent =
    passwordInput.type === "password" ? "👁️" : "🙈";
};

/* ERROR BOX */
const errorBox = document.createElement("div");
errorBox.className = "error-box";
errorBox.style.display = "none"; // ⬅️ PENTING
form.prepend(errorBox);

/* HUMAN ERROR */
function humanError(code) {
  if (code.includes("user-not-found")) return "Akun tidak ditemukan";
  if (code.includes("wrong-password")) return "Password salah";
  if (code.includes("invalid-email")) return "Email tidak valid";
  if (code.includes("too-many-requests")) return "Terlalu banyak percobaan, coba lagi nanti";
  return "Gagal login, coba lagi";
}

/* SUBMIT */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorBox.style.display = "none";
  errorBox.textContent = "";

  btn.disabled = true;
  btn.textContent = "Loading...";

  try {
    btn.classList.add("loading");
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value.trim()
    );

    location.href = "home.html";

  } catch (err) {
    errorBox.textContent = humanError(err.code);
    btn.disabled = false;
    btn.textContent = "Masuk";
    btn.classList.remove("loading");
  }
});
