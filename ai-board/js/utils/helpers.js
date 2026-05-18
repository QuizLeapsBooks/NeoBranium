/**
 * NeoBranium Utility Helpers
 */
export const utils = {
    markdownToHtml(text) {
        let html = '';
        if (typeof marked !== 'undefined') {
            html = marked.parse(text);
        } else {
            html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        }
        if (typeof DOMPurify !== 'undefined') {
            html = DOMPurify.sanitize(html);
        }
        return html;
    },

    renderMath(element) {
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\[", right: "\\]", display: true},
                    {left: "\\(", right: "\\)", display: false}
                ],
                throwOnError: false,
                errorColor: "#ff4747"
            });
        }
    },

    stripMarkdown(text) {
        return text.replace(/(\*\*|__)(.*?)\1/g, '$2')
                   .replace(/(\*|_)(.*?)\1/g, '$2')
                   .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                   .replace(/#{1,6}\s?/g, '')
                   .replace(/`/g, '');
    },

    chunkText(text) {
        const sentences = text.match(/[^.!?।\n]+[.!?।\n]+/g) || [text];
        const merged = [];
        for (const s of sentences) {
            const trimmed = s.trim();
            if (!trimmed) continue;
            if (merged.length && trimmed.length < 20) {
                merged[merged.length - 1] += ' ' + trimmed;
            } else {
                merged.push(trimmed);
            }
        }
        return merged.length ? merged : [text.trim()];
    },

    normalizeOCR(text) {
        if (!text) return "";
        return text
            .replace(/\bO2\b/g, 'O_{2}')
            .replace(/\bH2O\b/g, 'H_{2}O')
            .replace(/\bCO2\b/g, 'CO_{2}')
            .replace(/\bNH3\b/g, 'NH_{3}')
            .replace(/\bCH4\b/g, 'CH_{4}')
            .replace(/\bH2SO4\b/g, 'H_{2}SO_{4}')
            .replace(/->/g, '\\rightarrow')
            .replace(/=>/g, '\\Rightarrow');
    },

    hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h.toString(36);
    },

    stripForSpeech(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#{1,6}\s?/g, '')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .replace(/\$\$(.*?)\$\$/gs, '$1')
            .replace(/\\\((.*?)\\\)/g, '$1')
            .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
            .replace(/[\\{}]/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
};
