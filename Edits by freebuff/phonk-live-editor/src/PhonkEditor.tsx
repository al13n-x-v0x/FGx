import { useState, useEffect, useRef, useCallback } from "react";

// ----------------------------------------------------------------------------
// Simple audio engine: just an oscillator + gain so the app has sound without
// needing real audio files. Replace with real samples in a real project.
// ----------------------------------------------------------------------------
function buildAudio() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const kick = ctx.createOscillator();
  kick.type = "sine";
  const kickGain = ctx.createGain();
  kickGain.gain.value = 0;
  kick.connect(kickGain);
  kickGain.connect(master);
  kick.start();

  const snare = ctx.createOscillator();
  snare.type = "sawtooth";
  const snareGain = ctx.createGain();
  snareGain.gain.value = 0;
  snare.connect(snareGain);
  snareGain.connect(master);
  snare.start();

  const hihat = ctx.createOscillator();
  hihat.type = "square";
  const hihatGain = ctx.createGain();
  hihatGain.gain.value = 0;
  hihat.connect(hihatGain);
  hihatGain.connect(master);
  hihat.start();

  return {
    ctx,
    master,
    kick,
    kickGain,
    snare,
    snareGain,
    hihat,
    hihatGain,
  };
}

function scheduleKick(ctx: AudioContext, startTime: number, gain: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, startTime);
  osc.frequency.exponentialRampToValueAtTime(45, startTime + 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gain, startTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.25);
}

function scheduleSnare(ctx: AudioContext, startTime: number, gain: number) {
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);
  noise.connect(g);
  g.connect(ctx.destination);
  noise.start(startTime);
  noise.stop(startTime + 0.2);
}

function scheduleHihat(ctx: AudioContext, startTime: number, gain: number) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.06);
}

export default function PhonkEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const audioRef = useRef<ReturnType<typeof buildAudio> | null>(null);
  const scheduleAheadRef = useRef<number>(0);

  const [camOn, setCamOn] = useState(false);
  const [bpm, setBpm] = useState(140);
  const [gain, setGain] = useState(0.5);
  const [kickGain, setKickGain] = useState(1);
  const [snareGain, setSnareGain] = useState(0.8);
  const [hihatGain, setHihatGain] = useState(0.6);
  const [playing, setPlaying] = useState(false);
  const [fx, setFx] = useState({
    scanlines: 0,
    glitch: 0,
    chromatic: 0,
    vhs: 0,
    neon: 0,
    glow: 0,
  });
  const [overlay, setOverlay] = useState({
    type: "none",
    text: "MOGGED",
    color: "#ff0040",
  });
  const [started, setStarted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!started) return;
    audioRef.current = buildAudio();
    return () => {
      audioRef.current?.ctx.close();
    };
  }, [started]);

  const startCam = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setCamOn(true);
      setLastError(null);
    } catch (e) {
      setLastError("Camera access denied or unavailable.");
    }
  }, []);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  useEffect(() => {
    return () => stopCam();
  }, [stopCam]);

  // ---- beat scheduler ----
  const nextStepTime = 60 / bpm / 4; // 16th notes
  const playStep = useCallback(
    (tick: number, time: number) => {
      const a = audioRef.current;
      if (!a) return;
      const g = gain;
      const kg = kickGain;
      const sg = snareGain;
      const hg = hihatGain;

      // typical phonk pattern
      if (tick % 4 === 0) scheduleKick(a.ctx, time, g * kg);
      if (tick % 8 === 4) scheduleSnare(a.ctx, time, g * sg);
      if (tick % 2 === 0) scheduleHihat(a.ctx, time, g * hg * 0.6);
      if (tick % 16 === 8) scheduleHihat(a.ctx, time, g * hg * 1.2);
      if (tick % 16 === 2) scheduleHihat(a.ctx, time, g * hg * 0.4);
    },
    [bpm, gain, kickGain, snareGain, hihatGain]
  );

  useEffect(() => {
    if (!playing || !audioRef.current) return;
    const a = audioRef.current;
    let nextTick = 0;
    let timer: number;

    const scheduler = () => {
      const now = a.ctx.currentTime;
      while (scheduleAheadRef.current < now + 0.1) {
        playStep(nextTick, scheduleAheadRef.current);
        scheduleAheadRef.current += nextStepTime;
        nextTick++;
      }
      timer = requestAnimationFrame(scheduler);
    };
    scheduler();
    return () => cancelAnimationFrame(timer);
  }, [playing, playStep]);

  // ---- canvas FX loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let frame = 0;
    const loop = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const f = fx;
      frame++;

      // scanlines
      if (f.scanlines > 0) {
        ctx.fillStyle = `rgba(0,0,0,${f.scanlines * 0.35})`;
        for (let y = 0; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1);
        }
      }

      // chromatic aberration
      if (f.chromatic > 0) {
        const shift = Math.floor(f.chromatic * 12);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = f.chromatic * 0.5;
        ctx.drawImage(canvas, shift, 0);
        ctx.drawImage(canvas, -shift, 0);
        ctx.restore();
      }

      // VHS tracking lines
      if (f.vhs > 0) {
        const numLines = Math.floor(f.vhs * 6) + 1;
        for (let i = 0; i < numLines; i++) {
          const y = ((frame * 7 + i * 137) % h);
          const hh = 2 + (f.vhs * 8);
          ctx.fillStyle = `rgba(255,255,255,${f.vhs * 0.25})`;
          ctx.fillRect(0, y, w, hh);
          ctx.fillStyle = `rgba(0,0,0,${f.vhs * 0.4})`;
          ctx.fillRect(0, y + hh, w, 2);
        }
      }

      // glitch slice
      if (f.glitch > 0) {
        const sliceH = 4 + Math.floor(f.glitch * 30);
        const count = Math.floor(f.glitch * 3) + 1;
        for (let i = 0; i < count; i++) {
          const y = ((frame * 31 + i * 199) % (h - sliceH));
          const xShift = Math.floor(Math.random() * f.glitch * 60 - f.glitch * 30);
          ctx.drawImage(canvas, 0, y, w, sliceH, xShift, y, w, sliceH);
          ctx.fillStyle = `rgba(255,0,120,${f.glitch * 0.2})`;
          ctx.fillRect(0, y, w, sliceH);
        }
      }

      // neon glow edge
      if (f.neon > 0 || f.glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = (f.neon + f.glow) * 0.4;
        ctx.shadowColor = overlay.color;
        ctx.shadowBlur = 40;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
      }

      // overlay cards / mogging text
      if (overlay.type !== "none") {
        ctx.save();
        ctx.globalCompositeOperation = overlay.type === "mogging" ? "screen" : "source-over";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (overlay.type === "mogging") {
          // big glowy text card
          ctx.shadowColor = overlay.color;
          ctx.shadowBlur = 40;
          ctx.font = `bold ${Math.floor(h * 0.22)}px "Impact", "Arial Black", sans-serif`;
          ctx.fillStyle = overlay.color;
          ctx.fillText(overlay.text, w / 2, h * 0.18);

          ctx.shadowBlur = 0;
          ctx.font = `bold ${Math.floor(h * 0.05)}px monospace`;
          ctx.fillStyle = "#fff";
          ctx.fillText("PHONK LIVE", w / 2, h * 0.92);
        } else if (overlay.type === "title") {
          ctx.shadowColor = overlay.color;
          ctx.shadowBlur = 30;
          ctx.font = `bold ${Math.floor(h * 0.12)}px "Impact", sans-serif`;
          ctx.fillStyle = overlay.color;
          ctx.fillText(overlay.text, w / 2, h * 0.5);
        } else if (overlay.type === "corner") {
          ctx.font = `bold ${Math.floor(h * 0.06)}px monospace`;
          ctx.fillStyle = overlay.color;
          ctx.fillText("PHONK EDITOR", 16, h - 16);
          ctx.fillText(`${bpm} BPM`, w - 16, 16);
        }

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [fx, overlay, bpm]);

  return (
    <div className="phonk-app">
      <header className="phonk-bar">
        <div className="phonk-logo">PHONK<span className="accent">LIVE</span></div>
        <div className="phonk-tag">web live editor · webcam · phonk · anime · mogging</div>
      </header>

      {!started ? (
        <section className="start-screen">
          <div className="start-card">
            <h1 className="start-title">
              🎛️ PHONK LIVE EDITOR
            </h1>
            <p className="start-sub">
              webcam + video canvas fx + beat controls + anime/meme overlays
            </p>
            <button className="big-btn" onClick={() => setStarted(true)}>
              ENTER THE VOID
            </button>
          </div>
        </section>
      ) : (
        <main className="phonk-main">
          <section className="stage">
            <div className="stage-wrap">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="cam-feed"
              />
              <canvas ref={canvasRef} className="fx-canvas" />
              {overlay.type !== "none" && (
                <div className="overlay-badge">{overlay.type.toUpperCase()}</div>
              )}
            </div>

            <div className="cam-controls">
              {!camOn ? (
                <button className="btn primary" onClick={startCam}>
                  📷 START CAM
                </button>
              ) : (
                <button className="btn danger" onClick={stopCam}>
                  🛑 STOP CAM
                </button>
              )}
            </div>
            {lastError && <div className="error-msg">{lastError}</div>}
          </section>

          <section className="panel">
            <div className="panel-section">
              <div className="section-title">BEAT ENGINE</div>
              <div className="row">
                <label>BPM</label>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                />
                <span className="val">{bpm}</span>
              </div>
              <div className="row">
                <label>MASTER GAIN</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gain}
                  onChange={(e) => setGain(Number(e.target.value))}
                />
                <span className="val">{gain.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>KICK</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={kickGain}
                  onChange={(e) => setKickGain(Number(e.target.value))}
                />
                <span className="val">{kickGain.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>SNARE</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={snareGain}
                  onChange={(e) => setSnareGain(Number(e.target.value))}
                />
                <span className="val">{snareGain.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>HIHAT</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={hihatGain}
                  onChange={(e) => setHihatGain(Number(e.target.value))}
                />
                <span className="val">{hihatGain.toFixed(2)}</span>
              </div>
              <div className="play-row">
                <button
                  className="big-btn"
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? "⏹ STOP" : "▶ PLAY"}
                </button>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">VIDEO FX</div>
              <div className="row">
                <label>SCANLINES</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.scanlines}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, scanlines: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.scanlines.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>GLITCH</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.glitch}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, glitch: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.glitch.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>CHROMATIC</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.chromatic}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, chromatic: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.chromatic.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>VHS TRACKING</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.vhs}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, vhs: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.vhs.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>NEON GLOW</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.neon}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, neon: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.neon.toFixed(2)}</span>
              </div>
              <div className="row">
                <label>GLOW</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fx.glow}
                  onChange={(e) =>
                    setFx((f) => ({ ...f, glow: Number(e.target.value) }))
                  }
                />
                <span className="val">{fx.glow.toFixed(2)}</span>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">OVERLAY / VIBE</div>
              <div className="overlay-radio-row">
                <label className="chip">
                  <input
                    type="radio"
                    name="overlay"
                    value="none"
                    checked={overlay.type === "none"}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, type: e.target.value }))
                    }
                  />
                  none
                </label>
                <label className="chip">
                  <input
                    type="radio"
                    name="overlay"
                    value="mogging"
                    checked={overlay.type === "mogging"}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, type: e.target.value }))
                    }
                  />
                  mogging
                </label>
                <label className="chip">
                  <input
                    type="radio"
                    name="overlay"
                    value="title"
                    checked={overlay.type === "title"}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, type: e.target.value }))
                    }
                  />
                  title
                </label>
                <label className="chip">
                  <input
                    type="radio"
                    name="overlay"
                    value="corner"
                    checked={overlay.type === "corner"}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, type: e.target.value }))
                    }
                  />
                  corner
                </label>
              </div>
              <div className="row">
                <label>TEXT</label>
                <input
                  type="text"
                  value={overlay.text}
                  onChange={(e) => setOverlay((o) => ({ ...o, text: e.target.value }))}
                  className="text-input"
                  maxLength={24}
                />
              </div>
              <div className="row">
                <label>COLOR</label>
                <input
                  type="color"
                  value={overlay.color}
                  onChange={(e) =>
                    setOverlay((o) => ({ ...o, color: e.target.value }))
                  }
                  className="color-input"
                />
              </div>
              <div className="preset-row">
                <button
                  className="btn"
                  onClick={() =>
                    setFx({ scanlines: 0.6, glitch: 0.7, chromatic: 0.5, vhs: 0.8, neon: 0.4, glow: 0.3 })
                  }
                >
                  PHONK VHS
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setFx({ scanlines: 0.3, glitch: 0.2, chromatic: 0.8, vhs: 0.2, neon: 0.6, glow: 0.5 })
                  }
                >
                  ANIME NEON
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setFx({ scanlines: 0.8, glitch: 0.9, chromatic: 0.3, vhs: 0.6, neon: 0.2, glow: 0.1 })
                  }
                >
                  MOGGING
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setFx({ scanlines: 0, glitch: 0, chromatic: 0, vhs: 0, neon: 0, glow: 0 })
                  }
                >
                  RESET FX
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #05050a;
          --panel: #0c0c14;
          --line: #1c1c28;
          --text: #f0f0f5;
          --muted: #8888a0;
          --accent: #ff0040;
          --accent2: #00e5ff;
          --gold: #ffd200;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: "Segoe UI", "Arial", sans-serif;
          min-height: 100vh;
        }

        .phonk-app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .phonk-bar {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding: 12px 24px;
          background: linear-gradient(180deg, #0d0d18 0%, #05050a 100%);
          border-bottom: 1px solid var(--line);
        }

        .phonk-logo {
          font-size: 22px;
          letter-spacing: 6px;
          font-weight: 900;
          color: var(--gold);
          text-shadow: 0 0 12px var(--gold);
        }

        .phonk-logo .accent {
          color: var(--accent);
          text-shadow: 0 0 12px var(--accent);
        }

        .phonk-tag {
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 1px;
        }

        .start-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .start-card {
          text-align: center;
          padding: 40px;
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: 8px;
          max-width: 480px;
        }

        .start-title {
          font-size: 32px;
          letter-spacing: 4px;
          color: var(--gold);
          text-shadow: 0 0 16px var(--gold);
          margin-bottom: 12px;
        }

        .start-sub {
          color: var(--muted);
          margin-bottom: 24px;
        }

        .big-btn {
          background: var(--accent);
          color: #fff;
          border: none;
          padding: 14px 28px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 2px;
          cursor: pointer;
          border-radius: 4px;
          box-shadow: 0 0 20px var(--accent);
          transition: box-shadow 0.2s;
        }

        .big-btn:hover {
          box-shadow: 0 0 30px var(--accent), 0 0 60px var(--accent);
        }

        .btn {
          background: #1a1a28;
          color: var(--text);
          border: 1px solid var(--line);
          padding: 8px 14px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 1px;
        }

        .btn.primary {
          background: var(--accent2);
          color: #000;
          border-color: var(--accent2);
          box-shadow: 0 0 12px var(--accent2);
        }

        .btn.danger {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
          box-shadow: 0 0 12px var(--accent);
        }

        .btn:hover { filter: brightness(1.2); }

        .phonk-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 16px;
          padding: 16px;
        }

        .stage {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stage-wrap {
          position: relative;
          background: #000;
          border: 1px solid var(--line);
          border-radius: 4px;
          overflow: hidden;
          aspect-ratio: 4 / 3;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cam-feed, .fx-canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .fx-canvas {
          pointer-events: none;
        }

        .overlay-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0,0,0,0.6);
          color: var(--accent);
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2px;
          border: 1px solid var(--accent);
        }

        .cam-controls {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .error-msg {
          color: var(--accent);
          font-size: 12px;
          text-align: center;
        }

        .panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 14px;
          overflow-y: auto;
        }

        .panel-section {
          border-bottom: 1px solid var(--line);
          padding-bottom: 12px;
        }

        .panel-section:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .section-title {
          font-size: 11px;
          letter-spacing: 2px;
          color: var(--accent2);
          margin-bottom: 10px;
          font-weight: 700;
        }

        .row {
          display: grid;
          grid-template-columns: 100px 1fr 48px;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .row label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .row input[type="range"] {
          -webkit-appearance: none;
          background: transparent;
          width: 100%;
        }

        .row input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          background: var(--line);
          border-radius: 2px;
        }

        .row input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent2);
          margin-top: -5px;
          box-shadow: 0 0 8px var(--accent2);
          cursor: pointer;
        }

        .val {
          font-size: 12px;
          color: var(--gold);
          font-weight: 700;
          text-align: right;
        }

        .play-row {
          margin-top: 8px;
        }

        .overlay-radio-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--muted);
          cursor: pointer;
          padding: 4px 8px;
          border: 1px solid var(--line);
          border-radius: 3px;
          background: #0a0a10;
        }

        .chip input { accent-color: var(--accent2); }

        .text-input, .color-input {
          background: #0a0a10;
          border: 1px solid var(--line);
          color: var(--text);
          padding: 6px 8px;
          border-radius: 3px;
          font-size: 12px;
        }

        .color-input { width: 48px; height: 30px; padding: 2px; cursor: pointer; }

        .preset-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        @media (max-width: 820px) {
          .phonk-main {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
