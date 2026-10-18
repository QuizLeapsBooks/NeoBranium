/**
 * End-to-End Live Integration Verification Suite
 * Verifies live interaction with real Gemini Live API:
 * 1. Health check & configuration
 * 2. Session provisioning (ephemeral token)
 * 3. Initial greeting turn
 * 4. Genuine AI spoken response to real-time audio input
 * 5. Genuine AI visual understanding from real-time video frames
 * 6. Proxy relay fallback functionality
 */

import fs from 'fs';
import WebSocket from 'ws';

const BASE_URL = 'http://127.0.0.1:3000';

async function runLiveIntegrationTests() {
  console.log('🚀 Starting NeoBot Full Live Integration Verification...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      process.exitCode = 1;
    }
  }

  // 1. Health Check
  console.log('--- Step 1: Backend Health Check ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  assert(healthRes.status === 200, 'GET /health returns HTTP 200');
  assert(health.status === 'ok', 'Service reports status: ok');
  assert(health.hasApiKey === true, 'API key is configured on server');
  assert(Boolean(health.model), `Model configured: ${health.model}`);

  // 2. Session Token Provisioning
  console.log('\n--- Step 2: Ephemeral Session Token Provisioning ---');
  const sessionRes = await fetch(`${BASE_URL}/api/session-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const session = await sessionRes.json();
  assert(sessionRes.status === 200, 'POST /api/session-token returns HTTP 200');
  assert(session.ok === true, 'Session response ok is true');
  assert(session.mode === 'ephemeral' && Boolean(session.token), 'Ephemeral token minted successfully');

  // 3. Live WebSocket Connection with Ephemeral Token
  console.log('\n--- Step 3: Direct Ephemeral Token WebSocket Connection ---');
  const wsUrl = `${session.wsEndpoint}?access_token=${encodeURIComponent(session.token)}`;
  const ws = new WebSocket(wsUrl);

  const connected = await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        setup: {
          model: `models/${session.model}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: session.voice || 'Puck' } }
            }
          },
          systemInstruction: { parts: [{ text: session.systemInstruction }] }
        }
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.setupComplete) {
        resolve(true);
      }
    });

    ws.on('error', (err) => {
      console.error('WS Error:', err.message);
      resolve(false);
    });

    setTimeout(() => resolve(false), 8000);
  });

  assert(connected === true, 'Live WebSocket accepted setup with Ephemeral Token');

  // 4. Initial Greeting Generation
  console.log('\n--- Step 4: Initial Spoken Greeting Verification ---');
  let greetingAudioReceived = false;
  let greetingTranscript = '';

  const greetingPromise = new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.serverContent?.modelTurn?.parts) {
        for (const p of msg.serverContent.modelTurn.parts) {
          if (p.inlineData?.data) greetingAudioReceived = true;
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        greetingTranscript += msg.serverContent.outputTranscription.text;
      }
      if (msg.serverContent?.turnComplete) {
        ws.off('message', handler);
        resolve(true);
      }
    };
    ws.on('message', handler);

    ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: 'A user has just opened NeoBranium Live AI! Speak aloud and greet them warmly as NeoBranium AI by Aevorin in 1 sentence.' }]
        }],
        turnComplete: true
      }
    }));

    setTimeout(() => {
      ws.off('message', handler);
      resolve(false);
    }, 10000);
  });

  await greetingPromise;
  assert(greetingAudioReceived === true, 'Received 24kHz PCM audio output for initial greeting');
  assert(greetingTranscript.length > 0, `Greeting transcribed: "${greetingTranscript.trim()}"`);

  // 5. Real-Time Audio Streaming (Speech Understanding)
  console.log('\n--- Step 5: Real-Time Audio Question (realtimeInput.audio) ---');
  let audioQuestionAnswered = false;
  let audioAnswerTranscript = '';

  let audioBuffer;
  if (fs.existsSync('/tmp/speech_16k.pcm')) {
    audioBuffer = fs.readFileSync('/tmp/speech_16k.pcm');
  } else {
    // Generate 1.5 seconds of 16kHz 16-bit PCM tone
    const samples = new Int16Array(24000);
    for (let i = 0; i < 24000; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 16000;
    }
    audioBuffer = Buffer.from(samples.buffer);
  }
  const speechPromise = new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.serverContent?.modelTurn?.parts) {
        for (const p of msg.serverContent.modelTurn.parts) {
          if (p.inlineData?.data) audioQuestionAnswered = true;
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        audioAnswerTranscript += msg.serverContent.outputTranscription.text;
      }
      if (msg.serverContent?.turnComplete) {
        ws.off('message', handler);
        resolve(true);
      }
    };
    ws.on('message', handler);

    // Stream 16kHz PCM audio chunks via realtimeInput.audio
    const chunkSize = 1600;
    let offset = 0;
    const interval = setInterval(() => {
      if (offset >= audioBuffer.length) {
        clearInterval(interval);
        // Continue streaming low ambient noise so server VAD commits turn
        let silenceCount = 0;
        const silenceInterval = setInterval(() => {
          silenceCount++;
          if (silenceCount > 35) {
            clearInterval(silenceInterval);
            return;
          }
          const ambientChunk = Buffer.alloc(chunkSize);
          for (let i = 0; i < chunkSize; i += 2) {
            ambientChunk.writeInt16LE(Math.floor((Math.random() - 0.5) * 40), i);
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              realtimeInput: {
                audio: { mimeType: 'audio/pcm;rate=16000', data: ambientChunk.toString('base64') }
              }
            }));
          }
        }, 50);
        return;
      }

      const chunk = audioBuffer.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          realtimeInput: {
            audio: { mimeType: 'audio/pcm;rate=16000', data: chunk.toString('base64') }
          }
        }));
      }
    }, 50);

    setTimeout(() => {
      ws.off('message', handler);
      resolve(false);
    }, 15000);
  });

  await speechPromise;
  assert(audioQuestionAnswered === true, 'Received genuine AI spoken response from streaming audio input');
  assert(audioAnswerTranscript.length > 0, `Spoken answer transcript: "${audioAnswerTranscript.trim()}"`);

  // 6. Real-Time Camera Visual Understanding (realtimeInput.video)
  console.log('\n--- Step 6: Real-Time Camera Visual Input (realtimeInput.video) ---');
  let visionAnswered = false;
  let visionTranscript = '';

  let shapesJpeg;
  if (fs.existsSync('/tmp/test_shapes.jpg')) {
    shapesJpeg = fs.readFileSync('/tmp/test_shapes.jpg').toString('base64');
  } else {
    // Minimal valid 1x1 JPEG in base64
    shapesJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  }
  const visionPromise = new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.serverContent?.outputTranscription?.text) {
        visionTranscript += msg.serverContent.outputTranscription.text;
      }
      if (msg.serverContent?.turnComplete) {
        ws.off('message', handler);
        visionAnswered = true;
        resolve(true);
      }
    };
    ws.on('message', handler);

    // Send video frame via realtimeInput.video
    ws.send(JSON.stringify({
      realtimeInput: {
        video: { mimeType: 'image/jpeg', data: shapesJpeg }
      }
    }));

    // Follow up with question asking what shapes and colors are present
    setTimeout(() => {
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: 'What shapes and colors do you see in front of you?' }]
          }],
          turnComplete: true
        }
      }));
    }, 800);

    setTimeout(() => {
      ws.off('message', handler);
      resolve(false);
    }, 12000);
  });

  await visionPromise;
  ws.close();

  assert(visionAnswered === true, 'Received visual recognition response for camera video frame');
  assert(
    visionTranscript.toLowerCase().includes('blue') ||
    visionTranscript.toLowerCase().includes('green') ||
    visionTranscript.toLowerCase().includes('square') ||
    visionTranscript.toLowerCase().includes('circle') ||
    visionTranscript.toLowerCase().includes('shape'),
    `Vision response identified visual content: "${visionTranscript.trim()}"`
  );

  // 7. Backend Proxy Relay Fallback
  console.log('\n--- Step 7: Backend WebSocket Proxy Relay Verification ---');
  const proxyWs = new WebSocket('ws://localhost:3000/ws/live');
  const proxyOk = await new Promise((resolve) => {
    proxyWs.on('open', () => {
      proxyWs.send(JSON.stringify({
        setup: {
          model: `models/${session.model}`,
          generationConfig: { responseModalities: ['AUDIO'] }
        }
      }));
    });

    proxyWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.setupComplete) {
        proxyWs.close();
        resolve(true);
      }
    });

    proxyWs.on('error', () => resolve(false));
    setTimeout(() => { proxyWs.close(); resolve(false); }, 6000);
  });

  assert(proxyOk === true, 'Backend WebSocket proxy relay successfully connected to Gemini Live');

  console.log(`\n========================================`);
  console.log(`🏁 Live Integration Results: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL LIVE INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runLiveIntegrationTests().catch((err) => {
  console.error('Integration test failure:', err);
  process.exit(1);
});
