import { db, storage } from "/js/auth.js";
import DOMPurify from "dompurify";
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUserId = localStorage.getItem('loggedInUserId');
    if (!loggedInUserId) {
        window.location.href = '/htmls/sign.html';
        return;
    }
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadContent = document.getElementById('uploadContent');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    const solveBtn = document.getElementById('solveBtn');
    const btnText = solveBtn.querySelector('.btn-text');
    const loadingSpinner = document.getElementById('loadingSpinner');

    const outputContainer = document.getElementById('outputContainer');
    const outputContent = document.getElementById('outputContent');
    const copyBtn = document.getElementById('copyBtn');

    let currentFile = null;
    let currentBase64 = null;
    let lastGeneratedText = "";
    const historyDataMap = new Map();

    const getApiBaseUrl = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        return '/api';
    };

    const API_BASE_URL = getApiBaseUrl();

    // --- File Upload Handling ---

    // Click to open file dialog
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== removeImageBtn && !removeImageBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFiles(files[0]);
        }
    }

    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            handleFiles(this.files[0]);
        }
    });

    function handleFiles(file) {
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

        // Validate File Type
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert('Invalid file format. Please upload a PNG or JPEG image.');
            return;
        }

        // Validate File Size
        if (file.size > MAX_SIZE) {
            alert('File is too large. Maximum allowed size is 5MB.');
            return;
        }

        currentFile = file;

        // Preview image and convert to base64
        const reader = new FileReader();
        reader.onload = (e) => {
            currentBase64 = e.target.result; // Save base64 string
            imagePreview.src = currentBase64;
            uploadContent.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            solveBtn.disabled = false;
        };

        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };

        reader.readAsDataURL(file);
    }

    // Remove Image
    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUpload();
    });

    function resetUpload() {
        currentFile = null;
        currentBase64 = null;
        fileInput.value = '';
        imagePreview.src = '';
        previewContainer.classList.add('hidden');
        uploadContent.classList.remove('hidden');
        solveBtn.disabled = true;
        outputContainer.classList.add('hidden');
        outputContent.innerHTML = '';

        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) feedbackSection.style.display = 'block';
    }

    // --- Solving Action ---
    solveBtn.addEventListener('click', async () => {
        if (!currentFile || !currentBase64) return;

        // --- Usage Limit Check ---
        const SOLVE_LIMIT = 10;
        const RESET_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        let solveCount = parseInt(localStorage.getItem('solveCount')) || 0;
        let solveStartTime = parseInt(localStorage.getItem('solveStartTime')) || Date.now();

        // Check if 24 hours have passed since the first solve in the current window
        if (Date.now() - solveStartTime >= RESET_TIME_MS) {
            solveCount = 0;
            solveStartTime = Date.now();
        }

        // Enforce limit
        if (solveCount >= SOLVE_LIMIT) {
            alert("Daily limit reached");
            return;
        }

        // Increment count and save to localStorage
        solveCount++;
        localStorage.setItem('solveCount', solveCount.toString());
        localStorage.setItem('solveStartTime', solveStartTime.toString());
        // -------------------------

        // UI Loading State
        solveBtn.disabled = true;
        btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing image...';
        btnText.style.opacity = '1';
        loadingSpinner.classList.add('hidden');
        outputContainer.classList.add('hidden');

        try {
            // Extract base64 content without the data URL prefix
            const base64Data = currentBase64.split(',')[1];
            const mimeType = currentFile.type;

            const response = await fetch(`${API_BASE_URL}/gemini-solve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64: base64Data,
                    mimeType: mimeType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to solve image");
            }

            const resultText = data.result;
            lastGeneratedText = resultText;

            // Enhanced parser for Bold, Italic, and Newlines
            const rawHTML = resultText
                .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*\s*(.*?)\s*\*/g, '<em>$1</em>') // Italic
                .replace(/\n\n/g, '</p><p style="margin-top: 10px;">')
                .replace(/\n/g, '<br>');

            // Sanitize HTML to prevent XSS while preserving allowed formatting
            const cleanHTML = DOMPurify.sanitize(`<p>${rawHTML}</p>`, {
                ALLOWED_TAGS: ['p', 'strong', 'em', 'br', 'span', 'i', 'ul', 'li', 'ol'],
                ALLOWED_ATTR: ['style']
            });

            outputContent.innerHTML = cleanHTML;

        } catch (error) {
            console.error("Gemini Solve Error:", error);
            outputContent.innerHTML = `<div style="color: #ef4444; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                <p><i class="fa-solid fa-triangle-exclamation"></i> <strong>Error processing image</strong></p>
                <p style="font-size: 13px; margin-top: 8px;">${error.message}</p>
                <p style="font-size: 12px; margin-top: 8px;"><em>If this error persists, please refresh the page or try again later.</em></p>
            </div>`;
        } finally {
            // Restore Button UI
            solveBtn.disabled = false;
            btnText.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Solve Question';
            btnText.style.opacity = '1';
            loadingSpinner.classList.add('hidden');
            outputContainer.classList.remove('hidden');

            // Reset feedback buttons
            const btnSolved = document.getElementById('btnSolved');
            const btnUnsolved = document.getElementById('btnUnsolved');
            if (btnSolved && btnUnsolved) {
                btnSolved.disabled = false;
                btnUnsolved.disabled = false;
                btnUnsolved.style.display = 'inline-block';
                btnSolved.innerHTML = 'Doubt Solved ✅';
                btnSolved.className = 'feedback-btn solved-btn';
            }

            // Scroll to output
            outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // --- Copy functionality ---
    copyBtn.addEventListener('click', () => {
        const textToCopy = outputContent.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });

    // --- Feedback & History Logic ---
    const btnSolved = document.getElementById('btnSolved');
    const btnUnsolved = document.getElementById('btnUnsolved');
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    const historyModal = document.getElementById('historyModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    async function saveDoubt(status) {
        if (!currentBase64 || !lastGeneratedText) return;

        btnSolved.disabled = true;
        btnUnsolved.disabled = true;
        const originalSolvedText = btnSolved.innerHTML;
        const originalUnsolvedText = btnUnsolved.innerHTML;

        if (status === 'solved') btnSolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        else btnUnsolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            // 1. Upload image to Firebase Storage
            const storagePath = `users/${loggedInUserId}/doubts/${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);

            // Upload the base64 string (without the data URL prefix)
            const base64Data = currentBase64.split(',')[1];
            await uploadString(storageRef, base64Data, 'base64', {
                contentType: 'image/jpeg'
            });

            // 2. Get the download URL
            const downloadURL = await getDownloadURL(storageRef);

            // 3. Save to Firestore with the image URL
            const collectionName = status === 'solved' ? 'solvedDoubts' : 'unsolvedDoubts';
            await addDoc(collection(db, `users/${loggedInUserId}/${collectionName}`), {
                questionText: lastGeneratedText,
                image: downloadURL,
                timestamp: Date.now()
            });

            btnSolved.innerHTML = 'Saved! ✅';
            btnUnsolved.style.display = 'none';
            if (status === 'unsolved') {
                btnSolved.innerHTML = 'Saved! ❌';
                btnSolved.classList.replace('solved-btn', 'unsolved-btn');
            }
        } catch (error) {
            console.error("Error saving doubt:", error);
            btnSolved.innerHTML = 'Error Saving';
            btnSolved.disabled = false;
            btnUnsolved.disabled = false;
            if (status === 'unsolved') btnUnsolved.innerHTML = originalUnsolvedText;
            alert("Firestore Error: " + error.message); // Added for debugging
        }
    }

    if (btnSolved) btnSolved.addEventListener('click', () => saveDoubt('solved'));
    if (btnUnsolved) btnUnsolved.addEventListener('click', () => saveDoubt('unsolved'));

    // Modal Toggles
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            historyModal.classList.remove('hidden');
            // Check which tab is active
            const activeTabBtn = document.querySelector('.tab-btn.active');
            const target = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'solved-tab';
            const collectionName = target === 'solved-tab' ? 'solvedDoubts' : 'unsolvedDoubts';
            const listId = target === 'solved-tab' ? 'solvedList' : 'unsolvedList';
            loadHistory(collectionName, listId);
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            historyModal.classList.add('hidden');
        });
    }

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden', 'active'));
            tabContents.forEach(c => c.classList.remove('active')); // Reset active

            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.remove('hidden');
            document.getElementById(target).classList.add('active');

            const collectionName = target === 'solved-tab' ? 'solvedDoubts' : 'unsolvedDoubts';
            const listId = target === 'solved-tab' ? 'solvedList' : 'unsolvedList';
            loadHistory(collectionName, listId);
        });
    });

    async function loadHistory(collectionName, listElementId) {
        const listEl = document.getElementById(listElementId);
        if (!listEl) return;

        listEl.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i></div>';

        try {
            const q = query(collection(db, `users/${loggedInUserId}/${collectionName}`), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                listEl.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">No history found.</p>';
                return;
            }

            let html = '';
            historyDataMap.clear();

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const docId = doc.id;
                historyDataMap.set(docId, data);

                const date = new Date(data.timestamp).toLocaleString();
                const textSrc = data.questionText || "No response generated";
                const snippet = textSrc.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...';

                html += `
                    <div class="history-item" data-id="${docId}" style="cursor: pointer; transition: transform 0.2s, background 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.transform='none'; this.style.background='rgba(0,0,0,0.2)';">
                        <img src="${data.image}" alt="Doubt Image">
                        <div class="history-item-content">
                            <span class="history-item-date">${date}</span>
                            <div class="history-item-text">${snippet}</div>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;

            // Attach click listeners to open the doubt
            const historyItems = listEl.querySelectorAll('.history-item');
            historyItems.forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-id');
                    const savedData = historyDataMap.get(id);
                    if (savedData) openDoubt(savedData);
                });
            });
        } catch (error) {
            console.error("Error loading history:", error);
            listEl.innerHTML = '<p style="text-align:center; color: #ef4444; padding: 20px;">Error loading history: ' + error.message + '</p>';
        }
    }

    function openDoubt(data) {
        // Close modal
        historyModal.classList.add('hidden');

        // Load Image
        currentBase64 = data.image;
        imagePreview.src = currentBase64;
        uploadContent.classList.add('hidden');
        previewContainer.classList.remove('hidden');

        // Load Output
        let formattedHTML = data.questionText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p style="margin-top: 10px;">')
            .replace(/\n/g, '<br>');
        outputContent.innerHTML = `<p>${formattedHTML}</p>`;
        outputContainer.classList.remove('hidden');

        // Update Buttons
        solveBtn.disabled = true;

        // Hide feedback section since it's already saved
        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) feedbackSection.style.display = 'none';

        // Scroll to output
        outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
