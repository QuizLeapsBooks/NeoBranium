import { canGeneratePaper, incrementPaperCount } from '../../js/usage-limits.js';

const form = document.getElementById('paperForm');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('resultArea');
const resultText = document.getElementById('generated-paper');
const copyBtn = document.getElementById('copyBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

const setLoading = (isBusy) => {
  loading.hidden = !isBusy;
  resultArea.hidden = isBusy;
  generateBtn.disabled = isBusy;
  generateBtn.innerHTML = isBusy ? '<div class="loading-spinner" style="width: 1rem; height: 1rem; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 0.5rem;"></div> Generating...' : '<span class="btn-icon">🚀</span> Generate Paper';
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Check paper generation limit
  if (!canGeneratePaper()) {
    return;
  }

  setLoading(true);

  const classValue = document.getElementById('classSelect').value;
  const subject = document.getElementById('subjectInput').value.trim();
  const chapter = document.getElementById('chapterInput').value.trim();
  const examType = document.getElementById('examType').value;
  const difficulty = document.getElementById('difficultyLevel').value;
  const totalMarks = document.getElementById('totalMarks').value;
  const examTime = document.getElementById('examTime').value;
  const mcqCount = Number(document.getElementById('mcqCount').value);
  const shortCount = Number(document.getElementById('shortCount').value);
  const longCount = Number(document.getElementById('longCount').value);
  const marksPerQuestion = Number(document.getElementById('marksPerQuestion').value);
  const includeRepeated = document.getElementById('includeRepeated').checked;
  const includeNCERT = document.getElementById('includeNCERT').checked;
  const includeNumericals = document.getElementById('includeNumericals').checked;
  const includeCaseStudy = document.getElementById('includeCaseStudy').checked;

  let includeText = '';
  if (includeRepeated) includeText += '- Most repeated questions\n';
  if (includeNCERT) includeText += '- NCERT based questions\n';
  if (includeNumericals) includeText += '- Numericals\n';
  if (includeCaseStudy) includeText += '- Case Study\n';
  if (!includeText) includeText = '- None';

  const aiPrompt = `You are a professional Indian exam paper setter AI.

Task:
Generate a **full exam paper** strictly following these instructions:

Input:
- Class: ${classValue}
- Subject: ${subject}
- Chapter: ${chapter}
- Exam Type: ${examType}
- Difficulty Level: ${difficulty}
- Total Marks: ${totalMarks}
- Time Allowed: ${examTime} minutes
- Number of questions: MCQ: ${mcqCount}, Short Answer: ${shortCount}, Long Answer: ${longCount}
- Marks per question: ${marksPerQuestion}
- Extra options: ${includeText}

Requirements:
1. Structure:
   ## Section A – MCQ
   ## Section B – Short Answer
   ## Section C – Long Answer
   ## Answer Key
2. MCQs must have **4 options**, labeled \`A)\`, \`B)\`, \`C)\`, \`D)\`.
3. Math formulas must use **LaTeX**, wrapped in \`$\` for inline, \`$$\` for display math.
4. Include **Answer Key** at the end for all questions.
5. Follow numbering for questions strictly (1., 2., 3., ...).
6. Ensure **all sections are complete**, no partial answers.
7. Include introduction or instructions paragraph.
8. Avoid cutting off text; return the **entire paper in one go**.
9. Use markdown headings (\`##\`) and proper paragraphs for each section.
- Do NOT include basic or trivial questions like simple linear equations (x+2=7)
- Questions must be at CBSE Board / Olympiad level
- Include HOTS (Higher Order Thinking Skills)
- Avoid direct formula-based questions
- Include multi-step problems
- Ensure all MCQs are meaningful and not obvious
- Include at least 2 case-study based questions
- Ensure no repetition of concepts
- Questions should require thinking, not direct substitution

Extra Instructions for Rendering:
- For MCQs, use \`- A) option\`, \`- B) option\`, \`- C) option\`, \`- D) option\`.
- Ensure LaTeX expressions are **correct and renderable** by KaTeX.
- Do not output incomplete sections, partial questions, or missing answer key.

Example format:
## Section A – MCQ
1. What is $a^2 + b^2$?
- A) $a^2 + b^2$
- B) $a^2 - b^2$
- C) $2ab$
- D) $a + b$
2. ...

## Section B – Short Answer
1. Calculate the area of a triangle with base $b$ and height $h$.

## Section C – Long Answer
1. Solve the following problem step by step: ...

## Answer Key
Section A: 1. A, 2. B, ...
Section B: 1. Answer in 1–2 sentences
Section C: 1. Full solution with steps

Behavior:
- Act like a **professional, precise, Indian school exam paper setter**.
- Make the output **fully compatible with KaTeX rendering**.
- Return the **full paper in markdown** without truncation.
SYLLABUS STRICT MODE(VERY IMPORTANT):

You MUST strictly follow NCERT syllabus boundaries.

1. Only generate questions from:
  - Selected Class: ${classValue}
  - Selected Subject: ${subject}
  - Selected Chapter: ${chapter}

  2. If "Full Syllabus" is selected:
  - ONLY include chapters from that class (NCERT)
    - DO NOT include topics from lower or higher classes

  3. STRICTLY FORBIDDEN:
   ❌ No Class 8 or 9 concepts(if Class 10 selected)
   ❌ No Class 11 or 12 concepts
   ❌ No out - of - syllabus or advanced topics

4. Before generating questions:
- Internally identify the NCERT chapter topics
  - Stick ONLY to those topics

5. Each question MUST belong clearly to a known NCERT topic.

6. If any question is outside syllabus → REMOVE and REPLACE it.

7. Do NOT assume extra knowledge beyond NCERT level.

8. If chapter name is unclear:
- First interpret it using NCERT standard chapter names
- Then generate questions

FINAL RULE:
Act like a CBSE examiner who strictly follows NCERT syllabus.`;


  try {
    // Generate paper with retry logic to ensure completeness
    const reply = await generatePaperWithRetry(aiPrompt);

    // Format the reply to look like an exam paper
    const formattedReply = formatExamPaper(reply);
    resultText.innerHTML = formattedReply;

    // Increment paper generation count
    incrementPaperCount();

    // Render mathematical expressions with KaTeX (only in the result container)
    const container = document.getElementById("generated-paper");
    try {
      if (window.renderMathInElement) {
        renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false
        });
      } else {
        console.warn('KaTeX auto-render not loaded, math expressions will not be rendered');
      }
    } catch (mathError) {
      console.error('Math rendering failed:', mathError);
      // Don't show error to user - math rendering failure shouldn't prevent paper display
    }

    resultArea.hidden = false;
  } catch (err) {
    resultText.innerHTML = `<div style="color: var(--error-color); padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 1rem 0;">Unable to generate paper. Please check if the NeoBranium AI server is running. (${err.message})</div>`;
    resultArea.hidden = false;
  } finally {
    setLoading(false);
  }
});

// Function to validate if AI response contains complete exam paper
function validateExamPaperResponse(text) {
  const lowerText = text.toLowerCase();

  // Check for required sections
  const hasSectionA = lowerText.includes('section a') || lowerText.includes('multiple choice');
  const hasSectionB = lowerText.includes('section b') || lowerText.includes('short answer');
  const hasSectionC = lowerText.includes('section c') || lowerText.includes('long answer');
  const hasAnswerKey = lowerText.includes('answer key') || lowerText.includes('solution');

  // Check for minimum content length (should be substantial)
  const hasMinimumLength = text.length > 500;

  // Check for numbered questions
  const hasNumberedQuestions = /\d+\.\s/.test(text);

  return {
    isComplete: hasSectionA && hasSectionB && hasSectionC && hasAnswerKey && hasMinimumLength && hasNumberedQuestions,
    missing: {
      sectionA: !hasSectionA,
      sectionB: !hasSectionB,
      sectionC: !hasSectionC,
      answerKey: !hasAnswerKey,
      minimumLength: !hasMinimumLength,
      numberedQuestions: !hasNumberedQuestions
    }
  };
}

// Function to generate paper with retry logic
async function generatePaperWithRetry(aiPrompt, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Safe Network Fetch
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocalhost ? 'http://localhost:3000/api/chat' : 'https://neobranium.onrender.com/api/chat';


      if (!apiUrl || typeof apiUrl !== 'string') {
        throw new Error('Invalid API URL configuration.');
      }

      console.log(`[Attempt ${attempt}] Sending request to:`, apiUrl);

      // No longer sending API key from client as the backend uses its own environment variable
      const headers = {
        'Content-Type': 'application/json'
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: aiPrompt,
          history: [],
          task: 'paper_generation'
        })
      });

      // 4. Robust Response Handling & JSON Parsing
      if (!response.ok) {
        if (attempt === maxRetries) {
          let errorMsg = `Server returned status ${response.status}.`;
          try {
            // Safely parse JSON error, this might fail if the server returns HTML (e.g. 502 Bad Gateway)
            const errorData = await response.json();
            if (errorData.reply) {
              errorMsg = errorData.reply;
            } else if (errorData.error) {
              errorMsg = errorData.error;
            }
          } catch (jsonErr) {
            console.warn("Failed to parse JSON error response, using text fallback");
            const textFallback = await response.text();
            if (textFallback) errorMsg += ` ${textFallback.substring(0, 100)}...`;
          }
          throw new Error(errorMsg);
        }

        console.warn(`[Attempt ${attempt}] HTTP Error ${response.status}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue; // Retry
      }

      // 5. Safe Success Payload Parsing
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('Server returned an invalid or malformed JSON response.');
      }

      let reply = data.reply || '';
      if (!reply) {
        if (attempt === maxRetries) throw new Error('No response returned from AI.');
        console.warn(`[Attempt ${attempt}] Empty reply geometry. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      reply = reply.replace(/```/g, '').trim();

      // 6. Validate response completeness
      const validation = validateExamPaperResponse(reply);

      if (validation.isComplete) {
        console.log(`[Attempt ${attempt}] Success! Generated a valid exam paper.`);
        return reply;
      } else {
        console.warn(`[Attempt ${attempt}]: Incomplete response. Missing:`, validation.missing);
        if (attempt === maxRetries) {
          throw new Error('Unable to generate complete exam paper after multiple attempts. The AI response was consistently incomplete.');
        }
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed with exception:`, error.message);
      if (attempt === maxRetries) {
        if (attempt === maxRetries) {
          throw new Error(error.message || 'A network or connectivity error occurred.');
        }
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

// Format the AI response to look like a proper exam paper
function formatExamPaper(text) {
  // Get metadata from form to ensure accuracy in header
  const classValue = document.getElementById('classSelect').value;
  const subject = document.getElementById('subjectInput').value.trim();
  const totalMarks = document.getElementById('totalMarks').value;
  const examTime = document.getElementById('examTime').value;

  const lines = text.split('\n');
  let html = '';
  let inMcqSection = false;
  let inShortAnswerSection = false;
  let inLongAnswerSection = false;
  let inAnswerKey = false;
  let currentSectionDivOpen = false;

  // 1. Generate Premium Header
  html += `<div class="exam-header-premium">
    <h1>${subject} Examination</h1>
    <div class="exam-meta-premium">
      <div class="exam-meta-item">
        <strong>Class:</strong> ${classValue}
      </div>
      <div class="exam-meta-item">
        <strong>Time:</strong> ${examTime} Mins
      </div>
      <div class="exam-meta-item">
        <strong>Marks:</strong> ${totalMarks}
      </div>
    </div>
  </div>`;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Skip top-level markdown headers as we handled it with premium header
    if (line.startsWith('# ') && !line.startsWith('## ')) continue;

    // Handle Section Titles
    if (line.startsWith('## ')) {
      const sectionTitle = line.substring(3).trim();

      // Close previous section container if open
      if (currentSectionDivOpen) {
        html += '</div>';
      }

      const isAnswerKey = /answer key|solution/i.test(sectionTitle);

      if (isAnswerKey) {
        html += `<div class="answer-key-section">
          <h2 class="section-title-modern">🔑 Answer Key</h2>
          <div class="answer-grid">`;
        inMcqSection = false;
        inShortAnswerSection = false;
        inLongAnswerSection = false;
        inAnswerKey = true;
      } else {
        html += `<div class="section-container">
          <h2 class="section-title-modern">${sectionTitle}</h2>`;

        inMcqSection = /section a.*mcq|multiple choice/i.test(sectionTitle.toLowerCase());
        inShortAnswerSection = /section b.*short answer/i.test(sectionTitle.toLowerCase());
        inLongAnswerSection = /section c.*long answer/i.test(sectionTitle.toLowerCase());
        inAnswerKey = false;
      }

      currentSectionDivOpen = true;
      continue;
    }

    // Handle General Instructions
    if (line.toLowerCase().includes('instruction')) {
      html += `<div class="section-instruction-modern">${line}</div>`;
      continue;
    }

    // Handle Questions
    const questionMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (questionMatch && !inAnswerKey) {
      const qNum = questionMatch[1];
      const qText = questionMatch[2];

      html += `<div class="question-card">
        <div class="question-header">
          <span class="question-number">Question ${qNum}</span>
        </div>
        <p class="question-text">${qText}</p>`;

      if (inMcqSection) {
        html += `<div class="mcq-options-grid">`;
        // Collect MCQ options
        let optCount = 0;
        while (i + 1 < lines.length && optCount < 4) {
          i++;
          const optLine = lines[i].trim();
          if (!optLine) continue;

          const optMatch = optLine.match(/^[-\*]?\s*([A-D])\)\s*(.+)/);
          if (optMatch) {
            html += `<div class="mcq-option">
              <div class="option-indicator">${optMatch[1]}</div>
              <div class="option-content">${optMatch[2]}</div>
            </div>`;
            optCount++;
          } else {
            i--; // Backtrack if not an option
            break;
          }
        }
        html += '</div>';
      }

      html += '</div>';
      continue;
    }

    // Handle Answer Key Content
    if (inAnswerKey) {
      const ansMatch = line.match(/^(\d+)\.\s*(.+)/);
      if (ansMatch) {
        html += `<div class="answer-item">
          <span class="answer-label">Q${ansMatch[1]}</span>
          <span class="answer-text">${ansMatch[2]}</span>
        </div>`;
      } else if (line.includes(':')) {
        // Handle "Section A: 1. A, 2. B" format
        const sections = line.split(/Section [A-C]:/i);
        sections.forEach(sec => {
          if (!sec.trim()) return;
          const items = sec.split(',').map(item => item.trim());
          items.forEach(item => {
            const m = item.match(/^(\d+)\.\s*(.+)/);
            if (m) {
              html += `<div class="answer-item">
                <span class="answer-label">Q${m[1]}</span>
                <span class="answer-badge">${m[2]}</span>
              </div>`;
            }
          });
        });
      } else {
        html += `<p class="answer-text">${line}</p>`;
      }
      continue;
    }

    // Default: Para for everything else
    if (line.length > 0) {
      html += `<p>${line}</p>`;
    }
  }

  // Close any trailing divs
  if (currentSectionDivOpen) {
    html += inAnswerKey ? '</div></div>' : '</div>';
  }

  return html;
}

copyBtn.addEventListener('click', async () => {
  try {
    const text = resultText.innerText || resultText.textContent;
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
    copyBtn.style.background = 'var(--success-color)';
    setTimeout(() => {
      copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy';
      copyBtn.style.background = '';
    }, 2000);
  } catch (err) {
    copyBtn.innerHTML = '<span class="btn-icon">❌</span> Failed';
    copyBtn.style.background = 'var(--error-color)';
    setTimeout(() => {
      copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy';
      copyBtn.style.background = '';
    }, 2000);
  }
});

downloadPdfBtn.addEventListener('click', () => {
  const element = document.getElementById('generated-paper');
  const options = {
    margin: 0.5,
    filename: `neobranium-question-paper-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  if (typeof html2pdf === 'undefined') {
    alert('PDF generation tool is still loading or could not be loaded. Please try again in a moment.');
    return;
  }
  html2pdf().set(options).from(element).save();
});