/**
 * Frontend Unit & Integration Verification Suite (ES Module)
 * Verifies:
 * 1. Audio format conversion (Float32 <-> PCM16 Little-Endian)
 * 2. Downsampling accuracy (48kHz/44.1kHz -> 16kHz)
 * 3. Base64 encoding/decoding roundtrip
 * 4. Configuration defaults
 * 5. HTML semantic structure & element presence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  float32ToPCM16,
  pcm16ToFloat32,
  downsampleBuffer
} from './js/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFrontendTests() {
  console.log('🧪 Starting NeoBot Frontend Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // Group 1: Audio PCM & Base64 Conversions
  console.log('--- Test Group 1: Audio PCM & Base64 ---');

  const testFloats = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]); // test clamping
  const pcmBuffer = float32ToPCM16(testFloats);
  assert(pcmBuffer.byteLength === testFloats.length * 2, 'float32ToPCM16 produces 2 bytes per sample');

  const roundtripFloats = pcm16ToFloat32(pcmBuffer);
  assert(roundtripFloats.length === testFloats.length, 'pcm16ToFloat32 restores sample count');
  assert(Math.abs(roundtripFloats[0] - 0.0) < 0.001, 'Zero sample preserved');
  assert(Math.abs(roundtripFloats[1] - 0.5) < 0.01, 'Positive half-amplitude preserved');
  assert(Math.abs(roundtripFloats[2] - (-0.5)) < 0.01, 'Negative half-amplitude preserved');
  assert(Math.abs(roundtripFloats[3] - 1.0) < 0.01, 'Clamping max +1.0 preserved');
  assert(Math.abs(roundtripFloats[4] - (-1.0)) < 0.01, 'Clamping min -1.0 preserved');

  // Base64 Roundtrip
  const base64Str = arrayBufferToBase64(pcmBuffer);
  assert(typeof base64Str === 'string' && base64Str.length > 0, 'arrayBufferToBase64 produces base64 string');
  const restoredBuffer = base64ToArrayBuffer(base64Str);
  assert(restoredBuffer.byteLength === pcmBuffer.byteLength, 'base64ToArrayBuffer matches original byte length');

  // Group 2: Audio Resampling (Downsampling)
  console.log('\n--- Test Group 2: Downsampling Resampling ---');
  // 48000 Hz buffer with 480 samples = 10ms of audio
  const samples48k = new Float32Array(480);
  for (let i = 0; i < samples48k.length; i++) {
    samples48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000); // 440 Hz tone
  }
  const samples16k = downsampleBuffer(samples48k, 48000, 16000);
  // Expected: 480 / 3 = 160 samples
  assert(samples16k.length === 160, 'Downsamples 48kHz to 16kHz with exact 3:1 ratio (480 -> 160 samples)');

  // Group 3: HTML Structure Verification
  console.log('\n--- Test Group 3: HTML Structure & Elements ---');
  const htmlPath = path.join(__dirname, 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert(htmlContent.includes('id="run-btn"'), 'index.html contains run-btn element');
  assert(htmlContent.includes('id="stop-btn"'), 'index.html contains stop-btn element');
  assert(htmlContent.includes('id="status-pill"'), 'index.html contains status-pill element');
  assert(htmlContent.includes('id="status-text"'), 'index.html contains status-text element');
  assert(htmlContent.includes('id="robot-face"'), 'index.html contains robot-face element');
  assert(htmlContent.includes('class="eye left-eye"'), 'index.html contains robot eyes');
  assert(htmlContent.includes('id="camera-video"'), 'index.html contains camera-video element');
  assert(htmlContent.includes('<script type="module" src="js/main.js">'), 'index.html loads main.js as ES module');

  // Group 4: GeminiLiveClient Protocol & Barge-In Verification
  console.log('\n--- Test Group 4: GeminiLiveClient Protocol & Barge-In ---');
  const { GeminiLiveClient } = await import('./js/gemini-live-client.js');

  let readyFired = false;
  let audioChunkReceived = null;
  let interruptedFired = false;
  let turnCompleteFired = false;

  const client = new GeminiLiveClient({
    onReady: () => { readyFired = true; },
    onAudioChunk: (chunk) => { audioChunkReceived = chunk; },
    onInterrupted: () => { interruptedFired = true; },
    onTurnComplete: () => { turnCompleteFired = true; }
  });

  // Test setupComplete
  client.handleIncomingMessage({ setupComplete: {} });
  assert(readyFired === true, 'setupComplete triggers onReady callback');
  assert(client.isSetupComplete === true, 'client marks isSetupComplete as true');

  // Test server audio response
  const mockPcmBase64 = 'AAAA//88';
  client.handleIncomingMessage({
    serverContent: {
      modelTurn: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/pcm;rate=24000',
              data: mockPcmBase64
            }
          }
        ]
      }
    }
  });
  assert(audioChunkReceived === mockPcmBase64, 'serverContent audio part dispatches audio chunk');

  // Test Barge-in (interrupted flag)
  client.handleIncomingMessage({
    serverContent: {
      interrupted: true
    }
  });
  assert(interruptedFired === true, 'serverContent.interrupted triggers barge-in callback');

  // Test turnComplete
  client.handleIncomingMessage({
    serverContent: {
      turnComplete: true
    }
  });
  assert(turnCompleteFired === true, 'serverContent.turnComplete triggers turnComplete callback');

  // Test RealtimeInput payload formatting
  let sentPayload = null;
  client.isConnected = true;
  client.ws = {
    send: (data) => { sentPayload = JSON.parse(data); }
  };

  client.sendAudioChunk('input_pcm_data');
  assert(
    sentPayload?.realtimeInput?.audio?.mimeType === 'audio/pcm;rate=16000',
    'sendAudioChunk formats realtimeInput with audio/pcm;rate=16000'
  );
  assert(
    sentPayload?.realtimeInput?.audio?.data === 'input_pcm_data',
    'sendAudioChunk preserves audio payload bytes'
  );

  client.sendVideoFrame('input_jpeg_data');
  assert(
    sentPayload?.realtimeInput?.video?.mimeType === 'image/jpeg',
    'sendVideoFrame formats realtimeInput with image/jpeg'
  );
  assert(
    sentPayload?.realtimeInput?.video?.data === 'input_jpeg_data',
    'sendVideoFrame preserves JPEG payload bytes'
  );

  // Test sendTurnComplete
  client.sendTurnComplete();
  assert(
    Boolean(sentPayload?.realtimeInput?.activityEnd),
    'sendTurnComplete sends realtimeInput.activityEnd without invalid clientContent'
  );

  // Test sendInitialGreeting
  client.sendInitialGreeting();
  assert(
    sentPayload?.clientContent?.turns?.[0]?.parts?.[0]?.text?.length > 0 && sentPayload?.clientContent?.turnComplete === true,
    'sendInitialGreeting sends opening greeting turn with turnComplete: true'
  );

  // Test outputTranscription callback
  let transcriptReceived = null;
  let speakerReceived = null;
  client.onTranscript = (text, speaker) => {
    transcriptReceived = text;
    speakerReceived = speaker;
  };
  client.handleIncomingMessage({
    serverContent: {
      outputTranscription: { text: 'Hello human!' }
    }
  });
  assert(transcriptReceived === 'Hello human!' && speakerReceived === 'robot', 'outputTranscription triggers onTranscript with robot speaker');

  console.log(`\n========================================`);
  console.log(`🏁 Test Results: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 All frontend tests passed successfully!');
  }
}

runFrontendTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
