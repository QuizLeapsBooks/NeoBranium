(() => {
  'use strict';

  const storageKey = 'neobranium.brandIntro.v1.completed';
  const intro = document.getElementById('brand-intro');
  if (!intro) return;

  const canUseStorage = () => { try { const probe = '__neobranium_intro_probe__'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe); return true; } catch (_) { return false; } };
  const storageAvailable = canUseStorage();
  const isComplete = () => { try { return storageAvailable && localStorage.getItem(storageKey) === '1'; } catch (_) { return false; } };
  const markComplete = () => { try { if (storageAvailable) localStorage.setItem(storageKey, '1'); } catch (_) { /* Optional state only. */ } };

  let audioContext = null;
  let audioStarted = false;
  let audioStarting = false;
  let finished = false;
  const timers = [];
  const later = (fn, delay) => timers.push(window.setTimeout(fn, delay));

  // Original, low-volume Web Audio cue: an ambient rise and two soft chimes.
  // It has no fetched asset, no licensing dependency, and falls back to silence.
  const startSound = async () => {
    if (audioStarted || audioStarting || finished) return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    audioStarting = true;
    try {
      audioContext = new AudioContext();
      await audioContext.resume();
      if (audioContext.state !== 'running' || finished) { await audioContext.close(); audioContext = null; audioStarting = false; return false; }
      audioStarted = true;
      audioStarting = false;
      const now = audioContext.currentTime;
      const master = audioContext.createGain();
      master.gain.setValueAtTime(.0001, now);
      master.gain.exponentialRampToValueAtTime(.048, now + .65);
      master.gain.exponentialRampToValueAtTime(.028, now + 4.7);
      master.gain.exponentialRampToValueAtTime(.0001, now + 6.05);
      master.connect(audioContext.destination);
      const tone = (frequency, when, duration, gain, type = 'sine', endFrequency = frequency) => {
        const oscillator = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now + when);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + when + duration);
        envelope.gain.setValueAtTime(.0001, now + when);
        envelope.gain.exponentialRampToValueAtTime(gain, now + when + .11);
        envelope.gain.exponentialRampToValueAtTime(.0001, now + when + duration);
        oscillator.connect(envelope).connect(master);
        oscillator.start(now + when);
        oscillator.stop(now + when + duration + .03);
      };
      tone(174.61, .05, 4.15, .38, 'sine', 261.63);
      tone(261.63, .45, 3.75, .16, 'triangle', 329.63);
      tone(523.25, 4.25, 1.35, .24, 'sine', 659.25);
      tone(783.99, 4.67, 1.12, .13, 'sine', 783.99);
      return true;
    } catch (_) {
      if (audioContext) { try { await audioContext.close(); } catch (_) { /* Ignore unavailable audio hardware. */ } }
      audioContext = null;
      audioStarting = false;
      return false;
    }
  };

  const stopSound = () => {
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    audioStarted = false;
  };
  const removeAudioGestureListeners = () => {
    document.removeEventListener('pointerdown', startSoundOnInteraction, true);
    document.removeEventListener('keydown', startSoundOnInteraction, true);
  };
  const startSoundOnInteraction = (event) => {
    // Skipping should dismiss immediately rather than audibly starting then stopping.
    if (event.target instanceof Element && event.target.closest('[data-brand-intro-skip]')) return;
    startSound().then((playing) => { if (playing) removeAudioGestureListeners(); });
  };
  const removeIntro = () => { intro.hidden = true; document.documentElement.classList.remove('brand-intro-pending'); intro.remove(); };

  if (!storageAvailable || isComplete() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { markComplete(); removeIntro(); return; }

  intro.hidden = false;
  document.documentElement.classList.remove('brand-intro-pending');
  const logo = intro.querySelector('.brand-intro__logo-image');
  if (logo) logo.addEventListener('error', () => intro.classList.add('brand-intro--logo-unavailable'), { once: true });

  const finish = () => {
    if (finished) return;
    finished = true;
    markComplete();
    timers.forEach(window.clearTimeout);
    removeAudioGestureListeners();
    stopSound();
    intro.classList.add('brand-intro--leaving');
    window.setTimeout(removeIntro, 540);
  };

  const skip = intro.querySelector('[data-brand-intro-skip]');
  if (skip) skip.addEventListener('click', finish, { once: true });

  // One permitted autoplay attempt, aligned with the actual logo's entrance.
  // A browser rejection is intentionally silent. The first normal touch/click
  // or key press provides a standards-compliant fallback without a sound button.
  document.addEventListener('pointerdown', startSoundOnInteraction, true);
  document.addEventListener('keydown', startSoundOnInteraction, true);
  later(() => startSound().then((playing) => { if (playing) removeAudioGestureListeners(); }), 420);
  later(() => intro.classList.add('brand-intro--product'), 4050);
  later(finish, 6600);
  later(finish, 7600); // hard fallback independent of all CSS/image/audio events
})();
