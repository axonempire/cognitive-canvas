import { useEffect, useRef } from "react";

interface Dendrite {
  angle: number;
  length: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmount: number;
  branches: { angle: number; length: number; swayPhase: number; swaySpeed: number; swayAmount: number; subBranches?: { angle: number; length: number }[] }[];
}

interface NeuronCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  somaRadius: number;
  pulsePhase: number;
  pulseSpeed: number;
  dendrites: Dendrite[];
  axon: { angle: number; length: number; terminals: { angle: number; length: number }[] };
  rotation: number;
  rotationSpeed: number;
  firing: boolean;
  fireProgress: number;
  fireIntensity: number;
  refractoryTimer: number;
  stimulation: number;
  stimulationDecay: number;
  layer: number; // 0=back, 1=mid, 2=front
}

interface PropagatingSpike {
  fromNeuronIdx: number;
  toNeuronIdx: number;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  progress: number;
  speed: number;
  active: boolean;
}

interface FogPatch {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  phase: number;
  phaseSpeed: number;
  excitement: number; // swells when a nearby neuron fires
  hue: number;        // 25–45 for warm amber variation
}

interface Vesicle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;           // current rendered alpha (excited = brighter)
  pulsePhase: number;
  pulseSpeed: number;
  excitement: number;      // 0–1: how much a nearby firing pushed/pulled it
}

// Layer config: scale, opacity multiplier, blur, parallax factor, count ratio
const LAYER_CONFIG = [
  { scale: 0.45, opacity: 0.25, blur: 1.5, parallax: 0.15, ratio: 0.25 },  // background - small, dim, blurry
  { scale: 1.0,  opacity: 1.0,  blur: 0,   parallax: 0.0,  ratio: 0.55 },  // mid - normal
  { scale: 1.8,  opacity: 0.30, blur: 2.5, parallax: -0.25, ratio: 0.20 },  // foreground - large, blurry
];

const NeuralCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const scrollRef = useRef(0);

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

    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const totalCount = Math.min(90, Math.max(40, Math.floor((window.innerWidth * window.innerHeight) / 15000)));
    const neurons: NeuronCell[] = [];
    const synapticSpikes: PropagatingSpike[] = [];
    const FIRE_THRESHOLD = 0.6;
    const REFRACTORY_PERIOD = 120;
    const SYNAPSE_DIST = 100;

    const randRange = (min: number, max: number) => min + Math.random() * (max - min);

    // ── Fog patch field ──────────────────────────────────────────────
    const FOG_COUNT = 14;
    const fogPatches: FogPatch[] = [];
    for (let i = 0; i < FOG_COUNT; i++) {
      fogPatches.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: randRange(-0.06, 0.06),
        vy: randRange(-0.04, 0.04),
        radius: randRange(120, 340),
        baseAlpha: randRange(0.022, 0.055),
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: randRange(0.002, 0.006),
        excitement: 0,
        hue: randRange(25, 45),
      });
    }

    // ── Vesicle / particle field ──────────────────────────────────────
    const VESICLE_COUNT = 340;
    const vesicles: Vesicle[] = [];
    for (let i = 0; i < VESICLE_COUNT; i++) {
      vesicles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: randRange(-0.12, 0.12),
        vy: randRange(-0.12, 0.12),
        radius: randRange(0.8, 2.2),
        baseAlpha: randRange(0.04, 0.14),
        alpha: 0,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: randRange(0.008, 0.022),
        excitement: 0,
      });
    }

    // Create neurons distributed across layers
    for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
      const cfg = LAYER_CONFIG[layerIdx];
      const count = Math.round(totalCount * cfg.ratio);

      for (let i = 0; i < count; i++) {
        const dendriteCount = Math.floor(randRange(3, 6));
        const dendrites: Dendrite[] = [];

        for (let d = 0; d < dendriteCount; d++) {
          const baseAngle = (d / dendriteCount) * Math.PI * 2 + randRange(-0.3, 0.3);
          const branchCount = Math.floor(randRange(2, 4));
          const branches: Dendrite["branches"][0][] = [];

          for (let b = 0; b < branchCount; b++) {
            const subBranchCount = Math.random() > 0.6 ? Math.floor(randRange(1, 3)) : 0;
            const subBranches: { angle: number; length: number }[] = [];
            for (let s = 0; s < subBranchCount; s++) {
              subBranches.push({ angle: randRange(-0.6, 0.6), length: randRange(10, 22) * cfg.scale });
            }
            branches.push({
              angle: randRange(-0.5, 0.5),
              length: randRange(15, 38) * cfg.scale,
              swayPhase: Math.random() * Math.PI * 2,
              swaySpeed: 0.003 + Math.random() * 0.006,
              swayAmount: 0.02 + Math.random() * 0.04,
              subBranches: subBranches.length > 0 ? subBranches : undefined,
            });
          }
          dendrites.push({
            angle: baseAngle,
            length: randRange(30, 55) * cfg.scale,
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: (0.002 + Math.random() * 0.004) * (layerIdx === 0 ? 0.6 : layerIdx === 2 ? 1.4 : 1),
            swayAmount: 0.015 + Math.random() * 0.03,
            branches,
          });
        }

        const avgAngle = dendrites.reduce((s, d) => s + d.angle, 0) / dendrites.length;
        const axonAngle = avgAngle + Math.PI + randRange(-0.4, 0.4);
        const terminalCount = Math.floor(randRange(3, 6));
        const terminals: { angle: number; length: number }[] = [];
        for (let t = 0; t < terminalCount; t++) {
          terminals.push({ angle: randRange(-0.8, 0.8), length: randRange(12, 30) * cfg.scale });
        }

        neurons.push({
          x: randRange(60, canvas.width - 60),
          y: randRange(60, canvas.height - 60),
          vx: randRange(-0.08, 0.08) * (layerIdx === 0 ? 0.5 : layerIdx === 2 ? 0.3 : 1),
          vy: randRange(-0.08, 0.08) * (layerIdx === 0 ? 0.5 : layerIdx === 2 ? 0.3 : 1),
          somaRadius: randRange(6, 11) * cfg.scale,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.012,
          dendrites,
          axon: { angle: axonAngle, length: randRange(60, 120) * cfg.scale, terminals },
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: randRange(-0.0003, 0.0003),
          firing: false,
          fireProgress: 0,
          fireIntensity: 0,
          refractoryTimer: 0,
          stimulation: 0,
          stimulationDecay: 0.003,
          layer: layerIdx,
        });
      }
    }

    // Helpers
    const getAxonTerminals = (n: NeuronCell) => {
      const axAngle = n.axon.angle + n.rotation;
      const axEnd = {
        x: n.x + Math.cos(axAngle) * n.axon.length,
        y: n.y + Math.sin(axAngle) * n.axon.length,
      };
      return n.axon.terminals.map(t => {
        const tAngle = axAngle + t.angle;
        return {
          x: axEnd.x + Math.cos(tAngle) * t.length,
          y: axEnd.y + Math.sin(tAngle) * t.length,
        };
      });
    };

    const getDendriteTips = (n: NeuronCell) => {
      const tips: { x: number; y: number }[] = [];
      for (const d of n.dendrites) {
        const sway = Math.sin(d.swayPhase) * d.swayAmount;
        const angle = d.angle + n.rotation + sway;
        const dx = n.x + Math.cos(angle) * d.length;
        const dy = n.y + Math.sin(angle) * d.length;
        tips.push({ x: dx, y: dy });
        for (const b of d.branches) {
          const bSway = Math.sin(b.swayPhase) * b.swayAmount;
          const bAngle = angle + b.angle + bSway;
          const bx = dx + Math.cos(bAngle) * b.length;
          const by = dy + Math.sin(bAngle) * b.length;
          tips.push({ x: bx, y: by });
          if (b.subBranches) {
            for (const sb of b.subBranches) {
              tips.push({
                x: bx + Math.cos(bAngle + sb.angle) * sb.length,
                y: by + Math.sin(bAngle + sb.angle) * sb.length,
              });
            }
          }
        }
      }
      return tips;
    };

    const drawBranch = (
      x1: number, y1: number, angle: number, length: number,
      width: number, alpha: number, fireGlow: number
    ): { x: number; y: number } => {
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;
      const cx = (x1 + x2) / 2 + Math.sin(angle) * length * 0.08;
      const cy = (y1 + y2) / 2 - Math.cos(angle) * length * 0.08;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);

      if (fireGlow > 0) {
        const r = Math.round(200 + 25 * fireGlow);
        const g = Math.round(160 + 30 * fireGlow);
        const b2 = Math.round(100 + 40 * fireGlow);
        ctx.strokeStyle = `rgba(${r},${g},${b2},${alpha + fireGlow * 0.25})`;
        ctx.lineWidth = width + fireGlow * 0.8;
      } else {
        ctx.strokeStyle = `hsla(25, 40%, 35%, ${alpha})`;
        ctx.lineWidth = width;
      }
      ctx.lineCap = "round";
      ctx.stroke();
      return { x: x2, y: y2 };
    };

    const triggerFire = (idx: number) => {
      const n = neurons[idx];
      if (n.firing || n.refractoryTimer > 0) return;
      n.firing = true;
      n.fireProgress = 0;
      n.fireIntensity = 1;
      n.stimulation = 0;
    };

    let time = 0;

    // Draw a single neuron (extracted for layer rendering)
    const drawNeuron = (n: NeuronCell, ni: number, opacityMult: number) => {
      const pulse = Math.sin(n.pulsePhase) * 0.5 + 0.5;
      const baseAlpha = (0.2 + pulse * 0.15) * opacityMult;

      const somaFire = n.firing ? Math.max(0, 1 - Math.abs(n.fireProgress - 0.15) * 5) : 0;
      const axonFire = n.firing ? Math.max(0, Math.min((n.fireProgress - 0.2) * 3, 1) * (1 - Math.max(0, (n.fireProgress - 0.8) * 5))) : 0;
      const terminalFire = n.firing ? Math.max(0, (n.fireProgress - 0.7) * 3.3) : 0;

      const dendGlow = Math.min(n.stimulation, 1) * 0.5;
      for (const d of n.dendrites) {
        d.swayPhase += d.swaySpeed;
        const sway = Math.sin(d.swayPhase) * d.swayAmount;
        const angle = d.angle + n.rotation + sway;
        const tip = drawBranch(n.x, n.y, angle, d.length, 1.3, baseAlpha * 0.6 + dendGlow * 0.3, dendGlow);

        for (const b of d.branches) {
          b.swayPhase += b.swaySpeed;
          const bSway = Math.sin(b.swayPhase) * b.swayAmount;
          const bAngle = angle + b.angle + bSway;
          const bTip = drawBranch(tip.x, tip.y, bAngle, b.length, 0.8, baseAlpha * 0.45 + dendGlow * 0.2, dendGlow * 0.7);
          if (b.subBranches) {
            for (const sb of b.subBranches) {
              drawBranch(bTip.x, bTip.y, bAngle + sb.angle, sb.length, 0.4, baseAlpha * 0.3, dendGlow * 0.4);
            }
          }
          ctx.beginPath();
          ctx.arc(bTip.x, bTip.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(35, 60%, 50%, ${baseAlpha * 0.4})`;
          ctx.fill();
        }
      }

      // Axon
      const axAngle = n.axon.angle + n.rotation;
      const axEnd = {
        x: n.x + Math.cos(axAngle) * n.axon.length,
        y: n.y + Math.sin(axAngle) * n.axon.length,
      };
      const axMid = {
        x: (n.x + axEnd.x) / 2 + Math.sin(axAngle) * n.axon.length * 0.06,
        y: (n.y + axEnd.y) / 2 - Math.cos(axAngle) * n.axon.length * 0.06,
      };

      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.quadraticCurveTo(axMid.x, axMid.y, axEnd.x, axEnd.y);
      if (axonFire > 0) {
        ctx.strokeStyle = `rgba(${200 + 20 * axonFire}, ${165 + 25 * axonFire}, ${120 + 30 * axonFire}, ${baseAlpha * 0.5 + axonFire * 0.25})`;
        ctx.lineWidth = 1.6 + axonFire * 1;
      } else {
        ctx.strokeStyle = `hsla(35, 70%, 50%, ${baseAlpha * 0.4})`;
        ctx.lineWidth = 1.5;
      }
      ctx.lineCap = "round";
      ctx.stroke();

      // Fire flash along axon
      if (n.firing && n.fireProgress > 0.2 && n.fireProgress < 0.9) {
        const t = Math.min(1, (n.fireProgress - 0.2) / 0.6);
        const fx = (1 - t) * (1 - t) * n.x + 2 * (1 - t) * t * axMid.x + t * t * axEnd.x;
        const fy = (1 - t) * (1 - t) * n.y + 2 * (1 - t) * t * axMid.y + t * t * axEnd.y;

        const flashGlow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10);
        flashGlow.addColorStop(0, `rgba(230,200,140,${0.4 * opacityMult})`);
        flashGlow.addColorStop(0.4, `rgba(210,175,120,${0.15 * opacityMult})`);
        flashGlow.addColorStop(1, `rgba(200,160,90,0)`);
        ctx.beginPath();
        ctx.arc(fx, fy, 10, 0, Math.PI * 2);
        ctx.fillStyle = flashGlow;
        ctx.fill();
      }

      // Myelin sheath
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.quadraticCurveTo(axMid.x, axMid.y, axEnd.x, axEnd.y);
      ctx.strokeStyle = `hsla(35, 50%, 45%, ${baseAlpha * 0.15})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Axon terminals
      for (const t of n.axon.terminals) {
        const tAngle = axAngle + t.angle;
        const tx = axEnd.x + Math.cos(tAngle) * t.length;
        const ty = axEnd.y + Math.sin(tAngle) * t.length;

        ctx.beginPath();
        ctx.moveTo(axEnd.x, axEnd.y);
        ctx.lineTo(tx, ty);
        const tFire = terminalFire;
        if (tFire > 0) {
          ctx.strokeStyle = `rgba(220, 190, 140, ${baseAlpha * 0.4 + tFire * 0.25})`;
          ctx.lineWidth = 0.7 + tFire * 0.8;
        } else {
          ctx.strokeStyle = `hsla(35, 60%, 50%, ${baseAlpha * 0.35})`;
          ctx.lineWidth = 0.7;
        }
        ctx.stroke();

        // Synaptic bouton
        ctx.beginPath();
        ctx.arc(tx, ty, 1.8 + tFire * 1.2, 0, Math.PI * 2);
        if (tFire > 0) {
          const boutonGlow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 3 + tFire * 2);
          boutonGlow.addColorStop(0, `rgba(230,200,140,${tFire * 0.4})`);
          boutonGlow.addColorStop(0.5, `rgba(210,180,120,${tFire * 0.2})`);
          boutonGlow.addColorStop(1, `rgba(200,160,80,0)`);
          ctx.fillStyle = boutonGlow;
        } else {
          ctx.fillStyle = `hsla(35, 80%, 55%, ${baseAlpha * 0.5})`;
        }
        ctx.fill();
      }

      // Soma glow
      const somaGlowRadius = n.somaRadius * 3 + somaFire * 5;
      const sg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, somaGlowRadius);
      if (somaFire > 0) {
        sg.addColorStop(0, `rgba(230,200,140,${somaFire * 0.15 * opacityMult})`);
        sg.addColorStop(0.5, `rgba(210,170,100,${somaFire * 0.06 * opacityMult})`);
      } else {
        sg.addColorStop(0, `hsla(35, 80%, 55%, ${baseAlpha * 0.12})`);
      }
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(n.x, n.y, somaGlowRadius, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();

      // Soma body
      const sr = n.somaRadius + somaFire * 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, sr, 0, Math.PI * 2);
      const somaGrad = ctx.createRadialGradient(
        n.x - sr * 0.3, n.y - sr * 0.3, 0, n.x, n.y, sr
      );
      if (somaFire > 0) {
        somaGrad.addColorStop(0, `rgba(230,210,160,${(0.4 + somaFire * 0.2) * opacityMult})`);
        somaGrad.addColorStop(0.5, `rgba(210,175,110,${(0.35 + somaFire * 0.15) * opacityMult})`);
        somaGrad.addColorStop(1, `rgba(180,140,80,${(0.25 + somaFire * 0.1) * opacityMult})`);
      } else {
        somaGrad.addColorStop(0, `hsla(35, 70%, 60%, ${baseAlpha * 0.7})`);
        somaGrad.addColorStop(0.7, `hsla(30, 60%, 45%, ${baseAlpha * 0.5})`);
        somaGrad.addColorStop(1, `hsla(25, 50%, 35%, ${baseAlpha * 0.35})`);
      }
      ctx.fillStyle = somaGrad;
      ctx.fill();

      // Nucleus
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.somaRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = somaFire > 0
        ? `rgba(220,190,140,${(0.2 + somaFire * 0.15) * opacityMult})`
        : `hsla(30, 50%, 40%, ${baseAlpha * 0.45})`;
      ctx.fill();
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scrollY = scrollRef.current;

      // Spontaneous random firing
      if (time % 40 === 0) {
        const idx = Math.floor(Math.random() * neurons.length);
        if (!neurons[idx].firing && neurons[idx].refractoryTimer <= 0) {
          triggerFire(idx);
        }
      }

      // Update all neurons (physics + firing)
      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase += n.pulseSpeed;
        n.rotation += n.rotationSpeed;

        const margin = 80;
        if (n.x < margin) n.vx += 0.005;
        if (n.x > canvas.width - margin) n.vx -= 0.005;
        if (n.y < margin) n.vy += 0.005;
        if (n.y > canvas.height - margin) n.vy -= 0.005;
        n.vx *= 0.999;
        n.vy *= 0.999;

        if (n.refractoryTimer > 0) n.refractoryTimer--;
        if (n.stimulation > 0) {
          n.stimulation -= n.stimulationDecay;
          if (n.stimulation < 0) n.stimulation = 0;
        }
        if (!n.firing && n.refractoryTimer <= 0 && n.stimulation >= FIRE_THRESHOLD) {
          triggerFire(i);
        }

        if (n.firing) {
          n.fireProgress += 0.012;
          if (n.fireProgress >= 1.3) {
            n.firing = false;
            n.fireProgress = 0;
            n.fireIntensity = 0;
            n.refractoryTimer = REFRACTORY_PERIOD;

            // Only mid-layer neurons propagate synaptic spikes
            if (n.layer === 1) {
              const terminals = getAxonTerminals(n);
              for (let j = 0; j < neurons.length; j++) {
                if (j === i || neurons[j].layer !== 1) continue;
                const tips = getDendriteTips(neurons[j]);
                let connected = false;
                for (const term of terminals) {
                  for (const tip of tips) {
                    const dx = term.x - tip.x;
                    const dy = term.y - tip.y;
                    if (Math.sqrt(dx * dx + dy * dy) < SYNAPSE_DIST && !connected) {
                      synapticSpikes.push({
                        fromNeuronIdx: i,
                        toNeuronIdx: j,
                        fromPoint: { ...term },
                        toPoint: { ...tip },
                        progress: 0,
                        speed: 0.02 + Math.random() * 0.015,
                        active: true,
                      });
                      connected = true;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Update synaptic spikes
      for (const spike of synapticSpikes) {
        if (!spike.active) continue;
        spike.progress += spike.speed;
        if (spike.progress >= 1) {
          spike.active = false;
          const target = neurons[spike.toNeuronIdx];
          if (target) {
            target.stimulation += 0.25 + Math.random() * 0.15;
          }
        }
      }

      if (time % 80 === 0) {
        const active = synapticSpikes.filter(s => s.active);
        synapticSpikes.length = 0;
        synapticSpikes.push(...active);
      }

      // ── Update vesicles ───────────────────────────────────────────
      const VESICLE_INFLUENCE_RADIUS = 90;
      const PUSH_STRENGTH = 0.28;
      const PULL_STRENGTH = 0.12;

      for (const v of vesicles) {
        v.pulsePhase += v.pulseSpeed;
        if (v.excitement > 0) v.excitement *= 0.96;

        // React to firing neurons
        for (const n of neurons) {
          if (!n.firing) continue;
          const dx = v.x - n.x;
          const dy = v.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < VESICLE_INFLUENCE_RADIUS * VESICLE_INFLUENCE_RADIUS) {
            const dist = Math.sqrt(distSq);
            const norm = dist > 0.001 ? 1 / dist : 0;
            const t = n.fireProgress; // 0–1.3

            if (t < 0.5) {
              // Early firing: draw vesicles toward soma (suction / depolarisation)
              const strength = PULL_STRENGTH * (1 - distSq / (VESICLE_INFLUENCE_RADIUS * VESICLE_INFLUENCE_RADIUS));
              v.vx -= dx * norm * strength;
              v.vy -= dy * norm * strength;
            } else {
              // Late firing: blast vesicles outward (exocytosis wave)
              const strength = PUSH_STRENGTH * (1 - distSq / (VESICLE_INFLUENCE_RADIUS * VESICLE_INFLUENCE_RADIUS));
              v.vx += dx * norm * strength;
              v.vy += dy * norm * strength;
            }
            v.excitement = Math.min(1, v.excitement + 0.35);
          }
        }

        // Passive drift
        v.x += v.vx;
        v.y += v.vy;

        // Soft velocity cap + drag
        const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
        if (speed > 1.6) {
          v.vx = (v.vx / speed) * 1.6;
          v.vy = (v.vy / speed) * 1.6;
        }
        v.vx *= 0.985;
        v.vy *= 0.985;

        // Tiny brownian nudge to keep things lively
        v.vx += randRange(-0.015, 0.015);
        v.vy += randRange(-0.015, 0.015);

        // Wrap around canvas edges
        if (v.x < -10) v.x = canvas.width + 10;
        if (v.x > canvas.width + 10) v.x = -10;
        if (v.y < -10) v.y = canvas.height + 10;
        if (v.y > canvas.height + 10) v.y = -10;

        // Compute current alpha (pulse + excitement boost)
        const pulse = Math.sin(v.pulsePhase) * 0.35 + 0.65;
        v.alpha = v.baseAlpha * pulse * (1 + v.excitement * 2.5);
      }

      // ── Update fog patches ────────────────────────────────────────
      const FOG_INFLUENCE_RADIUS = 220;
      for (const f of fogPatches) {
        f.phase += f.phaseSpeed;
        if (f.excitement > 0) f.excitement *= 0.992;

        // Swell near firing neurons
        for (const n of neurons) {
          if (!n.firing || n.layer !== 1) continue;
          const dx = f.x - n.x;
          const dy = f.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < FOG_INFLUENCE_RADIUS * FOG_INFLUENCE_RADIUS) {
            f.excitement = Math.min(1, f.excitement + 0.08);
            // Drift toward the firing neuron slowly
            const dist = Math.sqrt(distSq) + 0.001;
            f.vx -= (dx / dist) * 0.018;
            f.vy -= (dy / dist) * 0.018;
          }
        }

        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.998;
        f.vy *= 0.998;
        // Tiny brownian drift
        f.vx += randRange(-0.008, 0.008);
        f.vy += randRange(-0.005, 0.005);
        // Soft wrap
        if (f.x < -f.radius) f.x = canvas.width + f.radius;
        if (f.x > canvas.width + f.radius) f.x = -f.radius;
        if (f.y < -f.radius) f.y = canvas.height + f.radius;
        if (f.y > canvas.height + f.radius) f.y = -f.radius;

        const breathe = Math.sin(f.phase) * 0.3 + 0.7;
        f.alpha = f.baseAlpha * breathe * (1 + f.excitement * 1.8);
      }

      // === RENDER LAYERS ===
      // Layer 0: Background (blurred, parallax up)
      // Layer 1: Mid (normal, no parallax)
      // Layer 2: Foreground (blurred, parallax down)

      for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
        const cfg = LAYER_CONFIG[layerIdx];
        const parallaxOffset = scrollY * cfg.parallax;

        ctx.save();
        ctx.translate(0, parallaxOffset);
        if (cfg.blur > 0) ctx.filter = `blur(${cfg.blur}px)`;

        // ── Draw vesicles behind background layer (before layer 0) ──
        if (layerIdx === 0) {
          ctx.save();
          ctx.filter = "blur(0.6px)";
          for (const v of vesicles) {
            const r = v.radius + v.excitement * 1.2;
            const excited = v.excitement > 0.05;

            if (excited) {
              // Glowing halo on excited vesicles
              const halo = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r * 5);
              halo.addColorStop(0, `hsla(38, 85%, 68%, ${v.alpha * 0.6})`);
              halo.addColorStop(0.5, `hsla(32, 70%, 55%, ${v.alpha * 0.2})`);
              halo.addColorStop(1, `hsla(28, 60%, 45%, 0)`);
              ctx.beginPath();
              ctx.arc(v.x, v.y, r * 5, 0, Math.PI * 2);
              ctx.fillStyle = halo;
              ctx.fill();
            }

            // Core dot — resting: cool blue-grey tint; excited: warm amber
            const coreColor = excited
              ? `hsla(38, 80%, 70%, ${v.alpha})`
              : `hsla(200, 30%, 70%, ${v.alpha * 0.7})`;

            ctx.beginPath();
            ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
            ctx.fillStyle = coreColor;
            ctx.fill();
          }
          ctx.restore();
        }

        // Draw synaptic connections only for mid layer
        if (layerIdx === 1) {
          const midIndices = neurons.reduce<number[]>((acc, n, i) => { if (n.layer === 1) acc.push(i); return acc; }, []);

          for (const i of midIndices) {
            const terminals = getAxonTerminals(neurons[i]);
            for (const j of midIndices) {
              if (i === j) continue;
              const tips = getDendriteTips(neurons[j]);
              for (const term of terminals) {
                for (const tip of tips) {
                  const dx = term.x - tip.x;
                  const dy = term.y - tip.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < SYNAPSE_DIST) {
                    const alpha = (1 - dist / SYNAPSE_DIST) * 0.06;
                    ctx.beginPath();
                    ctx.moveTo(term.x, term.y);
                    const mx = (term.x + tip.x) / 2;
                    const my = (term.y + tip.y) / 2 - dist * 0.12;
                    ctx.quadraticCurveTo(mx, my, tip.x, tip.y);
                    ctx.strokeStyle = `hsla(35, 40%, 45%, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.setLineDash([2, 3]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                  }
                }
              }
            }
          }

          // Synaptic spike visuals
          for (const spike of synapticSpikes) {
            if (!spike.active) continue;
            const { fromPoint: fp, toPoint: tp } = spike;
            const dx = tp.x - fp.x;
            const dy = tp.y - fp.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const mx = (fp.x + tp.x) / 2;
            const my = (fp.y + tp.y) / 2 - dist * 0.12;
            const t = spike.progress;
            const x = (1 - t) * (1 - t) * fp.x + 2 * (1 - t) * t * mx + t * t * tp.x;
            const y = (1 - t) * (1 - t) * fp.y + 2 * (1 - t) * t * my + t * t * tp.y;

            const fadeIn = Math.min(t * 5, 1);
            const fadeOut = Math.min((1 - t) * 5, 1);
            const alpha = fadeIn * fadeOut;

            const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
            glow.addColorStop(0, `hsla(35, 50%, 75%, ${alpha * 0.35})`);
            glow.addColorStop(0.5, `hsla(30, 45%, 60%, ${alpha * 0.15})`);
            glow.addColorStop(1, `hsla(30, 50%, 50%, 0)`);
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            const core = ctx.createRadialGradient(x, y, 0, x, y, 2);
            core.addColorStop(0, `rgba(230,200,150,${alpha * 0.5})`);
            core.addColorStop(1, `rgba(220,180,120,0)`);
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = core;
            ctx.fill();
          }
        }

        // Draw neurons for this layer
        for (let ni = 0; ni < neurons.length; ni++) {
          if (neurons[ni].layer !== layerIdx) continue;
          drawNeuron(neurons[ni], ni, cfg.opacity);
        }

        ctx.restore();
      }

      // ── Render fog patches (screen-space overlay, behind vignette) ─
      ctx.save();
      ctx.filter = "blur(28px)";
      for (const f of fogPatches) {
        const r = f.radius * (1 + f.excitement * 0.25);
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0,   `hsla(${f.hue}, 75%, 55%, ${f.alpha})`);
        grad.addColorStop(0.35, `hsla(${f.hue - 5}, 65%, 45%, ${f.alpha * 0.55})`);
        grad.addColorStop(0.7,  `hsla(${f.hue - 10}, 50%, 35%, ${f.alpha * 0.2})`);
        grad.addColorStop(1,    `hsla(20, 30%, 20%, 0)`);
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();

      // ── Dark vignette — peering-through-tissue lens effect ───────
      ctx.save();
      const vw = canvas.width;
      const vh = canvas.height;
      const vignette = ctx.createRadialGradient(
        vw / 2, vh / 2, vh * 0.18,
        vw / 2, vh / 2, vh * 0.85
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(0.55, "rgba(0,0,0,0.08)");
      vignette.addColorStop(0.8,  "rgba(4,2,1,0.38)");
      vignette.addColorStop(1,    "rgba(6,3,1,0.72)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
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
