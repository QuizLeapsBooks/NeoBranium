import { db, auth } from "/js/auth.js";
import DOMPurify from "dompurify";
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// ── IndexedDB helpers for client-side image storage ───────────────────────
// Images are stored locally in the browser and never uploaded to Firebase.
const IDB_NAME = 'neobranium_tutor';
const IDB_STORE = 'session_images';
const IDB_VERSION = 1;

function openImageDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveImageToIDB(key, base64DataUrl) {
    try {
        const idb = await openImageDB();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(base64DataUrl, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.warn('NeoTutor IDB: Could not save image to IndexedDB:', err);
        return false;
    }
}

async function loadImageFromIDB(key) {
    try {
        const idb = await openImageDB();
        return new Promise((resolve) => {
            const tx = idb.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}
// ─────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    let loggedInUserId = null;
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loggedInUserId = user.uid;
        }
    });

    // --- UI Elements ---
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

    const aiStatus = document.getElementById('aiStatus');

    // Follow-up elements
    const floatingAskBtn = document.getElementById('floatingAskBtn');
    const followUpSection = document.getElementById('followUpSection');
    const followUpContent = document.getElementById('followUpContent');
    const followUpInput = document.getElementById('followUpInput');
    const sendFollowUpBtn = document.getElementById('sendFollowUp');
    const closeFollowUpBtn = document.getElementById('closeFollowUp');

    // Quiz elements
    const createQuizBtn = document.getElementById('createQuizBtn');
    const createQuizBtnText = document.getElementById('createQuizBtnText');
    const quizPanel = document.getElementById('quizPanel');
    const quizPanelTitle = document.getElementById('quizPanelTitle');
    const quizContent = document.getElementById('quizContent');
    const closeQuizBtn = document.getElementById('closeQuizBtn');

    let isFollowUpLoading = false;
    let isQuizLoading = false;

    let currentFile = null;
    let currentBase64 = null;
    let lastGeneratedText = "";
    const historyDataMap = new Map();

    // --- Particle Background ---
    const initParticles = () => {
        const canvas = document.getElementById('bg-particles');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const particleCount = Math.floor(window.innerWidth / 15);

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 0.5,
                speedX: Math.random() * 0.4 - 0.2,
                speedY: Math.random() * 0.4 - 0.2
            });
        }

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
                if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 245, 255, 0.15)';
                ctx.fill();

                if (p.radius > 1.5) {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = 'rgba(0, 245, 255, 0.4)';
                } else {
                    ctx.shadowBlur = 0;
                }
            });
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    };
    initParticles();

    // --- Typed.js for AI Status ---
    let typedStatus = null;
    const updateStatus = (text, isLoop = false) => {
        if (typedStatus) typedStatus.destroy();
        typedStatus = new Typed('#aiStatus', {
            strings: [text],
            typeSpeed: 5, // Instant
            showCursor: false,
            loop: isLoop
        });
    };

    updateStatus('Quantum System Online. Waiting for input...', false);

    const getApiBaseUrl = () => {
        // Allow an explicit override via a <meta name="backend-url"> tag
        const metaBackend = document.querySelector('meta[name="backend-url"]');
        if (metaBackend && metaBackend.getAttribute('content')) {
            const val = metaBackend.getAttribute('content');
            return val.endsWith('/') ? `${val}api` : `${val}/api`;
        }
        // In local development (Live Server / localhost) hit the local Express server
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        // Production: always use the hosted backend
        return 'https://neobranium.onrender.com/api';
    };

    const API_BASE_URL = getApiBaseUrl();

    // --- Smooth Reveal Effect ---
    const revealContent = (element, html) => {
        element.classList.remove('reveal-active');
        element.style.opacity = '0';
        element.innerHTML = html;

        setTimeout(() => {
            element.classList.add('reveal-active');
        }, 10);
    };

    // --- File Upload Handling ---
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== removeImageBtn && !removeImageBtn.contains(e.target)) {
            fileInput.click();
        }
    });

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

        if (!ALLOWED_TYPES.includes(file.type)) {
            alert('Invalid file format. Please upload a PNG or JPEG image.');
            return;
        }

        if (file.size > MAX_SIZE) {
            alert('File is too large. Maximum allowed size is 5MB.');
            return;
        }

        currentFile = file;
        updateStatus('Analyzing image metadata...', false);

        const reader = new FileReader();
        reader.onload = (e) => {
            currentBase64 = e.target.result;
            imagePreview.src = currentBase64;
            uploadContent.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            solveBtn.disabled = false;
            updateStatus('Target acquired. Ready to analyze.', false);
        };

        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };

        reader.readAsDataURL(file);
    }

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
        uploadArea.classList.remove('processing');
        updateStatus('System Reset. Waiting for input...', false);

        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) feedbackSection.style.display = 'block';

        // Reset quiz state on upload reset
        if (createQuizBtn) createQuizBtn.classList.add('hidden');
        if (quizPanel) quizPanel.classList.add('hidden');
        if (quizContent) quizContent.innerHTML = '';
        isQuizLoading = false;
    }


    // --- Solving Action ---
    solveBtn.addEventListener('click', async () => {
        if (!currentFile || !currentBase64) return;

        // Limits are now handled server-side via Firebase/middleware

        // UI Loading State
        solveBtn.disabled = true;
        uploadArea.classList.add('processing');
        btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        updateStatus('Consulting NeoTutor AI Neural Network...', true);
        outputContainer.classList.add('hidden');

        try {
            const base64Data = currentBase64.split(',')[1];
            const mimeType = currentFile.type;

            const response = await fetch(`${API_BASE_URL}/gemini-solve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    base64: base64Data,
                    mimeType: mimeType
                })
            });

            const contentType = response.headers.get("content-type");
            if (!response.ok) {
                let errorMsg = `Server Error: ${response.status}`;
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } else if (contentType && contentType.includes("text/html")) {
                    errorMsg = "API route not found (returned HTML). Check your hosting configuration.";
                }
                throw new Error(errorMsg);
            }

            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Invalid response from server (expected JSON). Check your hosting/API configuration.");
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to solve image");
            }

            const resultText = data.result;
            lastGeneratedText = resultText;
            updateStatus('Solution synthesized. Rendering output...', false);

            const rawHTML = resultText
                .replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong>$1</strong>')
                .replace(/\*\s*(.*?)\s*\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '</p><p style="margin-top: 10px;">')
                .replace(/\n/g, '<br>');

            const cleanHTML = DOMPurify.sanitize(`<p>${rawHTML}</p>`, {
                ALLOWED_TAGS: ['p', 'strong', 'em', 'br', 'span', 'i', 'ul', 'li', 'ol'],
                ALLOWED_ATTR: ['style']
            });

            revealContent(outputContent, cleanHTML);

        } catch (error) {
            console.error("NeoTutor Solve Error:", error);
            updateStatus('System Error detected.', false);
            outputContent.innerHTML = `<div style="color: #ff4d4d; padding: 20px; background: rgba(255, 77, 77, 0.1); border-radius: 12px; border: 1px solid rgba(255, 77, 77, 0.3);">
                <p><i class="fa-solid fa-triangle-exclamation"></i> <strong>Critical Analysis Failure</strong></p>
                <p style="font-size: 13px; margin-top: 10px;">${error.message}</p>
            </div>`;
        } finally {
            solveBtn.disabled = false;
            uploadArea.classList.remove('processing');
            btnText.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyze Question';
            outputContainer.classList.remove('hidden');

            const btnSolved = document.getElementById('btnSolved');
            const btnUnsolved = document.getElementById('btnUnsolved');
            if (btnSolved && btnUnsolved) {
                btnSolved.disabled = false;
                btnUnsolved.disabled = false;
                btnUnsolved.style.display = 'inline-flex';
                btnSolved.innerHTML = '<i class="fa-solid fa-check"></i> Solved';
                btnSolved.className = 'feedback-btn solved-btn';
            }

            // Show the Create Quiz button now that we have a fresh AI answer
            if (createQuizBtn) {
                createQuizBtn.classList.remove('hidden');
                createQuizBtnText.textContent = 'Create Quiz';
                createQuizBtn.disabled = false;
            }
            // Hide any previously shown quiz panel on a new solve
            if (quizPanel) quizPanel.classList.add('hidden');
            if (quizContent) quizContent.innerHTML = '';

            outputContainer.classList.remove('hidden');
            followUpSection.classList.remove('hidden');
            outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

    });

    // --- Copy functionality ---
    copyBtn.addEventListener('click', () => {
        const textToCopy = outputContent.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #00ff9d;"></i>';
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

        if (status === 'solved') btnSolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        else btnUnsolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        // Generate a unique key to link this session's image in IndexedDB
        const sessionKey = `doubt_${loggedInUserId}_${Date.now()}`;

        try {
            updateStatus('Archiving query to Knowledge Base...', false);

            // ── Step 1: Save image locally to IndexedDB (best-effort, non-blocking) ──
            // This never contacts Firebase. If it fails, the text save still proceeds.
            const imageSaved = await saveImageToIDB(sessionKey, currentBase64);
            if (!imageSaved) {
                console.warn('NeoTutor: Image could not be saved to IndexedDB. Text session will still be archived.');
            }

            // ── Step 2: Save only text/structured data to Firestore (no image, no Storage URL) ──
            const collectionName = status === 'solved' ? 'solvedDoubts' : 'unsolvedDoubts';
            await addDoc(collection(db, `users/${loggedInUserId}/${collectionName}`), {
                questionText: lastGeneratedText,
                sessionKey: sessionKey,  // Used to retrieve image from IndexedDB later
                timestamp: Date.now()
                // NOTE: No 'image' field — images are stored client-side only
            });

            // ── Step 3: Update UI on success ──
            btnUnsolved.style.display = 'none';
            if (status === 'solved') {
                btnSolved.innerHTML = 'Archived ✅';
            } else {
                btnSolved.innerHTML = 'Logged ❌';
                btnSolved.classList.replace('solved-btn', 'unsolved-btn');
            }
            updateStatus('Query archived successfully.', false);

        } catch (error) {
            // Firestore save failed — re-enable buttons so user can retry
            console.error("Error saving doubt:", error);
            btnSolved.innerHTML = status === 'solved'
                ? '<i class="fa-solid fa-check"></i> Retry Save'
                : '<i class="fa-solid fa-xmark"></i> Retry';
            btnSolved.disabled = false;
            btnUnsolved.disabled = false;
            updateStatus('Archive failure. Session data preserved.', false);
            alert("Could not save session: " + error.message + "\n\nYour AI answer is still available in the current session.");
        }
    }

    if (btnSolved) btnSolved.addEventListener('click', () => saveDoubt('solved'));
    if (btnUnsolved) btnUnsolved.addEventListener('click', () => saveDoubt('unsolved'));

    // Modal Toggles
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            historyModal.classList.remove('hidden');
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

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(target);
            targetContent.classList.remove('hidden');

            const collectionName = target === 'solved-tab' ? 'solvedDoubts' : 'unsolvedDoubts';
            const listId = target === 'solved-tab' ? 'solvedList' : 'unsolvedList';
            loadHistory(collectionName, listId);
        });
    });

    async function loadHistory(collectionName, listElementId) {
        const listEl = document.getElementById(listElementId);
        if (!listEl) return;

        listEl.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-microchip fa-spin" style="font-size: 32px; color: var(--primary);"></i><p style="margin-top:15px; color: var(--text-dim);">Retrieving Records...</p></div>';

        try {
            const q = query(collection(db, `users/${loggedInUserId}/${collectionName}`), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                listEl.innerHTML = '<p style="text-align:center; color: var(--text-dim); padding: 40px;">No records found in Knowledge Base.</p>';
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
                const snippet = textSrc.replace(/<[^>]*>?/gm, '').substring(0, 120) + '...';

                // Image preview: use a neutral icon placeholder instead of a remote URL.
                // The actual image (if saved) is retrieved from IndexedDB when the item is opened.
                html += `
                    <div class="history-item" data-id="${docId}" style="cursor: pointer;">
                        <div class="history-item-icon" style="
                            display:flex; align-items:center; justify-content:center;
                            width:60px; height:60px; flex-shrink:0;
                            background:rgba(0,245,255,0.07); border-radius:10px;
                            border:1px solid rgba(0,245,255,0.15); font-size:22px;
                            color:var(--primary);">
                            <i class="fa-solid fa-image"></i>
                        </div>
                        <div class="history-item-content">
                            <span class="history-item-date">${date}</span>
                            <div class="history-item-text">${snippet}</div>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;

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
            listEl.innerHTML = '<p style="text-align:center; color: var(--error); padding: 40px;">Connection Failure: ' + error.message + '</p>';
        }
    }

    async function openDoubt(data) {
        historyModal.classList.add('hidden');

        // ── Restore image from IndexedDB or fall back to old Firebase Storage URL ──
        // New sessions: use sessionKey to load from IndexedDB (client-side only)
        // Old sessions: try data.image (legacy Storage URL) for backward compatibility
        // If neither is available: open session with text only — do not fail
        let restoredImage = null;

        if (data.sessionKey) {
            restoredImage = await loadImageFromIDB(data.sessionKey);
        }

        // Backward compat: old records saved a Firebase Storage URL in data.image
        if (!restoredImage && data.image) {
            restoredImage = data.image;
        }

        if (restoredImage) {
            currentBase64 = restoredImage;
            imagePreview.src = restoredImage;
            uploadContent.classList.add('hidden');
            previewContainer.classList.remove('hidden');
        } else {
            // Image not available locally — show upload area with a non-blocking notice
            currentBase64 = null;
            imagePreview.src = '';
            previewContainer.classList.add('hidden');
            uploadContent.classList.remove('hidden');
            // Replace upload area content with an "image unavailable" notice temporarily
            const uploadAreaNotice = document.getElementById('uploadArea');
            if (uploadAreaNotice) {
                uploadAreaNotice.style.borderColor = 'rgba(0,245,255,0.2)';
            }
            // Small non-blocking info notice inside the upload content area
            const uploadContentEl = document.getElementById('uploadContent');
            if (uploadContentEl) {
                uploadContentEl.innerHTML = `
                    <div style="text-align:center; padding:20px; color:var(--text-dim);">
                        <i class="fa-solid fa-image" style="font-size:28px; opacity:0.4;"></i>
                        <p style="margin-top:10px; font-size:0.85rem; opacity:0.7;">
                            Image not available locally.<br>The AI answer is shown below.
                        </p>
                    </div>`;
            }
        }

        // ── Always render the AI answer text ──
        let formattedHTML = data.questionText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p style="margin-top: 10px;">')
            .replace(/\n/g, '<br>');
        outputContent.innerHTML = `<p>${formattedHTML}</p>`;
        outputContainer.classList.remove('hidden');

        solveBtn.disabled = true;
        updateStatus('Historical Record Loaded.', false);

        const feedbackSection = document.getElementById('feedbackSection');
        if (feedbackSection) feedbackSection.style.display = 'none';

        outputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // --- Follow-up Feature Logic ---

    // 1. Text Selection Logic - Improved
    document.addEventListener('mouseup', (e) => {
        // Ignore clicks on the button itself and follow-up section
        if (floatingAskBtn.contains(e.target) || followUpSection.contains(e.target)) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Check if selection is in output content
        if (selectedText && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const commonAncestor = range.commonAncestorContainer;
            
            // More reliable check: see if the selected range is inside outputContent
            const isInOutputContent = outputContent.contains(commonAncestor) || 
                                     outputContent.contains(range.startContainer) ||
                                     outputContent.contains(range.endContainer);
            
            if (isInOutputContent) {
                const rect = range.getBoundingClientRect();
                
                // Position the button above the selection, centered
                floatingAskBtn.style.position = 'fixed';
                floatingAskBtn.style.top = `${rect.top + window.scrollY - 50}px`;
                floatingAskBtn.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 55}px`;
                floatingAskBtn.classList.remove('hidden');
                
                // Ensure button stays visible
                floatingAskBtn.style.zIndex = '2000';
            } else {
                floatingAskBtn.classList.add('hidden');
            }
        } else {
            floatingAskBtn.classList.add('hidden');
        }
    });

    // Also hide the button when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.output-content') && !floatingAskBtn.contains(e.target)) {
            floatingAskBtn.classList.add('hidden');
        }
    });

    // 2. Floating Button Click Handler
    floatingAskBtn.addEventListener('click', () => {
        const selectedText = window.getSelection().toString().trim();
        if (!selectedText) return;

        floatingAskBtn.classList.add('hidden');
        handleFollowUp(selectedText);
    });

    // 3. Custom Input Handler
    const submitCustomDoubt = () => {
        const query = followUpInput.value.trim();
        if (!query || isFollowUpLoading) return;

        followUpInput.value = '';
        handleFollowUp(query);
    };

    sendFollowUpBtn.addEventListener('click', submitCustomDoubt);
    followUpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitCustomDoubt();
    });

    // 4. Follow-up API Interaction
    async function handleFollowUp(userDoubt) {
        if (isFollowUpLoading) return;

        followUpSection.classList.remove('hidden');
        followUpSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const userMsgDiv = document.createElement('div');
        userMsgDiv.style.marginBottom = '15px';
        userMsgDiv.innerHTML = `<strong style="color:var(--primary)">Q:</strong> ${userDoubt}`;
        followUpContent.appendChild(userMsgDiv);

        isFollowUpLoading = true;
        sendFollowUpBtn.disabled = true;
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-typing';
        loadingDiv.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
        followUpContent.appendChild(loadingDiv);

        followUpContent.scrollTop = followUpContent.scrollHeight;

        try {
            const fullSolution = outputContent.innerText;
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: `
                    Original Solution:
                    ${fullSolution}

                    User doubt:
                    ${userDoubt}

                    Explain in simple steps for a student.
                    `
                })
            });

            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            loadingDiv.remove();

            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.style.padding = '12px';
            aiMsgDiv.style.background = 'rgba(0, 245, 255, 0.05)';
            aiMsgDiv.style.borderLeft = '3px solid var(--primary)';
            aiMsgDiv.style.borderRadius = '0 8px 8px 0';
            aiMsgDiv.style.marginBottom = '20px';

            const formattedResult = data.reply
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            revealContent(aiMsgDiv, formattedResult);
            followUpContent.appendChild(aiMsgDiv);

        } catch (error) {
            console.error('Follow-up Error:', error);
            loadingDiv.innerHTML = '<span style="color:var(--error)">Failed to get response. Please try again.</span>';
        } finally {
            isFollowUpLoading = false;
            sendFollowUpBtn.disabled = false;
            followUpContent.scrollTop = followUpContent.scrollHeight;
        }
    }

    closeFollowUpBtn.addEventListener('click', () => {
        followUpSection.classList.add('hidden');
        followUpContent.innerHTML = '';
    });

    // ── ── ── ── ── ── ── ── ── ── ── ── ── ──
    // Quiz Feature
    // ── ── ── ── ── ── ── ── ── ── ── ── ── ──

    // Create Quiz button handler
    createQuizBtn.addEventListener('click', async () => {
        // Guards: must have image + solution, and no concurrent request
        if (!currentBase64 || !lastGeneratedText || isQuizLoading) return;

        isQuizLoading = true;
        createQuizBtn.disabled = true;
        createQuizBtnText.textContent = 'Creating your quiz…';

        // Show quiz panel with loading state
        quizPanel.classList.remove('hidden');
        quizContent.innerHTML = `
            <div class="quiz-loading">
                <div class="ai-typing" style="justify-content:center; padding: 30px 0;">
                    <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
                </div>
                <p style="text-align:center; color:var(--text-dim); font-size:0.9rem;">Generating quiz from your question…</p>
            </div>`;
        quizPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        try {
            // Extract base64 without data URI prefix
            const base64Data = currentBase64.startsWith('data:')
                ? currentBase64.split(',')[1]
                : currentBase64;

            const mimeType = currentFile ? currentFile.type : 'image/jpeg';

            const response = await fetch(`${API_BASE_URL}/tutor/create-quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    base64: base64Data,
                    mimeType: mimeType,
                    aiSolution: lastGeneratedText
                })
            });

            // Parse error details if possible
            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                let errMsg = `Server error (${response.status})`;
                if (contentType && contentType.includes('application/json')) {
                    const errData = await response.json();
                    errMsg = errData.error || errMsg;
                }
                throw new Error(errMsg);
            }

            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Unexpected response from server.');
            }

            const data = await response.json();
            if (!data.success || !data.quiz) {
                throw new Error(data.error || 'Quiz generation failed.');
            }

            renderQuiz(data.quiz);

        } catch (error) {
            console.error('Quiz Generation Error:', error);
            quizContent.innerHTML = `
                <div style="padding:20px; color:var(--error); background:rgba(239,68,68,0.08);
                     border-radius:10px; border:1px solid rgba(239,68,68,0.25); margin:15px;">
                    <p><i class="fa-solid fa-triangle-exclamation"></i>
                       <strong> Quiz Generation Failed</strong></p>
                    <p style="font-size:0.88rem; margin-top:8px;">${error.message}</p>
                    <button class="quiz-retry-btn" onclick="document.getElementById('createQuizBtn').click()">
                        <i class="fa-solid fa-rotate-right"></i> Try Again
                    </button>
                </div>`;
        } finally {
            isQuizLoading = false;
            createQuizBtn.disabled = false;
            createQuizBtnText.textContent = 'Create Quiz';
        }
    });

    // Close quiz panel
    closeQuizBtn.addEventListener('click', () => {
        quizPanel.classList.add('hidden');
        quizContent.innerHTML = '';
    });

    // Render quiz questions
    function renderQuiz(quiz) {
        if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
            quizContent.innerHTML = `<p style="padding:20px;color:var(--error);">No questions were generated. Please try again.</p>`;
            return;
        }

        // Update panel title
        quizPanelTitle.textContent = quiz.title || 'Practice Quiz';

        const optionLetters = ['A', 'B', 'C', 'D'];
        let html = '';

        if (quiz.topic) {
            html += `<p class="quiz-topic-label"><i class="fa-solid fa-tag"></i> ${quiz.topic}</p>`;
        }

        quiz.questions.forEach((q, qIdx) => {
            const questionId = `quiz-q${qIdx}`;
            html += `
                <div class="quiz-question" data-qidx="${qIdx}" data-correct="${q.correctAnswer}">
                    <p class="quiz-question-text">
                        <span class="quiz-question-num">Q${qIdx + 1}.</span> ${q.question}
                    </p>
                    <div class="quiz-options" role="radiogroup">`;

            (q.options || []).forEach((opt, oIdx) => {
                html += `
                        <label class="quiz-option" data-oidx="${oIdx}">
                            <input type="radio" name="${questionId}" value="${oIdx}" style="display:none;">
                            <span class="quiz-option-letter">${optionLetters[oIdx] || oIdx}</span>
                            <span class="quiz-option-text">${opt}</span>
                        </label>`;
            });

            html += `
                    </div>
                    <div class="quiz-explanation hidden" id="exp-${qIdx}">
                        <i class="fa-solid fa-circle-info"></i> ${q.explanation || ''}
                    </div>
                </div>`;
        });

        html += `
            <div class="quiz-check-row">
                <button class="quiz-check-btn" id="checkAnswersBtn">
                    <i class="fa-solid fa-check-double"></i> Check Answers
                </button>
            </div>`;

        quizContent.innerHTML = html;

        // Option selection (visual toggle)
        quizContent.querySelectorAll('.quiz-question').forEach(questionEl => {
            questionEl.querySelectorAll('.quiz-option').forEach(optLabel => {
                optLabel.addEventListener('click', () => {
                    // Deselect siblings
                    questionEl.querySelectorAll('.quiz-option').forEach(l => l.classList.remove('selected'));
                    optLabel.classList.add('selected');
                    const radio = optLabel.querySelector('input[type="radio"]');
                    if (radio) radio.checked = true;
                });
            });
        });

        // Check Answers button
        const checkBtn = quizContent.querySelector('#checkAnswersBtn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => {
                checkBtn.disabled = true;
                checkBtn.innerHTML = '<i class="fa-solid fa-check"></i> Answers Checked';

                let correctCount = 0;
                let incorrectIndices = [];

                quizContent.querySelectorAll('.quiz-question').forEach(questionEl => {
                    const correctIdx = parseInt(questionEl.dataset.correct, 10);
                    const qIdx = parseInt(questionEl.dataset.qidx, 10);
                    const options = questionEl.querySelectorAll('.quiz-option');
                    let selectedIdx = -1;

                    options.forEach((opt, idx) => {
                        const radio = opt.querySelector('input[type="radio"]');
                        if (radio && radio.checked) selectedIdx = idx;
                    });

                    if (selectedIdx === correctIdx) {
                        correctCount++;
                    } else {
                        incorrectIndices.push(qIdx);
                    }

                    options.forEach((opt, idx) => {
                        opt.style.pointerEvents = 'none'; // lock selection
                        if (idx === correctIdx) {
                            opt.classList.add('correct');
                        } else if (idx === selectedIdx && idx !== correctIdx) {
                            opt.classList.add('wrong');
                        }
                    });

                    // Show explanation
                    const expEl = quizContent.querySelector(`#exp-${qIdx}`);
                    if (expEl) expEl.classList.remove('hidden');
                });

                // --- Display Result Summary ---
                const totalQs = quiz.questions.length;
                const resultSummary = document.createElement('div');
                resultSummary.className = 'quiz-result-summary';
                resultSummary.innerHTML = `
                    <div class="quiz-score-header">
                        <h3>Score: ${correctCount}/${totalQs}</h3>
                        <p>Correct: ${correctCount} | Incorrect: ${totalQs - correctCount}</p>
                    </div>
                    <div class="quiz-result-actions">
                        <button class="quiz-action-btn secondary-btn" id="reviewAnswersBtn">
                            <i class="fa-solid fa-magnifying-glass"></i> Review Answers
                        </button>
                        <button class="quiz-action-btn primary-btn" id="practiceSimilarBtn">
                            <i class="fa-solid fa-bolt"></i> Practice Similar Questions
                        </button>
                    </div>
                `;
                
                // Hide check button row, replace with summary
                const checkRow = checkBtn.closest('.quiz-check-row');
                if (checkRow) {
                    checkRow.style.display = 'none';
                    checkRow.parentNode.insertBefore(resultSummary, checkRow.nextSibling);
                }

                // Scroll to summary
                resultSummary.scrollIntoView({ behavior: 'smooth', block: 'end' });

                // Review answers btn
                const reviewBtn = resultSummary.querySelector('#reviewAnswersBtn');
                reviewBtn.addEventListener('click', () => {
                    quizContent.scrollTo({ top: 0, behavior: 'smooth' });
                });

                // Practice Similar btn
                const practiceBtn = resultSummary.querySelector('#practiceSimilarBtn');
                practiceBtn.addEventListener('click', async () => {
                    if (isQuizLoading) return;
                    isQuizLoading = true;
                    practiceBtn.disabled = true;
                    practiceBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing mistakes...';

                    practiceBtn.scrollIntoView({ behavior: 'smooth', block: 'end' });

                    try {
                        const base64Data = currentBase64 && currentBase64.startsWith('data:')
                            ? currentBase64.split(',')[1]
                            : currentBase64;
                        const mimeType = currentFile ? currentFile.type : 'image/jpeg';

                        const response = await fetch(`${getApiBaseUrl()}/tutor/practice-similar`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                base64: base64Data,
                                mimeType: mimeType,
                                aiSolution: lastGeneratedText,
                                previousQuiz: quiz,
                                incorrectIndices: incorrectIndices
                            })
                        });

                        const contentType = response.headers.get('content-type');
                        if (!response.ok) {
                            let errMsg = `Server error (${response.status})`;
                            if (contentType && contentType.includes('application/json')) {
                                const errData = await response.json();
                                errMsg = errData.error || errMsg;
                            }
                            throw new Error(errMsg);
                        }

                        if (!contentType || !contentType.includes('application/json')) {
                            throw new Error('Unexpected response from server.');
                        }

                        const data = await response.json();
                        if (!data.success || !data.quiz) {
                            throw new Error(data.error || 'Practice quiz generation failed.');
                        }

                        // Render the NEW quiz in the existing panel
                        renderQuiz(data.quiz);
                        
                    } catch (error) {
                        console.error('Practice Generation Error:', error);
                        alert('Failed to generate practice quiz: ' + error.message);
                        practiceBtn.disabled = false;
                        practiceBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Practice Similar Questions';
                    } finally {
                        isQuizLoading = false;
                    }
                });
            });
        }
    }

});
