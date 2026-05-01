import { db } from "/js/auth.js";
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, JPEG).');
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
        const SOLVE_LIMIT = 5;
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

        // Print base64 string to console
        console.log("Image Base64 Data:", currentBase64);

        // UI Loading State
        solveBtn.disabled = true;
        btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing image...';
        btnText.style.opacity = '1';
        loadingSpinner.classList.add('hidden'); // We use text-based spinner now
        outputContainer.classList.add('hidden');

        try {
            // Gemini API Setup
            const GEMINI_API_KEY = '[GCP_API_KEY]';
            const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            // Extract base64 content without the data URL prefix
            const base64Data = currentBase64.split(',')[1];
            const mimeType = currentFile.type;

            const payload = {
                contents: [{
                    parts: [
                        { text: "Solve the question in the image accurately. \n\nRequired Format: \n1. **Question**: [Quote question] \n2. **Solution**: [Detailed step-by-step math] \n3. **Final Answer**: [Highlight final result] \n\nGuidelines: \n- Use plain text (sqrt, ^2, etc.). \n- Be extremely thorough and provide the FULL solution. Do not stop halfway." },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048 // Sufficient for full solutions
                }
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            // Extract text from Gemini response
            let resultText = "Could not generate an answer.";
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
                resultText = data.candidates[0].content.parts[0].text;
            } else {
                throw new Error("No response candidates returned from the API.");
            }

            // Enhanced parser for Bold, Italic, and Newlines
            lastGeneratedText = resultText;
            let formattedHTML = resultText
                .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*\s*(.*?)\s*\*/g, '<em>$1</em>') // Italic
                .replace(/\n\n/g, '</p><p style="margin-top: 10px;">')
                .replace(/\n/g, '<br>');

            outputContent.innerHTML = `<p>${formattedHTML}</p>`;

        } catch (error) {
            console.error("Gemini API Error:", error);
            outputContent.innerHTML = `<div style="color: #ef4444; padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                <p><i class="fa-solid fa-triangle-exclamation"></i> <strong>Error processing image</strong></p>
                <p style="font-size: 13px; margin-top: 8px;">${error.message}</p>
                <p style="font-size: 12px; margin-top: 8px;"><em>Note: Don't forget to replace 'YOUR_API_KEY_HERE' in script.js with a valid Gemini API key.</em></p>
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
            const collectionName = status === 'solved' ? 'solvedDoubts' : 'unsolvedDoubts';
            await addDoc(collection(db, `users/${loggedInUserId}/${collectionName}`), {
                questionText: lastGeneratedText,
                image: currentBase64,
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
