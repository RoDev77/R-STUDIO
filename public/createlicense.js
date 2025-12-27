// createlicense.js
/* ================= FIREBASE ================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= CONFIG ================= */
const API_BASE = "https://api.rstudiolab.online/api";

/* ================= STATE ================= */
let currentUser = null;     // firebase auth user
let currentRole = "member"; // role dari Firestore
let isEmailVerified = false; // status verifikasi email
let logs = [];

/* ================= INIT ================= */
document.getElementById("apiEndpoint").textContent = API_BASE;

/* ================= UTIL ================= */
function showNotification(message, type = "success") {
  const n = document.getElementById("notification");
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => n.classList.remove("show"), 3000);
}

/* ================= EMAIL VERIFICATION BANNER ================= */
function showVerificationBanner(isVerified) {
  // Hapus banner lama jika ada
  const oldBanner = document.getElementById("verificationBanner");
  if (oldBanner) oldBanner.remove();

  if (isVerified) return; // Jangan tampilkan jika sudah verified

  // Buat banner warning
  const banner = document.createElement("div");
  banner.id = "verificationBanner";
  banner.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px rgba(0,0,0,.1);
      border-radius: 12px;
      margin-bottom: 24px;
      animation: slideDown 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">⚠️</span>
        <div>
          <div style="font-weight: 700; font-size: 15px;">Email Belum Diverifikasi</div>
          <div style="font-size: 13px; opacity: 0.9;">
            Verifikasi email kamu untuk menggunakan semua fitur dengan aman.
          </div>
        </div>
      </div>
      <a href="profile.html" style="
        background: white;
        color: #f59e0b;
        padding: 10px 20px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,.1);
      ">
        Verifikasi Sekarang
      </a>
    </div>
  `;

  // Tambahkan CSS animation
  if (!document.getElementById("verificationBannerStyle")) {
    const style = document.createElement("style");
    style.id = "verificationBannerStyle";
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Insert banner di awal konten
  const mainContent = document.querySelector(".container") || document.body;
  mainContent.insertBefore(banner, mainContent.firstChild);
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "login.html";

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    showNotification("User data not found", "error");
    return;
  }

  const data = snap.data();

  // Cek status verifikasi email
  isEmailVerified = data.emailVerified || false;

  // Tampilkan banner jika belum verified
  showVerificationBanner(isEmailVerified);

  // Tampilkan notifikasi toast
  if (!isEmailVerified) {
    setTimeout(() => {
      showNotification("⚠️ Email belum diverifikasi. Silakan verifikasi di halaman Profile.", "warning");
    }, 1000);
  }

  if (data.role === "owner") {
    currentRole = "owner";
  } else if (data.role === "admin") {
    currentRole = "admin";
  } else if (data.isVIP === true) {
    currentRole = "vip";
  } else {
    currentRole = "member";
  }

  renderUserRole(currentRole);
  checkServerStatus();
  loadLicenses();
  refreshLogs();
});

function renderUserRole(role) {
  const badge = document.getElementById("userRoleBadge");
  if (!badge) return;

  badge.className = "role-badge"; // reset

  switch (role) {
    case "owner":
      badge.textContent = "👑 Owner";
      badge.classList.add("role-owner");
      break;

    case "admin":
      badge.textContent = "🛠 Admin";
      badge.classList.add("role-admin");
      break;

    case "vip":
      badge.textContent = "💎 VIP";
      badge.classList.add("role-vip");
      break;

    default:
      badge.textContent = "👤 Member";
      badge.classList.add("role-member");
  }
}

/* ================= PERMISSION ================= */
function canRevoke(license) {
  if (!license) return false;

  // OWNER → semua
  if (currentRole === "owner") return true;

  // ADMIN
  if (currentRole === "admin") {
    // license sendiri
    if (license.createdBy === currentUser.uid) return true;

    // revoke member / vip
    return license.creatorRole === "member" || license.creatorRole === "vip";
  }

  // MEMBER / VIP → hanya license sendiri
  return license.createdBy === currentUser.uid;
}

// ================= CREATE LICENSE =================
document
  .getElementById("createLicenseForm")
  .addEventListener("submit", async e => {
    e.preventDefault();

    // ⚠️ CEK VERIFIKASI EMAIL SEBELUM CREATE LICENSE
    if (!isEmailVerified) {
      if (confirm("Email kamu belum diverifikasi. Verifikasi dulu untuk keamanan akun.\n\nKe halaman Profile sekarang?")) {
        location.href = "profile.html";
      }
      return;
    }

    try {
      const token = await currentUser.getIdToken();

      const payload = {
        gameId: Number(gameId.value),
        placeId: Number(placeId.value),
        mapName: mapName.value,
        duration: Number(duration.value),
      };
      
      const res = await fetch(`${API_BASE}/create-license`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "FAILED");

      // === LOG CREATE LICENSE ===
      await fetch(`${API_BASE}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          licenseId: data.licenseId,
          action: "CREATE_LICENSE",
          valid: true
        })
      });

      licenseKeyDisplay.textContent = `
      License ID : ${data.licenseId}
      Map Name   : ${data.mapName}
      Game ID    : ${data.gameId}
      Place ID   : ${data.placeId}
      Expires At : ${
        data.expiresAt
          ? new Date(data.expiresAt).toLocaleDateString()
          : "♾️ Unlimited"
      }
      `;

      newLicenseInfo.style.display = "block";
      showNotification("✅ License created");

      loadLicenses();

    } catch (err) {
      showNotification(err.message, "error");
    }
  });

/* ================= SERVER STATUS ================= */
async function checkServerStatus() {
  const el = document.getElementById("serverStatus");
  try {
    const res = await fetch(`${API_BASE}/meta?type=health`);
    if (!res.ok) throw new Error();
    el.textContent = "Online";
    el.className = "status online";
  } catch {
    el.textContent = "Offline";
    el.className = "status offline";
  }
}

const userCache = {};

async function getUserName(uid) {
  if (userCache[uid]) return userCache[uid];

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "Unknown";

    const data = snap.data();
    const name = data.username || data.name || data.email || "Unknown";

    userCache[uid] = name;
    return name;
  } catch {
    return "Unknown";
  }
}

/* ================= DOM CACHE ================= */
const totalLicenses   = document.getElementById("totalLicenses");
const activeLicenses  = document.getElementById("activeLicenses");
const expiredLicenses = document.getElementById("expiredLicenses");
const licenseList     = document.getElementById("licenseList");

/* ================= LICENSES ================= */
async function loadLicenses() {
  try {
    const res = await fetch(`${API_BASE}/licenses`);
    if (!res.ok) throw new Error("NETWORK");

    const data = await res.json();
    if (!data.success || !Array.isArray(data.licenses)) {
      throw new Error("INVALID_RESPONSE");
    }

    const licenses = data.licenses;
    const now = Date.now();

    // === SAFE UI UPDATE ===
    if (totalLicenses)   totalLicenses.textContent = licenses.length;
    if (activeLicenses)  activeLicenses.textContent = licenses.filter(
      l => !l.revoked && (l.expiresAt === null || l.expiresAt > now)
    ).length;
    if (expiredLicenses) expiredLicenses.textContent = licenses.filter(
      l => l.expiresAt !== null && l.expiresAt <= now
    ).length;

    // === EMPTY STATE ===
    if (!licenses.length) {
      if (licenseList) {
        licenseList.innerHTML =
          `<p style="opacity:.6;text-align:center">No licenses yet</p>`;
      }
      return;
    }

    // === RENDER LIST ===
    licenseList.innerHTML = (await Promise.all(
      licenses.map(async l => {
        let badge = "active";
        if (l.revoked) badge = "revoked";
        else if (l.expiresAt === null) badge = "unlimited";
        else if (l.expiresAt <= now) badge = "expired";

        const creatorName = await getUserName(l.createdBy);

        return `
          <div class="license-item">
            <b>${l.mapName}</b>
            <span class="badge ${badge}">${badge.toUpperCase()}</span>

            <p>ID License: ${l.licenseId}</p>
            <p>Name User: ${creatorName}</p>
            <p>Game ID: ${l.gameId}</p>
            <p>Place ID: ${l.placeId}</p>
            <p>Expires: ${
              l.expiresAt
                ? new Date(l.expiresAt).toLocaleDateString()
                : "♾️ Unlimited"
            }</p>

            ${l.revoked ? `
              <p style="color:#ef4444">
                🔥 Revoked by:
                <b>${await getUserName(l.revokedBy)}</b>
                ${l.revokedByRole}
              </p>
              <p style="font-style:italic">
                Reason: "${l.revokedReason}"
              </p>

              ${currentRole === "owner" ? `
                <button class="btn btn-warning btn-sm"
                  onclick="undoRevoke('${l.licenseId}')">
                  Undo Revoke
                </button>
              ` : ""}
            `
            : `
            ${!l.revoked && canRevoke(l) ? `
              <button class="btn btn-danger btn-sm"
                onclick="revokeLicense('${l.licenseId}')">
                Revoke
              </button>
            ` : ""}
            `}

          </div>
        `;
      })
    )).join("");

  } catch (err) {
    console.error("LOAD LICENSE ERROR:", err);
    showNotification("Failed load licenses", "error");
  }
}

// ================= VERIFY =================
async function testConnection() {
  const licenseId = prompt("Masukkan License ID");
  if (!licenseId) return;

  const universeId = document.getElementById("testGameId").value;
  const placeId = document.getElementById("testPlaceId").value;

  if (!universeId) {
    showNotification("Universe ID kosong", "error");
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/verify-license?licenseId=${licenseId}&universeId=${universeId}&placeId=${placeId}`
    );

    const data = await res.json();

    // === LOG VERIFY (VALID / INVALID) ===
    const token = await currentUser.getIdToken();

    await fetch(`${API_BASE}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        licenseId,
        action: "TEST_CONNECTION",
        valid: data.valid === true
      })
    });

    if (!data.valid) {
      throw new Error(data.reason || "INVALID");
    }

    testResult.innerHTML = `
    <div style="background:#10b981;color:white;padding:12px;border-radius:8px">
    ✅ VALID<br>
    Map Name: ${data.mapName}<br>
    Game ID: ${data.gameId}<br>
    Universe ID: ${data.universeId}
    </div>`;
  } catch {
    testResult.innerHTML = `
    <div style="background:#ef4444;color:white;padding:12px;border-radius:8px">
    ❌ INVALID
    </div>`;
  }
}

/* ================= REVOKE ================= */
async function revokeLicense(licenseId) {
  // ⚠️ CEK VERIFIKASI EMAIL SEBELUM REVOKE
  if (!isEmailVerified) {
    showNotification("⚠️ Verifikasi email dulu untuk melakukan revoke", "warning");
    return;
  }

  const reason = prompt("Alasan revoke (wajib):");
  if (!reason || reason.trim().length < 3)
    return showNotification("Alasan wajib diisi", "error");

  if (!confirm("Revoke license ini?")) return;

  try {
    const token = await currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/revoke-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ licenseId, reason })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showNotification("License revoked");
    loadLicenses();
    refreshLogs();
  } catch (err) {
    showNotification(err.message, "error");
  }
}

async function undoRevoke(licenseId) {
  if (currentRole !== "owner") {
    return showNotification("Owner only", "error");
  }

  if (!confirm("Undo revoke license?")) return;

  try {
    const token = await currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/undo-revoke-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ licenseId })
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    showNotification("License restored");
    loadLicenses();
    refreshLogs();

  } catch {
    showNotification("Undo revoke failed", "error");
  }
}

/* ================= LOGS ================= */
async function refreshLogs() {
  try {
    const token = await currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/logs`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    logs = data.logs || [];

    logContainer.innerHTML = logs.map(l => {
      if (l.type === "revoke") {
        return `
          <div class="log-entry error">
            [${new Date(l.time).toLocaleTimeString()}]
            🔥 REVOKE —
            ${l.licenseId}<br>
            by ${(l.revokedByRole || "unknown").toUpperCase()}
            — "${l.reason || "-"}"
          </div>
        `;
      }

      if (l.type === "undo_revoke") {
        return `
          <div class="log-entry success">
            [${new Date(l.time).toLocaleTimeString()}]
            ♻️ UNDO REVOKE —
            ${l.licenseId} restored by OWNER
          </div>
        `;
      }

      return `
        <div class="log-entry">
          [${new Date(l.time).toLocaleTimeString()}]
          ${l.licenseId}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("LOG ERROR:", err);
    showNotification("Failed load logs", "error");
  }
}

/* ================= GLOBAL ================= */
window.loadLicenses = loadLicenses;
window.testConnection = testConnection;
window.refreshLogs = refreshLogs;
window.revokeLicense = revokeLicense;
window.undoRevoke = undoRevoke;

/* ================= AUTO REFRESH ================= */
setInterval(checkServerStatus, 30000);
setInterval(refreshLogs, 5000);

console.log("✅ License Manager ready");
