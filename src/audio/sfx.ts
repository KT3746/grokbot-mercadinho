export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  unlocked = false;

  /** Camada base (expediente) — plucks suaves, sem zumbido contínuo. */
  private bedOn = false;
  private bedGain: GainNode | null = null;
  private rushGain: GainNode | null = null;
  private bedTimer: number | null = null;
  private rushTimer: number | null = null;
  private pressure = 0;
  private step = 0;

  async unlock(): Promise<void> {
    if (this.unlocked && this.ctx?.state === "running") return;
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    await this.ctx.resume();
    this.unlocked = true;
  }

  private build(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.3;
    this.master.connect(this.ctx.destination);
    // Sem zumbido/ambiente contínuo — só efeitos curtos nas ações + bed opcional no play.
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.3;
    // Mute zera o master; timers podem continuar sem audível. Se mutado, pausa timers pra economizar.
    if (muted) this.pauseBedTimers();
    else if (this.bedOn) this.resumeBedTimers();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide?: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), this.ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur + 0.02);
  }

  private noiseBurst(dur: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  bell(): void {
    this.tone(880, 0.1, "sine", 0.08);
    this.tone(1320, 0.16, "triangle", 0.045);
    this.blip(1760, 0.08, "sine", 0.025, 0.04);
  }

  pickup(): void {
    this.blip(380, 0.05, "square", 0.04);
    this.blip(560, 0.07, "triangle", 0.055, 0.02);
    this.blip(780, 0.09, "sine", 0.035, 0.05);
  }

  cash(): void {
    // Punch curto + ding — sem drone.
    this.noiseBurst(0.035, 0.055);
    this.blip(180, 0.045, "square", 0.05);
    this.blip(523, 0.055, "square", 0.06, 0.02);
    this.blip(784, 0.09, "triangle", 0.055, 0.055);
    this.blip(1175, 0.11, "sine", 0.04, 0.09);
  }

  /** Impacto curto na entrega certa (hitstop sonoro). */
  punch(): void {
    this.noiseBurst(0.028, 0.06);
    this.blip(140, 0.04, "square", 0.055);
    this.blip(420, 0.05, "triangle", 0.04, 0.015);
  }

  combo(n: number): void {
    const tier = Math.min(8, Math.max(1, n));
    const base = 480 + tier * 48;
    this.blip(base, 0.08, "triangle", 0.06);
    this.blip(base * 1.25, 0.1, "sine", 0.045, 0.04);
    if (tier >= 3) this.blip(base * 1.5, 0.12, "sine", 0.04, 0.08);
    if (tier >= 5) this.blip(base * 1.85, 0.14, "triangle", 0.035, 0.12);
    if (tier >= 7) this.blip(base * 2.2, 0.16, "sine", 0.03, 0.16);
  }

  wrong(): void {
    this.tone(210, 0.12, "sawtooth", 0.07, 110);
    this.blip(140, 0.14, "square", 0.045, 0.05);
  }

  slam(): void {
    this.tone(95, 0.2, "sawtooth", 0.1, 48);
    this.blip(70, 0.16, "square", 0.05, 0.04);
  }

  shift(): void {
    this.blip(392, 0.09, "triangle", 0.055);
    this.blip(494, 0.1, "triangle", 0.055, 0.08);
    this.blip(587, 0.11, "triangle", 0.06, 0.16);
    this.blip(740, 0.14, "sine", 0.045, 0.24);
  }

  over(): void {
    this.tone(349, 0.16, "triangle", 0.065, 220);
    this.blip(277, 0.2, "sine", 0.06, 0.14);
    this.blip(220, 0.26, "sine", 0.07, 0.3);
    this.blip(165, 0.32, "triangle", 0.05, 0.48);
  }

  chaos(): void {
    this.tone(220, 0.14, "square", 0.04, 150);
    this.blip(160, 0.12, "sawtooth", 0.03, 0.06);
  }

  click(): void {
    this.blip(820, 0.035, "square", 0.03);
    this.blip(1100, 0.03, "triangle", 0.018, 0.015);
  }

  // ——— Música em camadas (só no play; respeita mute) ———

  /** Inicia bed suave no expediente. Sem som no título. */
  startBed(): void {
    if (!this.ctx) this.build();
    if (!this.ctx || !this.master) return;
    if (this.bedOn) return;
    this.bedOn = true;
    this.step = 0;
    this.pressure = 0;

    this.bedGain = this.ctx.createGain();
    this.bedGain.gain.value = 0.0001;
    this.bedGain.connect(this.master);

    this.rushGain = this.ctx.createGain();
    this.rushGain.gain.value = 0.0001;
    this.rushGain.connect(this.master);

    const now = this.ctx.currentTime;
    this.bedGain.gain.exponentialRampToValueAtTime(0.085, now + 0.6);

    if (!this.muted) this.resumeBedTimers();
  }

  /** Para tudo — título / game-over / sair. */
  stopBed(): void {
    this.bedOn = false;
    this.pauseBedTimers();
    const ctx = this.ctx;
    if (ctx && this.bedGain) {
      try {
        this.bedGain.gain.cancelScheduledValues(ctx.currentTime);
        this.bedGain.gain.setValueAtTime(Math.max(0.0001, this.bedGain.gain.value), ctx.currentTime);
        this.bedGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      } catch {
        /* ignore */
      }
    }
    if (ctx && this.rushGain) {
      try {
        this.rushGain.gain.cancelScheduledValues(ctx.currentTime);
        this.rushGain.gain.setValueAtTime(Math.max(0.0001, this.rushGain.gain.value), ctx.currentTime);
        this.rushGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      } catch {
        /* ignore */
      }
    }
    window.setTimeout(() => {
      try {
        this.bedGain?.disconnect();
        this.rushGain?.disconnect();
      } catch {
        /* ignore */
      }
      this.bedGain = null;
      this.rushGain = null;
    }, 320);
    this.pressure = 0;
  }

  /** 0..1 — sobe a camada de rush/caos/pressão. */
  setPressure(p: number): void {
    const target = Math.max(0, Math.min(1, p));
    this.pressure = this.pressure * 0.82 + target * 0.18;
    if (!this.ctx || !this.rushGain || !this.bedOn) return;
    const level = 0.0001 + this.pressure * 0.11;
    const t = this.ctx.currentTime;
    this.rushGain.gain.cancelScheduledValues(t);
    this.rushGain.gain.setTargetAtTime(level, t, 0.18);
  }

  private pauseBedTimers(): void {
    if (this.bedTimer != null) {
      window.clearInterval(this.bedTimer);
      this.bedTimer = null;
    }
    if (this.rushTimer != null) {
      window.clearInterval(this.rushTimer);
      this.rushTimer = null;
    }
  }

  private resumeBedTimers(): void {
    if (!this.bedOn || this.muted) return;
    this.pauseBedTimers();
    // Arpejo curto e espaçado — não é hum contínuo.
    this.bedTimer = window.setInterval(() => this.bedTick(), 520);
    this.rushTimer = window.setInterval(() => this.rushTick(), 280);
    this.bedTick();
  }

  private bedTick(): void {
    if (!this.ctx || !this.bedGain || !this.bedOn || this.muted) return;
    // Pentatônica agradável (C minor-ish / loja noturna)
    const notes = [196, 233.08, 261.63, 311.13, 349.23, 392];
    const n = notes[this.step % notes.length]!;
    this.step += 1;
    this.pluck(n, 0.28, 0.045, this.bedGain, "triangle");
    if (this.step % 4 === 0) {
      this.pluck(n * 1.5, 0.18, 0.02, this.bedGain, "sine");
    }
  }

  private rushTick(): void {
    if (!this.ctx || !this.rushGain || !this.bedOn || this.muted) return;
    if (this.pressure < 0.12) return;
    const notes = [523.25, 587.33, 698.46, 783.99];
    const n = notes[this.step % notes.length]!;
    const g = 0.018 + this.pressure * 0.04;
    this.pluck(n, 0.12, g, this.rushGain, "square");
    if (this.pressure > 0.55) {
      this.pluck(n * 0.5, 0.08, g * 0.7, this.rushGain, "triangle");
    }
  }

  private pluck(
    freq: number,
    dur: number,
    gain: number,
    dest: GainNode,
    type: OscillatorType,
  ): void {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = type === "square" ? 1800 : 2400;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }
}
