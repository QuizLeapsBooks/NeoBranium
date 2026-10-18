/**
 * Audio and Base64 Utilities for Gemini Live Streaming (ES Module)
 */

/**
 * Converts an ArrayBuffer or Uint8Array to a Base64 string
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string to an ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts a Float32Array of audio samples (-1.0 to 1.0) into 16-bit signed PCM ArrayBuffer
 * Little-endian, required by Gemini Live API audio/pcm;rate=16000
 */
export function float32ToPCM16(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp sample between -1.0 and 1.0
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit signed integer (-32768 to 32767)
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, val, true); // true = little-endian
  }
  return buffer;
}

/**
 * Converts a 16-bit signed PCM ArrayBuffer (from Gemini Live API) into Float32Array
 * for Web Audio API AudioBuffer playback
 */
export function pcm16ToFloat32(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const numSamples = Math.floor(arrayBuffer.byteLength / 2);
  const float32Array = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true); // true = little-endian
    // Normalize into -1.0 to 1.0
    float32Array[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
  }
  return float32Array;
}

/**
 * Downsamples an audio buffer from inputSampleRate to outputSampleRate using linear interpolation
 */
export function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  if (inputSampleRate < outputSampleRate) {
    throw new Error('Upsampling is not supported.');
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}
