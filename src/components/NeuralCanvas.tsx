import { useEffect, useRef } from "react";

interface Dendrite {
  angle: number;
  length: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmount: number;
  curve1: number;
  curve2: number;
  branches: { angle: number; length: number; swayPhase: number; swaySpeed: number; swayAmount: number; curve1: number; curve2: number; subBranches?: { angle: number; length: number; curve1: number; curve2: number }[] }[];
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
  axon: { angle: number; length: number; curve1: number; curve2: number; terminals: { angle: number; length: number; curve1: number; curve2: number }[] };
  rotation: number;
  rotationSpeed: number;
  firing: boolean;
  fireProgress: number;
  fireIntensity: number;
  refractoryTimer: number;
  stimulation: number;
  stimulationDecay: number;
  layer: number;
  cursorGlow: number;
}

interface PropagatingSpike {
  fromNeuronIdx: number;
  toNeuronIdx: number;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
  progress: number;
  speed: number;
  active: boolean;
  trailPoints: { x: number; y: number }[];
}

interface SynapticTrail {
  points: { x: number; y: number }[];
  alpha: number;
  fadeSpeed: number;
  hue: number;
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
  excitement: number;
  hue: number;
}

interface Vesicle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
  excitement: number;
}

const LAYER_CONFIG = [
  { scale: 0.45, opacity: 0.25, blur: 0, parallax: 0, ratio: 0.25 },
  { scale: 1.0,  opacity: 1.0,  blur: 0, parallax: 0, ratio: 0.55 },
  { scale: 1.8,  opacity: 0.30, blur: 0, parallax: 0, ratio: 0.20 },
];

const NeuralCanvas = () => {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animationRef  = useRef<number>(0);
  const scrollRef     = useRef(0);
  const mouseRef      = useRef({ x: -9999, y: -9999 });
  const clickQueueRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onScroll    = () => { scrollRef.current = window.scrollY; };
    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onClick     = () => { clickQueueRef.current = true; };

    window.addEventListener("scroll",    onScroll,    { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("click",     onClick);

    // ── Pre-generate organic noise canvas ────────────────────────────
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width  = 256;
    noiseCanvas.height = 256;
    const noiseCTX = noiseCanvas.getContext("2d");
    if (noiseCTX) {
      const imgData = noiseCTX.createImageData(256, 256);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.random() * 255;
        imgData.data[i]   = Math.min(255, v * 1.18);
        imgData.data[i+1] = Math.min(255, v * 0.82);
        imgData.data[i+2] = Math.min(255, v * 0.50);
        imgData.data[i+3] = v * 0.48;
      }
      noiseCTX.putImageData(imgData, 0, 0);
    }
    // Cache the pattern once instead of recreating every frame
    const cachedNoisePattern = ctx.createPattern(noiseCanvas, "repeat");
    let noiseTime = 0;

    const totalCount = Math.min(90, Math.max(40, Math.floor((window.innerWidth * window.innerHeight) / 15000)));
    const neurons: NeuronCell[] = [];
    const synapticSpikes: PropagatingSpike[] = [];
    const synapticTrails: SynapticTrail[] = [];
    const FIRE_THRESHOLD  = 0.65;
    const REFRACTORY_PERIOD = 170;
    const SYNAPSE_DIST    = 100;
    const SYNAPSE_DIST_SQ = SYNAPSE_DIST * SYNAPSE_DIST;

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

    // ── Vesicle / particle field (reduced count) ─────────────────────
    const VESICLE_COUNT = 180; // was 340
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
      const cfg   = LAYER_CONFIG[layerIdx];
      const count = Math.round(totalCount * cfg.ratio);

      for (let i = 0; i < count; i++) {
        const dendriteCount = Math.floor(randRange(3, 6));
        const dendrites: Dendrite[] = [];

        for (let d = 0; d < dendriteCount; d++) {
          const baseAngle   = (d / dendriteCount) * Math.PI * 2 + randRange(-0.3, 0.3);
          const branchCount = Math.floor(randRange(2, 4));
          const branches: Dendrite["branches"][0][] = [];

          for (let b = 0; b < branchCount; b++) {
            const subBranchCount = Math.random() > 0.6 ? Math.floor(randRange(1, 3)) : 0;
            const subBranches: { angle: number; length: number; curve1: number; curve2: number }[] = [];
            for (let s = 0; s < subBranchCount; s++) {
              subBranches.push({
                angle: randRange(-0.6, 0.6),
                length: randRange(10, 22) * cfg.scale,
                curve1: randRange(-0.18, 0.18),
                curve2: randRange(-0.12, 0.12),
              });
            }
            branches.push({
              angle:       randRange(-0.5, 0.5),
              length:      randRange(15, 38) * cfg.scale,
              swayPhase:   Math.random() * Math.PI * 2,
              swaySpeed:   0.003 + Math.random() * 0.006,
              swayAmount:  0.02 + Math.random() * 0.04,
              curve1:      randRange(-0.22, 0.22),
              curve2:      randRange(-0.15, 0.15),
              subBranches: subBranches.length > 0 ? subBranches : undefined,
            });
          }
          dendrites.push({
            angle:      baseAngle,
            length:     randRange(30, 55) * cfg.scale,
            swayPhase:  Math.random() * Math.PI * 2,
            swaySpeed:  (0.002 + Math.random() * 0.004) * (layerIdx === 0 ? 0.6 : layerIdx === 2 ? 1.4 : 1),
            swayAmount: 0.015 + Math.random() * 0.03,
            curve1:     randRange(-0.25, 0.25),
            curve2:     randRange(-0.18, 0.18),
            branches,
          });
        }

        const avgAngle     = dendrites.reduce((s, d) => s + d.angle, 0) / dendrites.length;
        const axonAngle    = avgAngle + Math.PI + randRange(-0.4, 0.4);
        const terminalCount = Math.floor(randRange(3, 6));
        const terminals: { angle: number; length: number; curve1: number; curve2: number }[] = [];
        for (let t = 0; t < terminalCount; t++) {
          terminals.push({
            angle: randRange(-0.8, 0.8),
            length: randRange(12, 30) * cfg.scale,
            curve1: randRange(-0.2, 0.2),
            curve2: randRange(-0.15, 0.15),
          });
        }

        neurons.push({
          x: randRange(60, canvas.width  - 60),
          y: randRange(60, canvas.height - 60),
          vx: randRange(-0.08, 0.08) * (layerIdx === 0 ? 0.5 : layerIdx === 2 ? 0.3 : 1),
          vy: randRange(-0.08, 0.08) * (layerIdx === 0 ? 0.5 : layerIdx === 2 ? 0.3 : 1),
          somaRadius:       randRange(6, 11) * cfg.scale,
          pulsePhase:       Math.random() * Math.PI * 2,
          pulseSpeed:       0.008 + Math.random() * 0.012,
          dendrites,
          axon: { angle: axonAngle, length: randRange(60, 120) * cfg.scale, curve1: randRange(-0.18, 0.18), curve2: randRange(-0.12, 0.12), terminals },
          rotation:         Math.random() * Math.PI * 2,
          rotationSpeed:    randRange(-0.0003, 0.0003),
          firing:           false,
          fireProgress:     0,
          fireIntensity:    0,
          refractoryTimer:  0,
          stimulation:      0,
          stimulationDecay: 0.003,
          layer:            layerIdx,
          cursorGlow:       0,
        });
      }
    }

    // ── Pre-compute mid-layer indices ────────────────────────────────
    const midIndices: number[] = [];
    for (let i = 0; i < neurons.length; i++) {
      if (neurons[i].layer === 1) midIndices.push(i);
    }

    // ── Helpers ───────────────────────────────────────────────────────
    const getAxonTerminals = (n: NeuronCell) => {
      const axAngle = n.axon.angle + n.rotation;
      const cosA = Math.cos(axAngle);
      const sinA = Math.sin(axAngle);
      const axEndX = n.x + cosA * n.axon.length;
      const axEndY = n.y + sinA * n.axon.length;
      return n.axon.terminals.map(t => {
        const tAngle = axAngle + t.angle;
        return {
          x: axEndX + Math.cos(tAngle) * t.length,
          y: axEndY + Math.sin(tAngle) * t.length,
        };
      });
    };

    const getDendriteTips = (n: NeuronCell) => {
      const tips: { x: number; y: number }[] = [];
      for (const d of n.dendrites) {
        const sway  = Math.sin(d.swayPhase) * d.swayAmount;
        const angle = d.angle + n.rotation + sway;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const dx    = n.x + cosA * d.length;
        const dy    = n.y + sinA * d.length;
        tips.push({ x: dx, y: dy });
        for (const b of d.branches) {
          const bSway  = Math.sin(b.swayPhase) * b.swayAmount;
          const bAngle = angle + b.angle + bSway;
          const bCos = Math.cos(bAngle);
          const bSin = Math.sin(bAngle);
          const bx     = dx + bCos * b.length;
          const by     = dy + bSin * b.length;
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
      width: number, alpha: number, fireGlow: number,
      curve1: number, curve2: number
    ): { x: number; y: number } => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x2 = x1 + cosA * length;
      const y2 = y1 + sinA * length;
      // Cubic Bezier with two asymmetric control points → organic, wandering curve.
      const nx = sinA, ny = -cosA; // unit normal
      const c1x = x1 + cosA * length * 0.33 + nx * length * curve1;
      const c1y = y1 + sinA * length * 0.33 + ny * length * curve1;
      const c2x = x1 + cosA * length * 0.66 + nx * length * curve2;
      const c2y = y1 + sinA * length * 0.66 + ny * length * curve2;

      // Base stroke — slightly thicker, lower alpha → suggests taper underneath
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
      const baseColor = fireGlow > 0
        ? `rgba(${Math.round(200 + 25 * fireGlow)},${Math.round(160 + 30 * fireGlow)},${Math.round(100 + 40 * fireGlow)},${(alpha + fireGlow * 0.25) * 0.55})`
        : `hsla(25, 38%, 32%, ${alpha * 0.6})`;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth   = width + 0.7 + fireGlow * 0.5;
      ctx.lineCap     = "round";
      ctx.stroke();

      // Crisp inner stroke — the visible neurite line, with stronger color
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
      if (fireGlow > 0) {
        const r  = Math.round(210 + 25 * fireGlow);
        const g  = Math.round(170 + 30 * fireGlow);
        const b2 = Math.round(110 + 40 * fireGlow);
        ctx.strokeStyle = `rgba(${r},${g},${b2},${alpha + fireGlow * 0.25})`;
        ctx.lineWidth   = width + fireGlow * 0.8;
      } else {
        ctx.strokeStyle = `hsla(28, 48%, 42%, ${alpha})`;
        ctx.lineWidth   = width;
      }
      ctx.stroke();

      // Tapered tip — redraw the last third with a thinner stroke for organic narrowing.
      const mx = 0.512 * x1 + 3 * 0.16 * 0.64 * c1x + 3 * 0.4 * 0.36 * c2x + 0.064 * x2;
      const my = 0.512 * y1 + 3 * 0.16 * 0.64 * c1y + 3 * 0.4 * 0.36 * c2y + 0.064 * y2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(c2x, c2y, x2, y2);
      ctx.strokeStyle = fireGlow > 0
        ? `rgba(230,195,140,${(alpha + fireGlow * 0.2) * 0.9})`
        : `hsla(32, 55%, 48%, ${alpha * 0.85})`;
      ctx.lineWidth = Math.max(0.3, width * 0.55);
      ctx.stroke();

      return { x: x2, y: y2 };
    };

    const triggerFire = (idx: number) => {
      const n = neurons[idx];
      if (n.firing || n.refractoryTimer > 0) return;
      n.firing       = true;
      n.fireProgress = 0;
      n.fireIntensity = 1;
      n.stimulation  = 0;
    };

    let time = 0;

    // ── Cached synapse connections (recomputed every N frames) ────────
    interface SynapseConnection {
      fromIdx: number;
      toIdx: number;
      termX: number;
      termY: number;
      tipX: number;
      tipY: number;
      dist: number;
    }
    let cachedSynapses: SynapseConnection[] = [];
    let synapseUpdateCounter = 0;
    const SYNAPSE_UPDATE_INTERVAL = 30; // recompute every 30 frames

    const recomputeSynapseConnections = () => {
      cachedSynapses = [];
      for (const i of midIndices) {
        const terminals = getAxonTerminals(neurons[i]);
        for (const j of midIndices) {
          if (i === j) continue;
          // Quick bounding-box pre-check (neurons too far apart)
          const ndx = neurons[i].x - neurons[j].x;
          const ndy = neurons[i].y - neurons[j].y;
          if (ndx * ndx + ndy * ndy > 90000) continue; // 300px max possible reach

          const tips = getDendriteTips(neurons[j]);
          for (const term of terminals) {
            for (const tip of tips) {
              const dx = term.x - tip.x;
              const dy = term.y - tip.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < SYNAPSE_DIST_SQ) {
                cachedSynapses.push({
                  fromIdx: i, toIdx: j,
                  termX: term.x, termY: term.y,
                  tipX: tip.x, tipY: tip.y,
                  dist: Math.sqrt(distSq),
                });
              }
            }
          }
        }
      }
    };

    // ── Offscreen fog canvas (updated less frequently) ───────────────
    const fogCanvas = document.createElement("canvas");
    const fogCtx = fogCanvas.getContext("2d");
    let fogDirty = true;
    let fogUpdateCounter = 0;
    const FOG_UPDATE_INTERVAL = 4; // update fog every 4 frames

    const renderFogOffscreen = () => {
      if (!fogCtx) return;
      fogCanvas.width = canvas.width;
      fogCanvas.height = canvas.height;
      fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
      for (const f of fogPatches) {
        const r    = f.radius * (1 + f.excitement * 0.25);
        const grad = fogCtx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0,    `hsla(${f.hue}, 75%, 55%, ${f.alpha})`);
        grad.addColorStop(0.35, `hsla(${f.hue - 5}, 65%, 45%, ${f.alpha * 0.55})`);
        grad.addColorStop(0.7,  `hsla(${f.hue - 10}, 50%, 35%, ${f.alpha * 0.2})`);
        grad.addColorStop(1,    `hsla(20, 30%, 20%, 0)`);
        fogCtx.beginPath();
        fogCtx.arc(f.x, f.y, r, 0, Math.PI * 2);
        fogCtx.fillStyle = grad;
        fogCtx.fill();
      }
    };

    // Pre-generate vignette as offscreen canvas (never changes unless resized)
    let vignetteCanvas = document.createElement("canvas");
    let vignetteNeedsRender = true;
    const renderVignette = () => {
      vignetteCanvas.width = canvas.width;
      vignetteCanvas.height = canvas.height;
      const vCtx = vignetteCanvas.getContext("2d");
      if (!vCtx) return;
      const vw = canvas.width;
      const vh = canvas.height;
      const vignette = vCtx.createRadialGradient(
        vw / 2, vh / 2, vh * 0.18,
        vw / 2, vh / 2, vh * 0.85
      );
      vignette.addColorStop(0,    "rgba(0,0,0,0)");
      vignette.addColorStop(0.55, "rgba(0,0,0,0.08)");
      vignette.addColorStop(0.8,  "rgba(4,2,1,0.38)");
      vignette.addColorStop(1,    "rgba(6,3,1,0.72)");
      vCtx.fillStyle = vignette;
      vCtx.fillRect(0, 0, vw, vh);
      vignetteNeedsRender = false;
    };

    const origResize = resize;
    const resizeWithCaches = () => {
      origResize();
      vignetteNeedsRender = true;
      fogDirty = true;
    };
    window.removeEventListener("resize", resize);
    window.addEventListener("resize", resizeWithCaches);

    // ── Draw a single neuron ──────────────────────────────────────────
    const drawNeuron = (n: NeuronCell, opacityMult: number) => {
      const pulse     = Math.sin(n.pulsePhase) * 0.5 + 0.5;
      const baseAlpha = (0.2 + pulse * 0.15) * opacityMult;

      const somaFire     = n.firing ? Math.max(0, 1 - Math.abs(n.fireProgress - 0.15) * 5) : 0;
      const axonFire     = n.firing ? Math.max(0, Math.min((n.fireProgress - 0.2) * 3, 1) * (1 - Math.max(0, (n.fireProgress - 0.8) * 5))) : 0;
      const terminalFire = n.firing ? Math.max(0, (n.fireProgress - 0.7) * 3.3) : 0;

      const dendGlow = Math.min(n.stimulation, 1) * 0.5;
      for (const d of n.dendrites) {
        d.swayPhase += d.swaySpeed;
        const sway  = Math.sin(d.swayPhase) * d.swayAmount;
        const angle = d.angle + n.rotation + sway;
        const tip   = drawBranch(n.x, n.y, angle, d.length, 1.3, baseAlpha * 0.6 + dendGlow * 0.3, dendGlow, d.curve1, d.curve2);

        for (const b of d.branches) {
          b.swayPhase += b.swaySpeed;
          const bSway  = Math.sin(b.swayPhase) * b.swayAmount;
          const bAngle = angle + b.angle + bSway;
          const bTip   = drawBranch(tip.x, tip.y, bAngle, b.length, 0.8, baseAlpha * 0.45 + dendGlow * 0.2, dendGlow * 0.7, b.curve1, b.curve2);
          if (b.subBranches) {
            for (const sb of b.subBranches) {
              drawBranch(bTip.x, bTip.y, bAngle + sb.angle, sb.length, 0.4, baseAlpha * 0.3, dendGlow * 0.4, sb.curve1, sb.curve2);
            }
          }
          ctx.beginPath();
          ctx.arc(bTip.x, bTip.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(35, 60%, 50%, ${baseAlpha * 0.4})`;
          ctx.fill();
        }
      }

      // Axon — wanders organically using two control points
      const axAngle = n.axon.angle + n.rotation;
      const cosAx = Math.cos(axAngle);
      const sinAx = Math.sin(axAngle);
      const axEndX = n.x + cosAx * n.axon.length;
      const axEndY = n.y + sinAx * n.axon.length;
      const axNx = sinAx, axNy = -cosAx;
      const axC1x = n.x + cosAx * n.axon.length * 0.33 + axNx * n.axon.length * n.axon.curve1;
      const axC1y = n.y + sinAx * n.axon.length * 0.33 + axNy * n.axon.length * n.axon.curve1;
      const axC2x = n.x + cosAx * n.axon.length * 0.66 + axNx * n.axon.length * n.axon.curve2;
      const axC2y = n.y + sinAx * n.axon.length * 0.66 + axNy * n.axon.length * n.axon.curve2;

      // Soft outer halo of the axon (suggests cell membrane thickness)
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.bezierCurveTo(axC1x, axC1y, axC2x, axC2y, axEndX, axEndY);
      ctx.strokeStyle = axonFire > 0
        ? `rgba(220, 180, 130, ${(baseAlpha * 0.35 + axonFire * 0.2) * 0.6})`
        : `hsla(32, 45%, 38%, ${baseAlpha * 0.28})`;
      ctx.lineWidth = 2.6 + axonFire * 0.8;
      ctx.lineCap = "round";
      ctx.stroke();

      // Crisp axon line
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.bezierCurveTo(axC1x, axC1y, axC2x, axC2y, axEndX, axEndY);
      if (axonFire > 0) {
        ctx.strokeStyle = `rgba(${200 + 20 * axonFire}, ${165 + 25 * axonFire}, ${120 + 30 * axonFire}, ${baseAlpha * 0.5 + axonFire * 0.25})`;
        ctx.lineWidth   = 1.4 + axonFire * 1;
      } else {
        ctx.strokeStyle = `hsla(35, 70%, 50%, ${baseAlpha * 0.42})`;
        ctx.lineWidth   = 1.3;
      }
      ctx.stroke();

      // Fire flash along axon (sampled on the cubic curve)
      if (n.firing && n.fireProgress > 0.2 && n.fireProgress < 0.9) {
        const t  = Math.min(1, (n.fireProgress - 0.2) / 0.6);
        const omt = 1 - t;
        const fx = omt*omt*omt*n.x + 3*omt*omt*t*axC1x + 3*omt*t*t*axC2x + t*t*t*axEndX;
        const fy = omt*omt*omt*n.y + 3*omt*omt*t*axC1y + 3*omt*t*t*axC2y + t*t*t*axEndY;
        const flashGlow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10);
        flashGlow.addColorStop(0,   `rgba(230,200,140,${0.4 * opacityMult})`);
        flashGlow.addColorStop(0.4, `rgba(210,175,120,${0.15 * opacityMult})`);
        flashGlow.addColorStop(1,   `rgba(200,160,90,0)`);
        ctx.beginPath();
        ctx.arc(fx, fy, 10, 0, Math.PI * 2);
        ctx.fillStyle = flashGlow;
        ctx.fill();
      }

      // Myelin sheath — long internodes, narrow Nodes of Ranvier
      ctx.setLineDash([14, 4]);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.bezierCurveTo(axC1x, axC1y, axC2x, axC2y, axEndX, axEndY);
      ctx.strokeStyle = `hsla(35, 50%, 45%, ${baseAlpha * 0.18})`;
      ctx.lineWidth   = 3.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Axon terminals
      for (const t of n.axon.terminals) {
        const tAngle = axAngle + t.angle;
        const tCos = Math.cos(tAngle);
        const tSin = Math.sin(tAngle);
        const tx     = axEndX + tCos * t.length;
        const ty     = axEndY + tSin * t.length;
        const tNx = tSin, tNy = -tCos;
        const tc1x = axEndX + tCos * t.length * 0.33 + tNx * t.length * t.curve1;
        const tc1y = axEndY + tSin * t.length * 0.33 + tNy * t.length * t.curve1;
        const tc2x = axEndX + tCos * t.length * 0.66 + tNx * t.length * t.curve2;
        const tc2y = axEndY + tSin * t.length * 0.66 + tNy * t.length * t.curve2;

        ctx.beginPath();
        ctx.moveTo(axEndX, axEndY);
        ctx.bezierCurveTo(tc1x, tc1y, tc2x, tc2y, tx, ty);
        const tFire = terminalFire;
        if (tFire > 0) {
          ctx.strokeStyle = `rgba(220, 190, 140, ${baseAlpha * 0.4 + tFire * 0.25})`;
          ctx.lineWidth   = 0.7 + tFire * 0.8;
        } else {
          ctx.strokeStyle = `hsla(35, 60%, 50%, ${baseAlpha * 0.35})`;
          ctx.lineWidth   = 0.7;
        }
        ctx.lineCap = "round";
        ctx.stroke();

        // Synaptic bouton — simplified: skip gradient when not firing
        ctx.beginPath();
        ctx.arc(tx, ty, 1.8 + tFire * 1.2, 0, Math.PI * 2);
        if (tFire > 0) {
          const boutonGlow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 3 + tFire * 2);
          boutonGlow.addColorStop(0,   `rgba(230,200,140,${tFire * 0.4})`);
          boutonGlow.addColorStop(0.5, `rgba(210,180,120,${tFire * 0.2})`);
          boutonGlow.addColorStop(1,   `rgba(200,160,80,0)`);
          ctx.fillStyle = boutonGlow;
        } else {
          ctx.fillStyle = `hsla(35, 80%, 55%, ${baseAlpha * 0.5})`;
        }
        ctx.fill();
      }

      // ── Cursor proximity ambient halo ─────────────────────────────
      if (n.cursorGlow > 0.02) {
        const haloR = n.somaRadius * 6 + n.cursorGlow * 32;
        const halo  = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        halo.addColorStop(0,    `hsla(44, 100%, 82%, ${n.cursorGlow * 0.24 * opacityMult})`);
        halo.addColorStop(0.45, `hsla(38,  90%, 65%, ${n.cursorGlow * 0.10 * opacityMult})`);
        halo.addColorStop(1,    `rgba(0,0,0,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // Soma glow
      const somaGlowRadius = n.somaRadius * 3 + somaFire * 5 + n.cursorGlow * 9;
      const sg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, somaGlowRadius);
      if (somaFire > 0) {
        sg.addColorStop(0,   `rgba(230,200,140,${somaFire * 0.15 * opacityMult})`);
        sg.addColorStop(0.5, `rgba(210,170,100,${somaFire * 0.06 * opacityMult})`);
      } else if (n.cursorGlow > 0.05) {
        sg.addColorStop(0,   `hsla(44, 100%, 72%, ${(baseAlpha * 0.12 + n.cursorGlow * 0.22) * opacityMult})`);
        sg.addColorStop(0.5, `hsla(38,  80%, 55%, ${n.cursorGlow * 0.07 * opacityMult})`);
      } else {
        sg.addColorStop(0,   `hsla(35, 80%, 55%, ${baseAlpha * 0.12})`);
        sg.addColorStop(0.5, `hsla(30, 60%, 40%, 0)`);
      }
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(n.x, n.y, somaGlowRadius, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();

      // Soma body
      const sr = n.somaRadius + somaFire * 1 + n.cursorGlow * 1.8;
      ctx.beginPath();
      ctx.arc(n.x, n.y, sr, 0, Math.PI * 2);
      const somaGrad = ctx.createRadialGradient(
        n.x - sr * 0.3, n.y - sr * 0.3, 0, n.x, n.y, sr
      );
      if (somaFire > 0) {
        somaGrad.addColorStop(0,   `rgba(230,210,160,${(0.4 + somaFire * 0.2) * opacityMult})`);
        somaGrad.addColorStop(0.5, `rgba(210,175,110,${(0.35 + somaFire * 0.15) * opacityMult})`);
        somaGrad.addColorStop(1,   `rgba(180,140,80,${(0.25 + somaFire * 0.1) * opacityMult})`);
      } else if (n.cursorGlow > 0.05) {
        somaGrad.addColorStop(0,   `hsla(44, 92%, 74%, ${(0.5 + n.cursorGlow * 0.35) * opacityMult})`);
        somaGrad.addColorStop(0.7, `hsla(36, 78%, 56%, ${(0.4 + n.cursorGlow * 0.2) * opacityMult})`);
        somaGrad.addColorStop(1,   `hsla(28, 62%, 40%, ${(0.3 + n.cursorGlow * 0.1) * opacityMult})`);
      } else {
        somaGrad.addColorStop(0,   `hsla(35, 70%, 60%, ${baseAlpha * 0.7})`);
        somaGrad.addColorStop(0.7, `hsla(30, 60%, 45%, ${baseAlpha * 0.5})`);
        somaGrad.addColorStop(1,   `hsla(25, 50%, 35%, ${baseAlpha * 0.35})`);
      }
      ctx.fillStyle = somaGrad;
      ctx.fill();

      // Nucleus
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.somaRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = somaFire > 0
        ? `rgba(220,190,140,${(0.2 + somaFire * 0.15) * opacityMult})`
        : n.cursorGlow > 0.05
          ? `hsla(40, 80%, 62%, ${(baseAlpha * 0.45 + n.cursorGlow * 0.22) * opacityMult})`
          : `hsla(30, 50%, 40%, ${baseAlpha * 0.45})`;
      ctx.fill();
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      time++;

      // Fill with background color instead of clearRect (alpha:false context)
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Spontaneous random firing
      if (time % 40 === 0) {
        const idx = Math.floor(Math.random() * neurons.length);
        if (!neurons[idx].firing && neurons[idx].refractoryTimer <= 0) triggerFire(idx);
      }

      // ── Collect firing neuron indices once per frame ───────────────
      const firingIndices: number[] = [];
      for (let i = 0; i < neurons.length; i++) {
        if (neurons[i].firing) firingIndices.push(i);
      }

      // ── Update all neurons (physics + firing) ─────────────────────
      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase  += n.pulseSpeed;
        n.rotation    += n.rotationSpeed;

        const margin = 80;
        if (n.x < margin)                n.vx += 0.005;
        if (n.x > canvas.width  - margin) n.vx -= 0.005;
        if (n.y < margin)                n.vy += 0.005;
        if (n.y > canvas.height - margin) n.vy -= 0.005;
        n.vx *= 0.999;
        n.vy *= 0.999;

        if (n.refractoryTimer > 0) n.refractoryTimer--;
        if (n.stimulation > 0) {
          n.stimulation -= n.stimulationDecay;
          if (n.stimulation < 0) n.stimulation = 0;
        }
        if (!n.firing && n.refractoryTimer <= 0 && n.stimulation >= FIRE_THRESHOLD) triggerFire(i);

        if (n.firing) {
          // Fast onset, slow calm tail — natural action-potential envelope
          const step = n.fireProgress < 0.35
            ? 0.022                                  // sharp rise
            : 0.004 + 0.006 * (1 - Math.min(1, (n.fireProgress - 0.35) / 0.95)); // long ease-out
          n.fireProgress += step;
          if (n.fireProgress >= 1.3) {
            n.firing       = false;
            n.fireProgress = 0;
            n.fireIntensity = 0;
            n.refractoryTimer = REFRACTORY_PERIOD;

            // Only mid-layer neurons propagate synaptic spikes — and only occasionally
            if (n.layer === 1) {
              const terminals = getAxonTerminals(n);
              const MAX_OUT = Math.random() < 0.25 ? 2 : 1; // usually one branch, rarely two
              let emitted = 0;
              for (let j = 0; j < neurons.length; j++) {
                if (emitted >= MAX_OUT) break;
                if (j === i || neurons[j].layer !== 1) continue;
                // Quick distance pre-check
                const ndx = n.x - neurons[j].x;
                const ndy = n.y - neurons[j].y;
                if (ndx * ndx + ndy * ndy > 90000) continue;

                const tips = getDendriteTips(neurons[j]);
                let connected = false;
                for (const term of terminals) {
                  if (connected) break;
                  for (const tip of tips) {
                    const dx = term.x - tip.x;
                    const dy = term.y - tip.y;
                    if (dx * dx + dy * dy < SYNAPSE_DIST_SQ) {
                      // Probabilistic release — most synapses stay quiet
                      if (Math.random() < 0.45) {
                        synapticSpikes.push({
                          fromNeuronIdx: i,
                          toNeuronIdx:   j,
                          fromPoint:     { x: term.x, y: term.y },
                          toPoint:       { x: tip.x, y: tip.y },
                          progress:      0,
                          speed:         0.018 + Math.random() * 0.012,
                          active:        true,
                          trailPoints:   [],
                        });
                        emitted++;
                      }
                      connected = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // ── Cursor hover glow & click-to-fire ────────────────────────
      const { x: cursorX, y: cursorY } = mouseRef.current;
      const CURSOR_RADIUS = 120;
      const CURSOR_R_SQ   = CURSOR_RADIUS * CURSOR_RADIUS;

      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];
        if (n.layer !== 1) { if (n.cursorGlow > 0) n.cursorGlow *= 0.9; continue; }
        const cdx     = n.x - cursorX;
        const cdy     = n.y - cursorY;
        const cDistSq = cdx * cdx + cdy * cdy;
        if (cDistSq < CURSOR_R_SQ) {
          const influence = 1 - Math.sqrt(cDistSq) / CURSOR_RADIUS;
          n.cursorGlow = Math.min(1, n.cursorGlow + influence * 0.1);
          if (n.refractoryTimer <= 0 && !n.firing) {
            n.stimulation = Math.min(n.stimulation + influence * 0.003, FIRE_THRESHOLD * 1.5);
          }
        } else {
          n.cursorGlow *= 0.92;
        }
      }

      if (clickQueueRef.current) {
        clickQueueRef.current = false;
        const CLICK_R_SQ = 140 * 140;
        for (let i = 0; i < neurons.length; i++) {
          const n   = neurons[i];
          const cdx = n.x - cursorX;
          const cdy = n.y - cursorY;
          if (cdx * cdx + cdy * cdy < CLICK_R_SQ) triggerFire(i);
        }
      }

      // ── Update synaptic spikes + record trail breadcrumbs ─────────
      for (let si = synapticSpikes.length - 1; si >= 0; si--) {
        const spike = synapticSpikes[si];
        if (!spike.active) { synapticSpikes.splice(si, 1); continue; }
        spike.progress += spike.speed;

        const { fromPoint: fp, toPoint: tp } = spike;
        const tdx   = tp.x - fp.x;
        const tdy   = tp.y - fp.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        const tmx   = (fp.x + tp.x) / 2;
        const tmy   = (fp.y + tp.y) / 2 - tdist * 0.12;
        const t     = spike.progress;
        const ptx   = (1-t)*(1-t)*fp.x + 2*(1-t)*t*tmx + t*t*tp.x;
        const pty   = (1-t)*(1-t)*fp.y + 2*(1-t)*t*tmy + t*t*tp.y;
        const last  = spike.trailPoints[spike.trailPoints.length - 1];
        if (!last || Math.hypot(ptx - last.x, pty - last.y) > 3) {
          spike.trailPoints.push({ x: ptx, y: pty });
        }

        if (spike.progress >= 1) {
          spike.active = false;
          const target = neurons[spike.toNeuronIdx];
          if (target) target.stimulation += 0.14 + Math.random() * 0.10;

          if (spike.trailPoints.length >= 3) {
            synapticTrails.push({
              points:    spike.trailPoints, // no need to copy, spike is discarded
              alpha:     0.75,
              fadeSpeed: 0.006 + Math.random() * 0.008,
              hue:       30 + Math.random() * 20,
            });
          }
        }
      }

      // Guard trail pool size
      while (synapticTrails.length > 50) synapticTrails.shift();

      // ── Update vesicles (only interact with firing neurons) ────────
      const VESICLE_INFLUENCE_RADIUS = 90;
      const VESICLE_INF_SQ = VESICLE_INFLUENCE_RADIUS * VESICLE_INFLUENCE_RADIUS;
      const PUSH_STRENGTH = 0.28;
      const PULL_STRENGTH = 0.12;

      for (const v of vesicles) {
        v.pulsePhase += v.pulseSpeed;
        if (v.excitement > 0) v.excitement *= 0.96;

        // Only check firing neurons instead of all neurons
        for (const fi of firingIndices) {
          const n = neurons[fi];
          const dx     = v.x - n.x;
          const dy     = v.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < VESICLE_INF_SQ) {
            const dist = Math.sqrt(distSq);
            const norm = dist > 0.001 ? 1 / dist : 0;
            const t    = n.fireProgress;
            const strength = (t < 0.5 ? PULL_STRENGTH : PUSH_STRENGTH) * (1 - distSq / VESICLE_INF_SQ);
            const sign = t < 0.5 ? -1 : 1;
            v.vx += sign * dx * norm * strength;
            v.vy += sign * dy * norm * strength;
            v.excitement = Math.min(1, v.excitement + 0.35);
          }
        }

        v.x += v.vx;
        v.y += v.vy;
        const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
        if (speed > 1.6) { v.vx = (v.vx / speed) * 1.6; v.vy = (v.vy / speed) * 1.6; }
        v.vx *= 0.985;
        v.vy *= 0.985;
        v.vx += randRange(-0.015, 0.015);
        v.vy += randRange(-0.015, 0.015);
        if (v.x < -10)               v.x = canvas.width  + 10;
        if (v.x > canvas.width  + 10) v.x = -10;
        if (v.y < -10)               v.y = canvas.height + 10;
        if (v.y > canvas.height + 10) v.y = -10;

        const pulse = Math.sin(v.pulsePhase) * 0.35 + 0.65;
        v.alpha = v.baseAlpha * pulse * (1 + v.excitement * 2.5);
      }

      // ── Update fog patches (only check firing neurons) ────────────
      const FOG_INFLUENCE_RADIUS = 220;
      const FOG_INF_SQ = FOG_INFLUENCE_RADIUS * FOG_INFLUENCE_RADIUS;
      for (const f of fogPatches) {
        f.phase += f.phaseSpeed;
        if (f.excitement > 0) f.excitement *= 0.992;

        for (const fi of firingIndices) {
          const n = neurons[fi];
          if (n.layer !== 1) continue;
          const dx     = f.x - n.x;
          const dy     = f.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < FOG_INF_SQ) {
            f.excitement = Math.min(1, f.excitement + 0.08);
            const dist   = Math.sqrt(distSq) + 0.001;
            f.vx -= (dx / dist) * 0.018;
            f.vy -= (dy / dist) * 0.018;
          }
        }

        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.998;
        f.vy *= 0.998;
        f.vx += randRange(-0.008, 0.008);
        f.vy += randRange(-0.005, 0.005);
        if (f.x < -f.radius)              f.x = canvas.width  + f.radius;
        if (f.x > canvas.width  + f.radius) f.x = -f.radius;
        if (f.y < -f.radius)              f.y = canvas.height + f.radius;
        if (f.y > canvas.height + f.radius) f.y = -f.radius;

        const breathe = Math.sin(f.phase) * 0.3 + 0.7;
        f.alpha = f.baseAlpha * breathe * (1 + f.excitement * 1.8);
      }

      // ── Recompute synapse connections periodically ─────────────────
      synapseUpdateCounter++;
      if (synapseUpdateCounter >= SYNAPSE_UPDATE_INTERVAL) {
        synapseUpdateCounter = 0;
        recomputeSynapseConnections();
      }

      // ═══════════════ RENDER LAYERS ════════════════════════════════
      for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
        const cfg = LAYER_CONFIG[layerIdx];

        // ── Vesicles behind background layer (no blur filter) ──
        if (layerIdx === 0) {
          for (const v of vesicles) {
            const r       = v.radius + v.excitement * 1.2;
            const excited = v.excitement > 0.05;
            if (excited) {
              const haloR = r * 5;
              const halo = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, haloR);
              halo.addColorStop(0,   `hsla(38, 85%, 68%, ${v.alpha * 0.6})`);
              halo.addColorStop(0.5, `hsla(32, 70%, 55%, ${v.alpha * 0.2})`);
              halo.addColorStop(1,   `hsla(28, 60%, 45%, 0)`);
              ctx.beginPath();
              ctx.arc(v.x, v.y, haloR, 0, Math.PI * 2);
              ctx.fillStyle = halo;
              ctx.fill();
            }
            const coreColor = excited
              ? `hsla(38, 80%, 70%, ${v.alpha})`
              : `hsla(200, 30%, 70%, ${v.alpha * 0.7})`;
            ctx.beginPath();
            ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
            ctx.fillStyle = coreColor;
            ctx.fill();
          }
        }

        // ── Mid-layer: cached connections + spikes + trails ──────
        if (layerIdx === 1) {
          // Synaptic connection lines from cache
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 0.5;
          ctx.lineCap = "round";
          for (const conn of cachedSynapses) {
            const alpha = (1 - conn.dist / SYNAPSE_DIST) * 0.06;
            ctx.beginPath();
            ctx.moveTo(conn.termX, conn.termY);
            const mx = (conn.termX + conn.tipX) / 2;
            const my = (conn.termY + conn.tipY) / 2 - conn.dist * 0.12;
            ctx.quadraticCurveTo(mx, my, conn.tipX, conn.tipY);
            ctx.strokeStyle = `hsla(35, 40%, 45%, ${alpha})`;
            ctx.stroke();
          }
          ctx.setLineDash([]);

          // Live spike balls
          for (const spike of synapticSpikes) {
            if (!spike.active) continue;
            const { fromPoint: fp, toPoint: tp } = spike;
            const dx   = tp.x - fp.x;
            const dy   = tp.y - fp.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const mx   = (fp.x + tp.x) / 2;
            const my   = (fp.y + tp.y) / 2 - dist * 0.12;
            const t    = spike.progress;
            const x    = (1-t)*(1-t)*fp.x + 2*(1-t)*t*mx + t*t*tp.x;
            const y    = (1-t)*(1-t)*fp.y + 2*(1-t)*t*my + t*t*tp.y;

            const fadeIn  = Math.min(t * 5, 1);
            const fadeOut = Math.min((1 - t) * 5, 1);
            const alpha   = fadeIn * fadeOut;

            const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
            glow.addColorStop(0,   `hsla(35, 50%, 75%, ${alpha * 0.35})`);
            glow.addColorStop(0.5, `hsla(30, 45%, 60%, ${alpha * 0.15})`);
            glow.addColorStop(1,   `hsla(30, 50%, 50%, 0)`);
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

          // ── Bioluminescent ink trails (2 passes instead of 3) ──
          ctx.save();
          ctx.lineCap  = "round";
          ctx.lineJoin = "round";
          for (let ti = synapticTrails.length - 1; ti >= 0; ti--) {
            const trail = synapticTrails[ti];
            trail.alpha -= trail.fadeSpeed;
            if (trail.alpha <= 0 || trail.points.length < 2) {
              synapticTrails.splice(ti, 1);
              continue;
            }
            const pts = trail.points;

            // Combined soft glow (merged wide aura + mid)
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi].x, pts[pi].y);
            ctx.strokeStyle = `hsla(${trail.hue}, 88%, 70%, ${trail.alpha * 0.18})`;
            ctx.lineWidth   = 8;
            ctx.stroke();

            // Core luminous thread
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi].x, pts[pi].y);
            ctx.strokeStyle = `hsla(${trail.hue + 8}, 100%, 90%, ${trail.alpha * 0.68})`;
            ctx.lineWidth   = 1.2;
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw neurons for this layer
        for (let ni = 0; ni < neurons.length; ni++) {
          if (neurons[ni].layer !== layerIdx) continue;
          drawNeuron(neurons[ni], cfg.opacity);
        }
      }

      // ── Fog patches (rendered to offscreen canvas, no blur filter) ─
      fogUpdateCounter++;
      if (fogUpdateCounter >= FOG_UPDATE_INTERVAL || fogDirty) {
        fogUpdateCounter = 0;
        fogDirty = false;
        renderFogOffscreen();
      }
      ctx.drawImage(fogCanvas, 0, 0);

      // ── Vignette (cached offscreen) ────────────────────────────────
      if (vignetteNeedsRender) renderVignette();
      ctx.drawImage(vignetteCanvas, 0, 0);

      // ── Organic noise texture overlay ──────────────────────────────
      noiseTime += 0.35;
      ctx.save();
      ctx.globalAlpha              = 0.030;
      ctx.globalCompositeOperation = "screen";
      if (cachedNoisePattern) {
        const nx = Math.floor(noiseTime % 256);
        const ny = Math.floor((noiseTime * 0.61803) % 256);
        ctx.translate(nx, ny);
        ctx.fillStyle = cachedNoisePattern;
        ctx.fillRect(-nx, -ny, canvas.width + 256, canvas.height + 256);
      }
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeWithCaches);
      window.removeEventListener("scroll",    onScroll);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click",     onClick);
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
