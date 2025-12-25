// ================= CONFIG =================
const API_BASE = "https://api.rstudiolab.online/api";

// ================= STATE =================
let logs = [];
let currentUser = null;

// ================= INIT =================
document.getElementById("apiEndpoint").textContent = API_BASE;

// ================= UTIL =================
function showNotification(message, type = "success") {
  const n = document.getElementById("notification");
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => n.classList.remove("show"), 3000);
}

// ================= USER =================
async function loadUser() {
  try {
    const res = await fetch(`${API_BASE}/me`);
    const data = await res.json();
    currentUser = data.user;
  } catch {
    showNotification("Failed load user", "error");
  }
}

function canRevoke() {
  if (!currentUser) return false;
  return currentUser.role === "admin" || currentUser.role === "owner";
}

// ================= LOGS =================
function renderLogs() {
  const el = document.getElementById("logContainer");
  if (!logs || logs.length === 0) {
    el.innerHTML = "<i>No connection logs</i>";
    return;
  }

  el.innerHTML = logs
    .map(
      l => `
      <div class="log-entry ${l.valid ? "success" : "error"}">
        [${new Date(l.time).toLocaleTimeString()}]
        ${l.licenseId} — ${l.valid ? "VALID" : "INVALID"}
      </div>`
    )
    .join("");
}

async function refreshLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs`);
    const data = await res.json();
    logs = data.logs || [];
    renderLogs();
  } catch {
    showNotification("Failed load logs", "error");
  }
}

// ================= SERVER STATUS =================
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

// ================= LOAD LICENSES =================
async function loadLicenses() {
  try {
    const res = await fetch(`${API_BASE}/licenses`);
    const data = await res.json();
    if (!data.success) throw new Error();

    const now = Date.now();
    const licenses = data.licenses;

    totalLicenses.textContent = licenses.length;
    activeLicenses.textContent = licenses.filter(
      l => !l.revoked && (l.expiresAt === null || l.expiresAt > now)
    ).length;
    expiredLicenses.textContent = licenses.filter(
      l => l.expiresAt !== null && l.expiresAt <= now
    ).length;

    licenseList.innerHTML = licenses
      .map(l => {
        let badge = "active";
        if (l.revoked) badge = "revoked";
        else if (l.expiresAt === null) badge = "unlimited";
        else if (l.expiresAt <= now) badge = "expired";

        return `
<div class="license-item ${badge === "expired" ? "expired" : ""}">
  <div style="display:flex;justify-content:space-between">
    <b>${l.owner}</b>
    <span class="badge ${badge}">${badge.toUpperCase()}</span>
  </div>
  <p>ID: ${l.licenseId}</p>
  <p>Game: ${l.gameId}</p>
  <p>Place: ${l.placeId}</p>
  <p>Expires: ${
    l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "♾️ Unlimited"
  }</p>

  ${
    canRevoke() && !l.revoked
      ? `<button class="btn btn-danger btn-sm"
           onclick="revokeLicense('${l.licenseId}')">
           Revoke
         </button>`
      : ""
  }
</div>`;
      })
      .join("");
  } catch {
    showNotification("Failed load licenses", "error");
  }
}

// ================= REVOKE =================
async function revokeLicense(licenseId) {
  if (!confirm("Revoke license?")) return;

  try {
    const res = await fetch(`${API_BASE}/revoke-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseId,
        uid: currentUser.uid,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error("No permission");

    showNotification("License revoked");
    loadLicenses();
  } catch {
    showNotification("No permission", "error");
  }
}

// ================= VERIFY =================
async function testConnection() {
  const licenseId = prompt("Masukkan License ID");
  if (!licenseId) return;

  const universeId = document.getElementById("testGameId").value;
  const placeId = document.getElementById("testPlaceId").value;

  try {
    const res = await fetch(
      `${API_BASE}/verify-license?licenseId=${licenseId}&universeId=${universeId}&placeId=${placeId}`
    );

    const data = await res.json();
    if (!data.valid) throw new Error();

    testResult.innerHTML = `
<div style="background:#10b981;color:white;padding:12px;border-radius:8px">
✅ VALID<br>
Owner: ${data.owner}<br>
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

// ================= GLOBAL =================
window.loadLicenses = loadLicenses;
window.refreshLogs = refreshLogs;
window.revokeLicense = revokeLicense;
window.testConnection = testConnection;

// ================= START =================
(async () => {
  console.log("✅ License Manager ready");
  await loadUser();
  checkServerStatus();
  loadLicenses();
  refreshLogs();
  setInterval(checkServerStatus, 30000);
  setInterval(refreshLogs, 5000);
})();
