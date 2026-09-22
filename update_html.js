const fs = require('fs');

let html = fs.readFileSync('htmls/doubt/index.html', 'utf8');

// Replace <main class="solver-layout"> ... </main> with new structure
const newMain = `
        <main class="solver-layout">
            <!-- Secondary Column: Context & Actions (Upload, Quiz, Feedback) -->
            <div class="secondary-column">
                <!-- Upload Section -->
                <div class="upload-area" id="uploadArea">
                    <div class="scanner-line"></div>
                    <input type="file" id="fileInput" accept="image/png, image/jpeg, image/jpg" hidden>

                    <div class="upload-content" id="uploadContent">
                        <div class="icon-box">
                            <i class="fa-solid fa-microchip upload-icon"></i>
                        </div>
                        <h3>Initialize <span>Quantum Scan</span></h3>
                        <p>Drag image or click to upload</p>
                        <div class="upload-hint-mobile">
                            <i class="fa-solid fa-arrow-up-from-bracket"></i> Tap to upload
                        </div>
                    </div>

                    <!-- Preview Section -->
                    <div class="preview-container hidden" id="previewContainer">
                        <img id="imagePreview" src="" alt="Uploaded Question">
                        <div class="image-overlay"></div>
                        <button id="removeImageBtn" class="remove-btn" aria-label="Remove image">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <!-- Action Button -->
                <button id="solveBtn" class="solve-btn" disabled>
                    <span class="btn-text">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze Question
                    </span>
                    <div class="spinner hidden" id="loadingSpinner"></div>
                </button>

                <!-- Feedback Section -->
                <div class="feedback-section" id="feedbackSection" style="display:none;">
                    <p>Was this solution helpful?</p>
                    <div class="feedback-buttons">
                        <button id="btnSolved" class="feedback-btn solved-btn">
                            <i class="fa-solid fa-check"></i> Solved
                        </button>
                        <button id="btnUnsolved" class="feedback-btn unsolved-btn">
                            <i class="fa-solid fa-xmark"></i> Unsolved
                        </button>
                    </div>
                    <!-- Create Quiz button — shown after AI answer is ready -->
                    <div class="quiz-action-row">
                        <button id="createQuizBtn" class="create-quiz-btn hidden">
                            <i class="fa-solid fa-clipboard-question"></i>
                            <span id="createQuizBtnText">Create Quiz</span>
                        </button>
                    </div>
                </div>

                <!-- Quiz Panel — rendered inline, shown after quiz generation -->
                <div id="quizPanel" class="quiz-panel hidden">
                    <div class="quiz-panel-header">
                        <h4><i class="fa-solid fa-clipboard-question"></i> <span id="quizPanelTitle">Practice Quiz</span></h4>
                        <button id="closeQuizBtn" class="close-quiz-btn" aria-label="Close quiz"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="quizContent" class="quiz-content">
                        <!-- Questions rendered here by JS -->
                    </div>
                </div>
            </div>

            <!-- Main Column: AI Response & Conversation -->
            <div class="main-column">
                <!-- Output Section -->
                <div class="output-container hidden" id="outputContainer">
                    <div class="output-header">
                        <h3><i class="fa-solid fa-brain"></i> AI Logic Output</h3>
                        <button class="copy-btn" id="copyBtn" title="Copy Solution">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                    <div class="output-content-wrapper">
                        <div class="output-content" id="outputContent">
                            <!-- Solution will be rendered here -->
                        </div>
                    </div>

                    <!-- Follow-up Section -->
                    <div id="followUpSection" class="follow-up-section hidden">
                        <div class="follow-up-header">
                            <h4><i class="fa-solid fa-comments"></i> Follow-up Answer</h4>
                            <button id="closeFollowUp" class="close-follow-up"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div id="followUpContent" class="follow-up-content">
                            <!-- Follow-up responses will appear here -->
                        </div>
                        <div class="follow-up-input-wrapper">
                            <input type="text" id="followUpInput" placeholder="Ask a follow-up question...">
                            <button id="sendFollowUp" class="send-follow-up-btn">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
`;

// Extract before and after <main ...> ... </main>
const startIdx = html.indexOf('<main class="solver-layout">');
const endIdx = html.indexOf('</main>') + 7;

const newFile = html.substring(0, startIdx) + newMain + html.substring(endIdx);
fs.writeFileSync('htmls/doubt/index.html', newFile);
console.log('HTML updated.');
