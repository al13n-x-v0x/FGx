import { useState, useEffect, useCallback } from "react";
import "./index.css";

export default function App() {
  const [motion, setMotion] = useState<"idle" | "discover" | "remix" | "move">("idle");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPointer((prev) => ({ x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const cycleMotion = useCallback(() => {
    setMotion((m) => {
      const next = ["idle", "discover", "remix", "move"] as const;
      return next[(next.indexOf(m) + 1) % next.length];
    });
  }, []);

  return (
    <section className="freebuff-stage" aria-label="FREEBUFF motion ecosystem entrypoint">
      <header className="freebuff-bar">
        <div className="freebuff-brand">
          <span className="freebuff-mark" aria-hidden="true">F</span>
          <span className="freebuff-title">FREEBUFF</span>
        </div>
        <nav className="freebuff-nav" aria-label="Platform map">
          <a href="#/explore" className="freebuff-chip">Explore</a>
          <a href="#/lab" className="freebuff-chip">Lab</a>
          <a href="#/remix" className="freebuff-chip">Remix</a>
          <a href="#/discover" className="freebuff-chip">Discover</a>
        </nav>
      </header>

      <main className="freebuff-hero">
        <div
          className="freebuff-glass"
          style={{
            transform: `translate(${pointer.x * 0.02}px, ${pointer.y * 0.02}px)`,
          }}
        >
          <h1 className="freebuff-headline">
            <span className="freebuff-token">FREEBUFF</span>
            <span className="freebuff-sub">THE MOTION LIBRARY FOR THE WEB.</span>
          </h1>
          <p className="freebuff-line">
            1,000,000,000+ valid animation possibilities.
          </p>
          <p className="freebuff-line muted">
            This workspace checkpoint is the real FREEBUFF repo.
          </p>
        </div>

        <div className="freebuff-actions">
          <button
            className="freebuff-btn primary"
            onClick={cycleMotion}
            aria-pressed={motion !== "idle"}
          >
            {motion === "idle" ? "EXPLORE MOTION" : motion.toUpperCase()}
          </button>
          <button className="freebuff-btn ghost" onClick={() => setVariant(randomVariant())}>
            SURPRISE ME
          </button>
        </div>

        {variant && (
          <div className="freebuff-variant" role="status">
            <span>Variant preview</span>
            <code className="freebuff-variant-id">{variant}</code>
          </div>
        )}
      </main>

      <footer className="freebuff-foot">
        <span>Discover. Remix. Move.</span>
      </footer>
    </section>
  );
}

function randomVariant(): string {
  const nouns = ["magnetic-button", "glass-card", "text-reveal", "liquid-border", "spotlight-nav"];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const hex = Array.from({ length: 8 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)]
  ).join("");
  return `${noun}/variant/${hex}`;
}
