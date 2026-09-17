"use client";

/** /audio — everything is synthesised at runtime (no sample files, no licensing). */
export class AudioSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxGain: GainNode | null = null;
  ambGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: number | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private cityGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    type WinAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = 0.5;
    this.ambGain.connect(this.master);
    this.startAmbient();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  setVolumes(master: number, sfx: number, amb: number) {
    if (this.master) this.master.gain.value = master;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.ambGain) this.ambGain.gain.value = amb;
  }

  private noiseBuffer(seconds = 2) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startAmbient() {
    if (!this.ctx || !this.ambGain) return;
    const ctx = this.ctx;
    // low city rumble
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(filt).connect(g).connect(this.ambGain);
    src.start();
    this.cityGain = g;
  }

  setCityAmbience(level: number) {
    if (this.cityGain) this.cityGain.gain.value = 0.08 + level * 0.3;
  }

  /* ----------------------------- engine ---------------------------- */
  engineStart() {
    if (!this.ctx || !this.sfxGain || this.engineOsc) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 60;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(filt).connect(g).connect(this.sfxGain);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = g;
  }

  engineUpdate(speed01: number, throttle: number) {
    if (!this.engineOsc || !this.engineGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 200 + throttle * 35, t, 0.12);
    this.engineGain.gain.setTargetAtTime(0.045 + speed01 * 0.07, t, 0.2);
  }

  engineStop() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch {
        /* already stopped */
      }
      this.engineOsc.disconnect();
    }
    this.engineOsc = null;
    this.engineGain = null;
  }

  /* ----------------------------- siren ----------------------------- */
  sirenOn() {
    if (!this.ctx || !this.sfxGain || this.sirenOsc) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "square";
    const g = ctx.createGain();
    g.gain.value = 0.055;
    osc.connect(g).connect(this.sfxGain);
    osc.start();
    this.sirenOsc = osc;
    this.sirenGain = g;
    let hi = true;
    this.sirenTimer = window.setInterval(() => {
      if (!this.sirenOsc || !this.ctx) return;
      this.sirenOsc.frequency.setValueAtTime(hi ? 780 : 560, this.ctx.currentTime);
      hi = !hi;
    }, 420);
  }

  sirenOff() {
    if (this.sirenTimer) window.clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
      } catch {
        /* noop */
      }
      this.sirenOsc.disconnect();
    }
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  /* ----------------------------- rain ------------------------------ */
  setRain(intensity: number) {
    if (!this.ctx || !this.ambGain) return;
    if (intensity <= 0.01) {
      if (this.rainSrc) {
        try {
          this.rainSrc.stop();
        } catch {
          /* noop */
        }
        this.rainSrc.disconnect();
        this.rainSrc = null;
        this.rainGain = null;
      }
      return;
    }
    if (!this.rainSrc) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(3);
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "highpass";
      filt.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(filt).connect(g).connect(this.ambGain);
      src.start();
      this.rainSrc = src;
      this.rainGain = g;
    }
    if (this.rainGain) this.rainGain.gain.value = intensity * 0.22;
  }

  /* ----------------------------- one shots ------------------------- */
  blip(freq = 660, dur = 0.08, type: OscillatorType = "sine", vol = 0.12) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  ui() {
    this.blip(880, 0.05, "triangle", 0.07);
  }
  success() {
    this.blip(660, 0.09, "sine", 0.1);
    window.setTimeout(() => this.blip(990, 0.12, "sine", 0.1), 90);
  }
  error() {
    this.blip(180, 0.18, "square", 0.09);
  }
  cash() {
    this.blip(1200, 0.05, "square", 0.06);
    window.setTimeout(() => this.blip(1600, 0.07, "square", 0.05), 60);
  }
  horn() {
    this.blip(380, 0.3, "square", 0.1);
  }
  gunshot() {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.3);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start();
  }
  radio() {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start();
    window.setTimeout(() => this.blip(520, 0.06, "sine", 0.05), 140);
  }
  crash(force = 1) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.4);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.35, 0.1 * force), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start();
  }

  dispose() {
    this.sirenOff();
    this.engineStop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

export const audio = new AudioSystem();
