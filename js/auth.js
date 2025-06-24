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
  // Check if the user is logged in
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const loggedInUserId = user.uid;
      localStorage.setItem("loggedInUserId", loggedInUserId);

      try {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", loggedInUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          document.getElementById("loggedUserfname").innerText = userData.fname || "User";

          // Profile Picture Handling
          const profilePicRef = ref(storage, 'profile_pictures/' + loggedInUserId); // Path to profile images
          try {
            const profilePicUrl = await getDownloadURL(profilePicRef);
            document.getElementById("profilePicture").src = profilePicUrl; // Set profile image
          } catch (error) {
            console.error("Error loading profile picture:", error);
            document.getElementById("profilePicture").src = '/images/default-avatar.jpg'; // Default image if error occurs
          }
        } else {
          console.log("No user data found.");
        }
      } catch (error) {
        console.error("Error retrieving user data:", error);
      }
    } else {
      // User is not logged in, redirect to the login page
      localStorage.removeItem("loggedInUserId");
      window.location.href = "/index.html";
    }
  });

  // Logout functionality
  const logoutButton = document.getElementById("logoutButton");
  logoutButton.addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        localStorage.removeItem("loggedInUserId");
        window.location.href = "/index.html"; // Redirect to login page on logout
      })
      .catch((error) => {
        console.log("Error during logout:", error);
      });
  });
});

document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
  
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  });
  