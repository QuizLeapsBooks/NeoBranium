/**
 * Stream Handler for SSE
 */
export const streamHandler = {
    async handleStream(response, onChunk, onDone) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.content) {
                            fullContent += data.content;
                            onChunk(fullContent);
                        }
                    } catch (e) {}
                }
            }
        }
        onDone(fullContent);
    }
};
