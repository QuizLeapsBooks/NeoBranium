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

    let isFollowUpLoading = false;

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
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        return '/api';
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
    }

    // --- Solving Action ---
    solveBtn.addEventListener('click', async () => {
        if (!currentFile || !currentBase64) return;

        const SOLVE_LIMIT = 15;
        const RESET_TIME_MS = 24 * 60 * 60 * 1000;

        let solveCount = parseInt(localStorage.getItem('solveCount')) || 0;
        let solveStartTime = parseInt(localStorage.getItem('solveStartTime')) || Date.now();

        if (Date.now() - solveStartTime >= RESET_TIME_MS) {
            solveCount = 0;
            solveStartTime = Date.now();
        }

        if (solveCount >= SOLVE_LIMIT) {
            alert("Daily limit reached");
            return;
        }

        solveCount++;
        localStorage.setItem('solveCount', solveCount.toString());
        localStorage.setItem('solveStartTime', solveStartTime.toString());

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
        const originalSolvedText = btnSolved.innerHTML;
        const originalUnsolvedText = btnUnsolved.innerHTML;

        if (status === 'solved') btnSolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        else btnUnsolved.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            updateStatus('Archiving query to Knowledge Base...', false);
            const storagePath = `users/${loggedInUserId}/doubts/${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);

            const base64Data = currentBase64.split(',')[1];
            await uploadString(storageRef, base64Data, 'base64', {
                contentType: 'image/jpeg'
            });

            const downloadURL = await getDownloadURL(storageRef);

            const collectionName = status === 'solved' ? 'solvedDoubts' : 'unsolvedDoubts';
            await addDoc(collection(db, `users/${loggedInUserId}/${collectionName}`), {
                questionText: lastGeneratedText,
                image: downloadURL,
                timestamp: Date.now()
            });

            btnSolved.innerHTML = 'Archived ✅';
            btnUnsolved.style.display = 'none';
            updateStatus('Query archived successfully.', false);
            if (status === 'unsolved') {
                btnSolved.innerHTML = 'Logged ❌';
                btnSolved.classList.replace('solved-btn', 'unsolved-btn');
            }
        } catch (error) {
            console.error("Error saving doubt:", error);
            btnSolved.innerHTML = 'Save Failed';
            btnSolved.disabled = false;
            btnUnsolved.disabled = false;
            updateStatus('Archive failure.', false);
            alert("Archive Error: " + error.message);
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

                html += `
                    <div class="history-item" data-id="${docId}" style="cursor: pointer;">
                        <img src="${data.image}" alt="Doubt Image">
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

    function openDoubt(data) {
        historyModal.classList.add('hidden');
        currentBase64 = data.image;
        imagePreview.src = currentBase64;
        uploadContent.classList.add('hidden');
        previewContainer.classList.remove('hidden');

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
});
