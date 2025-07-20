const username = document.getElementById("username");
const usernameLetter = document.getElementById("username-letter");

const skeletonBar = document.getElementById("username-skeleton-bar");
const skeletonCircle = document.getElementById("username-skeleton");

const storedName = localStorage.getItem("userName");

// Simulate loading delay
setTimeout(() => {
  if (storedName) {
    username.innerText = storedName;
    usernameLetter.innerText = storedName[0].toUpperCase();
  } else {
    username.innerText = "Guest";
    usernameLetter.innerText = "G";
  }

  // Hide skeletons
  skeletonBar.style.display = "none";
  skeletonCircle.style.display = "none";

  // Show real content
  username.style.display = "inline";
  usernameLetter.style.display = "inline";
}, 1000); // 1-second fake loading
