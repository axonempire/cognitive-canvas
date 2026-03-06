import { useEffect, useRef } from "react";

interface Neuron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  type: "soma" | "glia" | "astrocyte";
}

interface Spike {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  active: boolean;
}

const NeuralCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const neuronCount = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000));
    const neurons: Neuron[] = [];
    const spikes: Spike[] = [];
    const connectionDist = 180;

    const types: Neuron["type"][] = ["soma", "glia", "astrocyte"];

    for (let i = 0; i < neuronCount; i++) {
      neurons.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
        type: types[Math.floor(Math.random() * types.length)],
      });
    }

    const getColor = (type: Neuron["type"], alpha: number) => {
      switch (type) {
        case "soma": return `hsla(35, 85%, 55%, ${alpha})`;
        case "glia": return `hsla(15, 70%, 58%, ${alpha})`;
        case "astrocyte": return `hsla(40, 70%, 50%, ${alpha})`;
      }
    };

    let time = 0;

    const animate = () => {
      if (!ctx || !canvas) return;
      time++;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update neurons
      for (const n of neurons) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase += n.pulseSpeed;

        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      }

      // Draw connections (dendrites/axons)
      for (let i = 0; i < neurons.length; i++) {
        for (let j = i + 1; j < neurons.length; j++) {
          const dx = neurons[i].x - neurons[j].x;
          const dy = neurons[i].y - neurons[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.12;
            ctx.beginPath();
            ctx.moveTo(neurons[i].x, neurons[i].y);
            ctx.lineTo(neurons[j].x, neurons[j].y);
            ctx.strokeStyle = `hsla(35, 60%, 45%, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Randomly spawn spikes (action potentials)
      if (time % 8 === 0 && spikes.filter(s => s.active).length < 15) {
        const fromIdx = Math.floor(Math.random() * neurons.length);
        let closest = -1;
        let closestDist = Infinity;
        for (let j = 0; j < neurons.length; j++) {
          if (j === fromIdx) continue;
          const dx = neurons[fromIdx].x - neurons[j].x;
          const dy = neurons[fromIdx].y - neurons[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < connectionDist && d < closestDist) {
            closestDist = d;
            closest = j;
          }
        }
        if (closest >= 0) {
          spikes.push({
            fromIdx,
            toIdx: closest,
            progress: 0,
            speed: 0.015 + Math.random() * 0.02,
            active: true,
          });
        }
      }

      // Draw & update spikes
      for (const spike of spikes) {
        if (!spike.active) continue;
        spike.progress += spike.speed;
        if (spike.progress >= 1) {
          spike.active = false;
          continue;
        }

        const from = neurons[spike.fromIdx];
        const to = neurons[spike.toIdx];
        const x = from.x + (to.x - from.x) * spike.progress;
        const y = from.y + (to.y - from.y) * spike.progress;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        gradient.addColorStop(0, "hsla(35, 90%, 70%, 0.8)");
        gradient.addColorStop(0.5, "hsla(35, 85%, 55%, 0.3)");
        gradient.addColorStop(1, "hsla(35, 80%, 50%, 0)");

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Clean up dead spikes
      if (time % 100 === 0) {
        const activeSpikes = spikes.filter(s => s.active);
        spikes.length = 0;
        spikes.push(...activeSpikes);
      }

      // Draw neurons (soma bodies)
      for (const n of neurons) {
        const pulse = Math.sin(n.pulsePhase) * 0.5 + 0.5;
        const alpha = 0.3 + pulse * 0.4;
        const r = n.radius + pulse * 1;

        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 6);
        glow.addColorStop(0, getColor(n.type, alpha * 0.3));
        glow.addColorStop(1, getColor(n.type, 0));
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 6, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = getColor(n.type, alpha);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default NeuralCanvas;
