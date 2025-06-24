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
    const db = getFirestore(app);
    const auth = getAuth(app);

    // Reference to the PDF grid container
    const pdfGrid = document.getElementById('pdf-grid');

    // Listen for authentication state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, fetch and display user's PDFs
            await loadUserPDFs(user.uid);
        } else {
            // User is not signed in, prompt to login
            pdfGrid.innerHTML = '<p>Please <a href="login.html">log in</a> to view your PDFs.</p>';
        }
    });

    // Function to load PDFs for a specific user
    async function loadUserPDFs(userId) {
        // Clear any existing content
        pdfGrid.innerHTML = '';

        try {
            // Query 'pdfs' collection where userId matches logged-in user
            const pdfsQuery = query(collection(db, 'pdfs'), where('userId', '==', userId));
            const querySnapshot = await getDocs(pdfsQuery);

            // Loop through each PDF document
            querySnapshot.forEach(async (docSnap) => {
                const pdfData = docSnap.data();
                const noteId = docSnap.id; // Using Firestore document ID as note ID
                const title = pdfData.title || 'Untitled';
                const description = pdfData.description || '';
                const pdfUrl = pdfData.url; // URL of the PDF on GitHub (raw link)

                // Create card element
                const card = document.createElement('div');
                card.classList.add('card');

                // Create thumbnail (placeholder for PDF preview)
                const thumbnail = document.createElement('div');
                thumbnail.classList.add('thumbnail');
                thumbnail.textContent = 'PDF';  // Placeholder icon/text
                card.appendChild(thumbnail);

                // Create content container
                const content = document.createElement('div');
                content.classList.add('content');

                // Title
                const titleElem = document.createElement('h3');
                titleElem.classList.add('title');
                titleElem.textContent = title;
                content.appendChild(titleElem);

                // Description
                const descElem = document.createElement('p');
                descElem.classList.add('desc');
                descElem.textContent = description;
                content.appendChild(descElem);

                // Like section (count and button)
                const likeSection = document.createElement('div');
                likeSection.classList.add('like-section');

                const likeCountElem = document.createElement('span');
                likeCountElem.classList.add('like-count');
                likeCountElem.textContent = '0 Likes';
                likeSection.appendChild(likeCountElem);

                const likeButton = document.createElement('button');
                likeButton.classList.add('like-button');
                likeButton.textContent = 'Like';
                likeSection.appendChild(likeButton);

                content.appendChild(likeSection);
                card.appendChild(content);

                // Add click event to open PDF in new tab when clicking thumbnail or title
                [thumbnail, titleElem].forEach(elem => {
                    elem.style.cursor = 'pointer';
                    elem.addEventListener('click', () => {
                        if (pdfUrl) {
                            // Open the PDF link in a new tab
                            window.open(pdfUrl, '_blank');
                        }
                    });
                });

                // Append card to grid
                pdfGrid.appendChild(card);

                // Get and display initial like count
                updateLikeCount(noteId, likeCountElem);

                // Disable button if user already liked
                checkIfUserLiked(userId, noteId, likeButton);

                // Handle like button click
                likeButton.addEventListener('click', async () => {
                    // Ensure user is logged in (should be true in this scope)
                    const currentUser = auth.currentUser;
                    if (!currentUser) {
                        alert('You must be logged in to like.');
                        return;
                    }
                    // Check if this user already liked this PDF
                    const likeDocRef = doc(db, 'likes', currentUser.uid + '_' + noteId);
                    const likeDocSnap = await getDoc(likeDocRef);
                    if (likeDocSnap.exists()) {
                        alert('You have already liked this PDF.');
                    } else {
                        // Add a like document under 'likes' collection
                        await setDoc(likeDocRef, {
                            userId: currentUser.uid,
                            noteId: noteId,
                            timestamp: Date.now()
                        });
                        // Update UI count (increment by 1)
                        const currentCount = parseInt(likeCountElem.textContent) || 0;
                        likeCountElem.textContent = (currentCount + 1) + ' Likes';
                        // Disable the like button to prevent multiple likes
                        likeButton.disabled = true;
                    }
                });
            });
        } catch (error) {
            console.error('Error loading PDFs:', error);
            pdfGrid.innerHTML = '<p>Error loading PDFs.</p>';
        }
    }

    // Function to update the like count for a PDF
    async function updateLikeCount(noteId, likeCountElem) {
        try {
            // Query the 'likes' collection for this noteId and count the documents
            const likesQuery = query(collection(db, 'likes'), where('noteId', '==', noteId));
            const snapshot = await getCountFromServer(likesQuery);
            const count = snapshot.data().count || 0;
            likeCountElem.textContent = count + ' Likes';
        } catch (error) {
            console.error('Error fetching like count:', error);
        }
    }

    // Function to check if current user already liked this PDF
    async function checkIfUserLiked(userId, noteId, likeButton) {
        try {
            const likeDocRef = doc(db, 'likes', userId + '_' + noteId);
            const likeDocSnap = await getDoc(likeDocRef);
            if (likeDocSnap.exists()) {
                // Disable like button if user already liked
                likeButton.disabled = true;
            }
        } catch (error) {
            console.error('Error checking like status:', error);
        }
    }

    