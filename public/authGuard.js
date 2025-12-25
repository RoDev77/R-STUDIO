import { auth, db } from "./firebase.js";
import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc }
from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

export function requireAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        location.href = "login.html";
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      resolve({
        user,
        data: snap.exists() ? snap.data() : { role: "public" }
      });
    });
  });
}
