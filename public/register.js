  import { auth, db } from "./firebase.js";
  import {
    createUserWithEmailAndPassword,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
  import {
    doc, setDoc, serverTimestamp
  } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

  // Cek jika sudah login, redirect ke home
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "home.html";
    }
  });

  const form = document.getElementById("registerForm");
  const nameInput = document.getElementById("nameInput");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const submitBtn = document.getElementById("submitBtn");
  const toggleBtn = document.getElementById("togglePassword");
  const strengthBar = document.getElementById("strengthBar");

  // Buat error box jika belum ada
  let errorBox = document.querySelector(".error-box");
  if (!errorBox) {
    errorBox = document.createElement("div");
    errorBox.className = "error-box";
    form.prepend(errorBox);
  }

  // Password strength indicator
  passwordInput.addEventListener("input", () => {
    const pass = passwordInput.value;
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;

    const percentage = Math.min((strength / 5) * 100, 100);
    strengthBar.style.width = percentage + "%";

    if (percentage < 20) {
      strengthBar.style.background = "#ef4444";
    } else if (percentage < 50) {
      strengthBar.style.background = "#f59e0b";
    } else if (percentage < 80) {
      strengthBar.style.background = "#eab308";
    } else {
      strengthBar.style.background = "#22c55e";
    }
  });

  function validateName(name) {
    const clean = name.trim();
    if (!clean) return "Nama tidak boleh kosong";
    if (clean.length < 3) return "Nama minimal 3 karakter";
    if (!/^[A-Za-z\s]+$/.test(clean)) return "Nama hanya boleh huruf";
    return null;
  }

  function getErrorMessage(code) {
    if (code.includes("email-already")) return "Email sudah terdaftar";
    if (code.includes("weak-password")) return "Password minimal 6 karakter";
    if (code.includes("invalid-email")) return "Format email tidak valid";
    if (code.includes("network-request-failed")) return "Cek koneksi internet";
    return "Terjadi kesalahan, coba lagi";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorBox.style.display = "none";
    errorBox.textContent = "";

    const nameError = validateName(nameInput.value);
    if (nameError) {
      errorBox.textContent = nameError;
      errorBox.style.display = "block";
      return;
    }

    if (passwordInput.value.length < 6) {
      errorBox.textContent = "Password minimal 6 karakter";
      errorBox.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Mendaftar...";

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailInput.value,
        passwordInput.value
      );

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: nameInput.value.trim(),
        email: emailInput.value,
        role: "member",
        isVIP: false,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      window.location.href = "index.html";

    } catch (err) {
      errorBox.textContent = getErrorMessage(err.code);
      errorBox.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "Buat Akun";
    }
  });

  // Toggle password visibility
  toggleBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    toggleBtn.textContent = type === "password" ? "👁️" : "🙈";
  });

  // Hapus error saat typing
  [nameInput, emailInput, passwordInput].forEach(input => {
    input.addEventListener("input", () => {
      errorBox.style.display = "none";
    });
  });