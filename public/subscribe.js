import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from
"https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

onAuthStateChanged(auth, async user => {
  if (!user) location.href = "login.html";

  document.getElementById("requestVIP").onclick = async () => {
    await setDoc(doc(db, "vip_requests", user.uid), {
      uid: user.uid,
      email: user.email,
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert("✅ Permintaan VIP terkirim, tunggu admin approve");
  };
});
