
const $ = id => document.getElementById(id);

const drumTypes = [
  { name: "Kick", icon: "🥁" },
  { name: "Snare", icon: "🥁" },
  { name: "Hi-Hat", icon: "✨" },
  { name: "Clap", icon: "👏" },
  { name: "Tom", icon: "🪘" }
];

const descriptions = {
  piano: "Warm, classic piano tones",
  guitar: "Bright electric guitar sound",
  bass: "Deep bass notes",
  synth: "Electronic lead synthesizer",
  bells: "Clear, sparkling bell tones",
  strings: "Smooth orchestral strings",
  organ: "Classic electronic organ"
};

let pattern = drumTypes.map(() => Array(16).fill(false));
let drumVolumes = [80, 70, 45, 55, 65];
let tempo = 110;
let swing = 0;
let masterVolume = 0.7;
let currentStep = -1;
let isPlaying = false;
let beatTimer = null;
let octave = 4;
let selectedInstrument = "piano";

let audioContext = null;
let masterGain = null;
let drumGainNodes = [];
let activeVoices = new Map();

let melodyTimers = [];
let melodyGeneration = 0;
let melodyPlaying = false;
let heldComputerKeys = new Set();

const keyboardMap = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5,
  t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12
};

const noteNames = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B"
];

function showMessage(message) {
  $("message").textContent = message;
}

function ensureAudio() {
  if (!audioContext) {
    const AudioClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioClass) {
      showMessage("Your browser does not support Web Audio.");
      return false;
    }

    audioContext = new AudioClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioContext.destination);

    drumGainNodes = drumTypes.map((_, i) => {
      const gain = audioContext.createGain();
      gain.gain.value = drumVolumes[i] / 100;
      gain.connect(masterGain);
      return gain;
    });
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return true;
}

function updateMasterVolume() {
  masterVolume = Number($("masterVolume").value) / 100;
  $("volumeValue").textContent = `${Math.round(masterVolume * 100)}%`;

  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(
      masterVolume, audioContext.currentTime, 0.015
    );
  }
}

function updateDrumVolume(index, value) {
  drumVolumes[index] = Number(value);

  if (drumGainNodes[index] && audioContext) {
    drumGainNodes[index].gain.setTargetAtTime(
      drumVolumes[index] / 100, audioContext.currentTime, 0.015
    );
  }

  const label = $(`volumeLabel${index}`);
  if (label) label.textContent = `${drumVolumes[index]}%`;
}

// -------------------- DRUM MACHINE --------------------

function renderSequencer() {
  const container = $("sequencer");
  container.innerHTML = "";

  container.appendChild(document.createElement("div"));

  for (let step = 0; step < 16; step++) {
    const number = document.createElement("div");
    number.className = "step-number" + (step % 4 === 0 ? " bar-start" : "");
    number.textContent = step + 1;
    container.appendChild(number);
  }

  drumTypes.forEach((drum, row) => {
    const label = document.createElement("div");
    label.className = "seq-label";

    const emoji = document.createElement("span");
    emoji.className = "seq-emoji";
    emoji.textContent = drum.icon;

    const name = document.createElement("span");
    name.textContent = drum.name;

    label.append(emoji, name);
    container.appendChild(label);

    for (let step = 0; step < 16; step++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "step";
      button.setAttribute("aria-label", `${drum.name}, step ${step + 1}`);

      button.addEventListener("click", () => {
        pattern[row][step] = !pattern[row][step];
        button.classList.toggle("active", pattern[row][step]);

        if (pattern[row][step]) playDrum(row);
      });

      container.appendChild(button);
    }
  });

  updateStepDisplay();
}

function updateStepDisplay() {
  const buttons = $("sequencer").querySelectorAll(".step");

  buttons.forEach((button, index) => {
    const row = Math.floor(index / 16);
    const step = index % 16;

    button.classList.toggle("active", pattern[row][step]);
    button.classList.toggle(
      "playing", isPlaying && step === currentStep
    );
  });
}

function playNoise(output, now, duration, volume, highpass = false) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();

  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  if (highpass) {
    const filter = audioContext.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 3000;
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }

  gain.connect(output);
  source.start(now);
  source.stop(now + duration);
}

function playDrum(index) {
  if (!ensureAudio()) return;

  const now = audioContext.currentTime;
  const output = drumGainNodes[index];

  if (index === 0) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.27);

  } else if (index === 1) {
    playNoise(output, now, 0.16, 0.45);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(190, now);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.14);

  } else if (index === 2) {
    playNoise(output, now, 0.055, 0.28, true);

  } else if (index === 3) {
    playNoise(output, now, 0.12, 0.5, true);

  } else if (index === 4) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.24);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.32);
  }
}

// -------------------- INSTRUMENTS --------------------

function midiFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playNote(midi, sourceId) {
  if (!ensureAudio() || activeVoices.has(sourceId)) return;

  const now = audioContext.currentTime;
  const frequency = midiFrequency(midi);
  const voiceGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const oscillators = [];

  filter.type = "lowpass";
  filter.frequency.value = selectedInstrument === "bass" ? 1800 : 7000;

  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.connect(filter);
  filter.connect(masterGain);

  const voice = {
    oscillators,
    gain: voiceGain,
    release: 0.3
  };

  activeVoices.set(sourceId, voice);

  function addOsc(type, freq, volume, detune = 0) {
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.value = detune;
    oscGain.gain.value = volume;

    osc.connect(oscGain);
    oscGain.connect(filter);
    osc.start(now);

    oscillators.push(osc);
  }

  let peak = 0.28;
  let attack = 0.025;
  let release = 0.3;

  switch (selectedInstrument) {
    case "piano":
      addOsc("triangle", frequency, 0.75);
      addOsc("sine", frequency * 2, 0.18);
      attack = 0.008;
      release = 0.65;
      peak = 0.32;
      break;

    case "guitar":
      addOsc("sawtooth", frequency, 0.28);
      addOsc("triangle", frequency * 2, 0.16);
      attack = 0.008;
      release = 0.24;
      peak = 0.27;
      break;

    case "bass":
      addOsc("triangle", frequency, 0.7);
      addOsc("sine", frequency / 2, 0.22);
      attack = 0.015;
      release = 0.22;
      peak = 0.42;
      break;

    case "synth":
      addOsc("sawtooth", frequency, 0.42);
      addOsc("square", frequency * 1.005, 0.16);
      attack = 0.04;
      release = 0.25;
      peak = 0.25;
      break;

    case "bells":
      addOsc("sine", frequency, 0.75);
      addOsc("sine", frequency * 2.76, 0.2);
      addOsc("sine", frequency * 4.1, 0.08);
      attack = 0.005;
      release = 1;
      peak = 0.3;
      break;

    case "strings":
      addOsc("sawtooth", frequency, 0.22, -7);
      addOsc("sawtooth", frequency, 0.22, 7);
      addOsc("triangle", frequency / 2, 0.08);
      attack = 0.16;
      release = 0.45;
      peak = 0.22;
      break;

    case "organ":
      addOsc("sine", frequency, 0.5);
      addOsc("sine", frequency * 2, 0.22);
      addOsc("sine", frequency * 3, 0.1);
      attack = 0.012;
      release = 0.12;
      peak = 0.3;
      break;
  }

  voice.release = release;

  voiceGain.gain.setTargetAtTime(
    peak, now, Math.max(0.005, attack / 3)
  );

  if (selectedInstrument === "bells" || selectedInstrument === "piano") {
    voiceGain.gain.setTargetAtTime(0.0001, now + 0.12, release / 3);
  }
}

function stopNote(sourceId) {
  const voice = activeVoices.get(sourceId);
  if (!voice || !audioContext) return;

  activeVoices.delete(sourceId);

  const now = audioContext.currentTime;
  const release = voice.release || 0.25;

  try {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, release / 4);

    voice.oscillators.forEach(osc => {
      osc.stop(now + release + 0.15);
    });
  } catch (error) {
    // The voice may already have stopped.
  }
}

function renderPiano() {
  const piano = $("piano");
  piano.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    const midi = 12 * (octave + 1) + i;
    const noteName = noteNames[i % 12];
    const isBlack = noteName.includes("#");
    const key = document.createElement("button");

    key.type = "button";
    key.className = "key" + (isBlack ? " black" : "");
    key.dataset.midi = midi;

    const mappedKey = Object.keys(keyboardMap).find(
      name => keyboardMap[name] === i
    );

    key.innerHTML = isBlack
      ? ""
      : `${noteName}<br>${mappedKey ? mappedKey.toUpperCase() : ""}`;

    key.setAttribute("aria-label", `${noteName} ${Math.floor(midi / 12) - 1}`);

    key.addEventListener("pointerdown", event => {
      event.preventDefault();
      key.setPointerCapture(event.pointerId);
      key.classList.add("pressed");
      playNote(midi, `pointer-${event.pointerId}`);
    });

    const releasePointer = event => {
      key.classList.remove("pressed");
      stopNote(`pointer-${event.pointerId}`);
    };

    key.addEventListener("pointerup", releasePointer);
    key.addEventListener("pointercancel", releasePointer);
    key.addEventListener("lostpointercapture", releasePointer);

    piano.appendChild(key);
  }

  $("octaveLabel").textContent = `OCTAVE ${octave}`;
}

function updateInstrument() {
  selectedInstrument = $("instrumentSelect").value;
  $("instrumentDescription").textContent = descriptions[selectedInstrument];
}

// -------------------- RANDOM MELODY --------------------

function stopRandomMelody() {
  melodyGeneration++;
  melodyPlaying = false;

  melodyTimers.forEach(timer => clearTimeout(timer));
  melodyTimers = [];

  for (const sourceId of [...activeVoices.keys()]) {
    if (sourceId.startsWith("random-melody-")) {
      stopNote(sourceId);
    }
  }

  document.querySelectorAll(".key.pressed").forEach(key => {
    key.classList.remove("pressed");
  });

  $("randomMelodyBtn").disabled = false;
  $("randomMelodyBtn").textContent = "✨ Generate Random Melody";
}

function generateRandomMelody() {
  stopRandomMelody();

  if (!ensureAudio()) return;

  const runId = melodyGeneration;
  const length = Number($("melodyLength").value);
  const bpm = Number($("tempo").value);
  const baseMidi = 60 + (octave - 4) * 12;

  // Do major scale, including an upper octave.
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  const notes = [];
  let previous = 4;

  for (let i = 0; i < length; i++) {
    let choices = scale.filter(note => Math.abs(note - previous) <= 5);
    if (!choices.length) choices = scale;

    let note = choices[Math.floor(Math.random() * choices.length)];

    // End the melody on C for a more resolved sound.
    if (i === length - 1) note = 0;

    notes.push(note);
    previous = note;
  }

  melodyPlaying = true;
  $("randomMelodyBtn").disabled = true;
  $("randomMelodyBtn").textContent = "🎵 Playing Melody...";

  const beatDuration = 60000 / bpm;
  let elapsed = 0;

  notes.forEach((note, i) => {
    // Mix quarter-beat and half-beat note lengths.
    const noteDuration = Math.random() < 0.3 ? 0.5 : 1;
    const delay = elapsed;

    const startTimer = setTimeout(() => {
      if (runId !== melodyGeneration || !melodyPlaying) return;

      const midi = baseMidi + note;
      const sourceId = `random-melody-${runId}-${i}`;

      playNote(midi, sourceId);

      const key = $("piano").querySelector(`[data-midi="${midi}"]`);
      if (key) key.classList.add("pressed");

      const releaseTimer = setTimeout(() => {
        stopNote(sourceId);
        if (key) key.classList.remove("pressed");
      }, Math.max(180, beatDuration * noteDuration * 0.8));

      melodyTimers.push(releaseTimer);
    }, delay);

    melodyTimers.push(startTimer);
    elapsed += beatDuration * noteDuration;
  });

  const finishTimer = setTimeout(() => {
    if (runId !== melodyGeneration) return;

    melodyPlaying = false;
    $("randomMelodyBtn").disabled = false;
    $("randomMelodyBtn").textContent = "✨ Generate Random Melody";
  }, elapsed + 1000);

  melodyTimers.push(finishTimer);
}

// -------------------- BEAT PLAYBACK --------------------

function startPlayback() {
  if (isPlaying || !ensureAudio()) return;

  isPlaying = true;
  currentStep = -1;
  $("playBtn").textContent = "▶ Playing Beat";
  scheduleNextStep();
}

function scheduleNextStep() {
  if (!isPlaying) return;

  currentStep = (currentStep + 1) % 16;

  pattern.forEach((row, index) => {
    if (row[currentStep]) playDrum(index);
  });

  updateStepDisplay();

  const baseInterval = 60000 / tempo / 4;
  const swingFactor = swing / 100;
  const interval = baseInterval *
    (currentStep % 2 === 1 ? 1 + swingFactor : 1 - swingFactor);

  beatTimer = setTimeout(scheduleNextStep, interval);
}

function stopPlayback() {
  isPlaying = false;

  if (beatTimer !== null) {
    clearTimeout(beatTimer);
    beatTimer = null;
  }

  currentStep = -1;
  $("playBtn").textContent = "▶ Play Beat";
  updateStepDisplay();
}

function clearProject() {
  stopPlayback();
  stopRandomMelody();
  pattern = drumTypes.map(() => Array(16).fill(false));
  renderSequencer();
  showMessage("Beat cleared. Create a new one!");
}

// -------------------- MIXER --------------------

function renderMixer() {
  const mixer = $("mixer");
  mixer.innerHTML = "";

  drumTypes.forEach((drum, index) => {
    const channel = document.createElement("div");
    channel.className = "mixer-channel";

    const icon = document.createElement("div");
    icon.className = "channel-icon";
    icon.textContent = drum.icon;

    const title = document.createElement("h4");
    title.textContent = drum.name;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = drumVolumes[index];
    slider.setAttribute("aria-label", `${drum.name} volume`);

    const value = document.createElement("div");
    value.className = "channel-value";
    value.id = `volumeLabel${index}`;
    value.textContent = `${drumVolumes[index]}%`;

    slider.addEventListener("input", event => {
      updateDrumVolume(index, event.target.value);
    });

    channel.append(icon, title, slider, value);
    mixer.appendChild(channel);
  });
}

// -------------------- SAVE AND LOAD --------------------

function getProjectData() {
  return {
    app: "Beat Player",
    version: 1,
    tempo,
    swing,
    masterVolume: Number($("masterVolume").value),
    selectedInstrument,
    octave,
    pattern,
    drumVolumes
  };
}

function saveProject() {
  const blob = new Blob(
    [JSON.stringify(getProjectData(), null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "beat-player-project.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage("Project downloaded successfully!");
}

function loadProjectData(data) {
  if (!data || !Array.isArray(data.pattern) ||
      data.pattern.length !== drumTypes.length ||
      !data.pattern.every(row => Array.isArray(row) && row.length === 16)) {
    throw new Error("This project file is not valid.");
  }

  stopPlayback();
  stopRandomMelody();

  pattern = data.pattern.map(row => row.map(Boolean));

  if (Number.isFinite(data.tempo)) {
    tempo = Math.max(60, Math.min(180, data.tempo));
    $("tempo").value = tempo;
    $("tempoValue").textContent = `${tempo} BPM`;
  }

  if (Number.isFinite(data.swing)) {
    swing = Math.max(0, Math.min(60, data.swing));
    $("swing").value = swing;
    $("swingValue").textContent = `${swing}%`;
  }

  if (Number.isFinite(data.masterVolume)) {
    $("masterVolume").value = Math.max(0, Math.min(100, data.masterVolume));
    updateMasterVolume();
  }

  if (Array.isArray(data.drumVolumes) &&
      data.drumVolumes.length === drumTypes.length) {
    drumVolumes = data.drumVolumes.map(value =>
      Math.max(0, Math.min(100, Number(value) || 0))
    );
    renderMixer();

    drumVolumes.forEach((value, index) => {
      updateDrumVolume(index, value);
    });
  }

  if (descriptions[data.selectedInstrument]) {
    $("instrumentSelect").value = data.selectedInstrument;
    updateInstrument();
  }

  if (Number.isFinite(data.octave)) {
    octave = Math.max(2, Math.min(6, data.octave));
    renderPiano();
  }

  renderSequencer();
  showMessage("Project loaded successfully!");
}

// -------------------- EVENT LISTENERS --------------------

$("playBtn").addEventListener("click", startPlayback);
$("stopBtn").addEventListener("click", stopPlayback);
$("clearBtn").addEventListener("click", clearProject);

$("tempo").addEventListener("input", event => {
  tempo = Number(event.target.value);
  $("tempoValue").textContent = `${tempo} BPM`;
});

$("masterVolume").addEventListener("input", updateMasterVolume);

$("swing").addEventListener("input", event => {
  swing = Number(event.target.value);
  $("swingValue").textContent = `${swing}%`;
});

$("instrumentSelect").addEventListener("change", updateInstrument);

$("randomMelodyBtn").addEventListener("click", generateRandomMelody);
$("stopMelodyBtn").addEventListener("click", stopRandomMelody);

$("octaveDown").addEventListener("click", () => {
  if (octave > 2) {
    octave--;
    renderPiano();
  }
});

$("octaveUp").addEventListener("click", () => {
  if (octave < 6) {
    octave++;
    renderPiano();
  }
});

document.addEventListener("keydown", event => {
  if (event.repeat) return;

  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) return;

  const key = event.key.toLowerCase();
  if (!(key in keyboardMap)) return;

  event.preventDefault();

  if (heldComputerKeys.has(key)) return;
  heldComputerKeys.add(key);

  const midi = 12 * (octave + 1) + keyboardMap[key];
  playNote(midi, `computer-${key}`);

  const pianoKey = $("piano").querySelector(`[data-midi="${midi}"]`);
  if (pianoKey) pianoKey.classList.add("pressed");
});

document.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();
  if (!heldComputerKeys.has(key)) return;

  heldComputerKeys.delete(key);
  stopNote(`computer-${key}`);

  const midi = 12 * (octave + 1) + keyboardMap[key];
  const pianoKey = $("piano").querySelector(`[data-midi="${midi}"]`);
  if (pianoKey) pianoKey.classList.remove("pressed");
});

window.addEventListener("blur", () => {
  for (const key of heldComputerKeys) {
    stopNote(`computer-${key}`);
  }

  heldComputerKeys.clear();

  document.querySelectorAll(".key.pressed").forEach(key => {
    key.classList.remove("pressed");
  });
});

$("saveBtn").addEventListener("click", saveProject);

$("loadBtn").addEventListener("click", () => {
  $("loadFile").click();
});

$("loadFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    loadProjectData(data);
  } catch (error) {
    showMessage(error.message || "Could not load this file.");
  }

  event.target.value = "";
});

// -------------------- INITIALIZE --------------------

renderSequencer();
renderPiano();
renderMixer();
updateInstrument();
updateMasterVolume();
