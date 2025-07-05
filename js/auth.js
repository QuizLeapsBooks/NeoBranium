import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
  authDomain: "neobranium.firebaseapp.com",
  projectId: "neobranium",
  storageBucket: "neobranium.appspot.com",
  messagingSenderId: "59188872045",
  appId: "1:59188872045:web:450a70b28e4be5db335064",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const loggedInUserId = user.uid;
      localStorage.setItem("loggedInUserId", loggedInUserId);

      try {
        const userDoc = await getDoc(doc(db, "users", loggedInUserId));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Username
          const usernameDisplay = document.getElementById("usernameDisplay");
          if (usernameDisplay) {
            usernameDisplay.innerText = `Welcome, ${userData.username || user.displayName || "User"}!`;
          }

          // Bio 👇
          const bioBox = document.getElementById("userBioText");
          if (bioBox) {
            bioBox.innerText = userData.bio || "No bio added yet.";
          }

          // Profile Picture 👇
          const profilePicRef = ref(storage, `profileImages/${loggedInUserId}`);
          try {
            const profilePicUrl = await getDownloadURL(profilePicRef);
            const profilePicture = document.getElementById("profilePicture");
            if (profilePicture) {
              profilePicture.src = profilePicUrl;
            }
          } catch (error) {
            console.error("Error loading profile picture:", error);
            const profilePicture = document.getElementById("profilePicture");
            if (profilePicture) {
              profilePicture.src = '/images/default-avatar.jpg';
            }
          }

        } else {
          console.log("No user data found.");
          const usernameDisplay = document.getElementById("usernameDisplay");
          if (usernameDisplay) {
            usernameDisplay.innerText = "Welcome, User!";
          }
        }
      } catch (error) {
        console.error("Error retrieving user data:", error);
      }

    } else {
      // Not logged in
      localStorage.removeItem("loggedInUserId");
      window.location.href = "/index.html";
    }
  });

  // Logout
  const logoutButton = document.getElementById("logout");
  if (logoutButton) {
    logoutButton.addEventListener("click", (e) => {
      e.preventDefault();
      signOut(auth)
        .then(() => {
          localStorage.removeItem("loggedInUserId");
          window.location.href = "/index.html";
        })
        .catch((error) => {
          console.error("Error during logout:", error);
          alert("Failed to logout: " + error.message);
        });
    });
  }
});
