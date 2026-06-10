import { useEffect, useRef } from "react";

interface DendriteBranch {
  angle: number;
  length: number;
  curve1: number;
  curve2: number;
}

interface Dendrite {
  angle: number;
  length: number;
  branches: DendriteBranch[];
  swayPhase: number;
  swaySpeed: number;
  swayAmount: number;
  curve1: number;
  curve2: number;
}

interface AxonTerminal {
  angle: number;
  length: number;
  curve1: number;
  curve2: number;
  boutonRadius: number;
  twigs: DendriteBranch[];
}

interface NeuronCell {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  somaRadius: number;
  polarityAngle: number;
  dendritePoleAngle: number;
  axonBaseAngle: number;
  pulsePhase: number;
  pulseSpeed: number;
  dendrites: Dendrite[];
  axon: { angleOffset: number; length: number; curve1: number; curve2: number; terminals: AxonTerminal[] };
  targetIndices: number[];
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
  { scale: 0.45, opacity: 0.12, blur: 0, parallax: 0, ratio: 0.16 },
  { scale: 1.0,  opacity: 1.0,  blur: 0, parallax: 0, ratio: 0.64 },
  { scale: 1.8,  opacity: 0.16, blur: 0, parallax: 0, ratio: 0.10 },
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

    const totalCount = Math.min(84, Math.max(42, Math.floor((window.innerWidth * window.innerHeight) / 19500)));
    const neurons: NeuronCell[] = [];
    const synapticSpikes: PropagatingSpike[] = [];
    const synapticTrails: SynapticTrail[] = [];
    const FIRE_THRESHOLD  = 0.65;
    const REFRACTORY_PERIOD = 170;
    const SYNAPSE_DIST    = 126;
    const SYNAPSE_DIST_SQ = SYNAPSE_DIST * SYNAPSE_DIST;
    const DENDRITE_CONTACT_DIST = 42;
    const DENDRITE_CONTACT_DIST_SQ = DENDRITE_CONTACT_DIST * DENDRITE_CONTACT_DIST;

    const randRange = (min: number, max: number) => min + Math.random() * (max - min);
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

    // Even grid+jitter placement — stable tissue sheet, then connectivity defines structure.
    const placeNeuronsEvenly = (count: number, padding: number) => {
      const positions: { x: number; y: number }[] = [];
      const aspect = canvas.width / canvas.height;
      const cols   = Math.ceil(Math.sqrt(count * aspect));
      const rows   = Math.ceil(count / cols);
      const cellW  = (canvas.width  - padding * 2) / cols;
      const cellH  = (canvas.height - padding * 2) / rows;

      let idx = 0;
      for (let r = 0; r < rows && idx < count; r++) {
        for (let c = 0; c < cols && idx < count; c++) {
          positions.push({
            x: padding + cellW * (c + 0.5) + randRange(-cellW * 0.16, cellW * 0.16),
            y: padding + cellH * (r + 0.5) + randRange(-cellH * 0.16, cellH * 0.16),
          });
          idx++;
        }
      }
      return positions;
    };

    // Tissue physics — neurons are ECM-anchored; motion is sub-pixel Brownian only.
    const ECM_SPRING         = 0.0012;
    const ECM_DAMPING        = 0.82;
    const BROWNIAN_JITTER    = 0.00004;
    const MAX_NEURON_SPEED   = 0.012;
    const MIN_SOMA_SEPARATION = 52;
    const REPULSION_STRENGTH = 0.00035;

    // ── Fog patch field ──────────────────────────────────────────────
    const FOG_COUNT = 0;
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

    // ── Vesicle / particle field ─────────────────────────────────────
    const VESICLE_COUNT = 120;
    const vesicles: Vesicle[] = [];
    for (let i = 0; i < VESICLE_COUNT; i++) {
      vesicles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: randRange(-0.025, 0.025),
        vy: randRange(-0.025, 0.025),
        radius: randRange(0.8, 2.2),
        baseAlpha: randRange(0.02, 0.07),
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
      const isMidLayer = layerIdx === 1;
      const placements = placeNeuronsEvenly(count, 44 + layerIdx * 8);

      for (let i = 0; i < count; i++) {
        const { x: placeX, y: placeY } = placements[i];
        // Polarized morphology: dendrite arbor on one hemisphere, axon on the opposite pole.
        const polarityAngle = randRange(0, Math.PI * 2);
        const dendriteCount = Math.floor(randRange(isMidLayer ? 8 : 4, isMidLayer ? 12 : 7));
        const dendrites: Dendrite[] = [];

        for (let d = 0; d < dendriteCount; d++) {
          const branches: DendriteBranch[] = [];
          if (isMidLayer || Math.random() > 0.35) {
            const branchCount = Math.floor(randRange(isMidLayer ? 3 : 1, isMidLayer ? 6 : 4));
            for (let b = 0; b < branchCount; b++) {
              branches.push({
                angle:  randRange(-1.25, 1.25),
                length: randRange(isMidLayer ? 14 : 8, isMidLayer ? 34 : 20) * cfg.scale,
                curve1: randRange(-0.26, 0.26),
                curve2: randRange(-0.2, 0.2),
              });
            }
          }
          dendrites.push({
            angle:      randRange(-1.65, 1.65),
            length:     randRange(isMidLayer ? 38 : 22, isMidLayer ? 70 : 40) * cfg.scale,
            branches,
            swayPhase:  Math.random() * Math.PI * 2,
            swaySpeed:  0.0014 + Math.random() * 0.0022,
            swayAmount: 0.014 + Math.random() * 0.028,
            curve1:     randRange(-0.22, 0.22),
            curve2:     randRange(-0.18, 0.18),
          });
        }

        const terminalCount = isMidLayer ? Math.floor(randRange(3, 6)) : 0;
        const terminals: AxonTerminal[] = [];
        for (let t = 0; t < terminalCount; t++) {
          const twigs: DendriteBranch[] = [];
          const twigCount = Math.floor(randRange(1, 4));
          for (let w = 0; w < twigCount; w++) {
            twigs.push({
              angle:  randRange(-0.95, 0.95),
              length: randRange(8, 18) * cfg.scale,
              curve1: randRange(-0.22, 0.22),
              curve2: randRange(-0.18, 0.18),
            });
          }
          terminals.push({
            angle:        randRange(-0.95, 0.95),
            length:       randRange(16, 36) * cfg.scale,
            curve1:       randRange(-0.26, 0.26),
            curve2:       randRange(-0.2, 0.2),
            boutonRadius: randRange(1.4, 2.4) * cfg.scale,
            twigs,
          });
        }

        neurons.push({
          x: placeX,
          y: placeY,
          homeX: placeX,
          homeY: placeY,
          vx: 0,
          vy: 0,
          somaRadius:       randRange(6, 10) * cfg.scale,
          polarityAngle,
          dendritePoleAngle: polarityAngle,
          axonBaseAngle:     polarityAngle + Math.PI,
          pulsePhase:       Math.random() * Math.PI * 2,
          pulseSpeed:       0.008 + Math.random() * 0.012,
          dendrites,
          axon: {
            angleOffset: randRange(-0.1, 0.1),
            length:      randRange(isMidLayer ? 58 : 36, isMidLayer ? 100 : 64) * cfg.scale,
            curve1:      randRange(-0.08, 0.08),
            curve2:      randRange(-0.05, 0.05),
            terminals,
          },
          targetIndices:    [],
          rotation:         Math.random() * Math.PI * 2,
          rotationSpeed:    randRange(-0.000015, 0.000015),
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

    // Build a local directed N:M graph. Axons target nearby neurons; dendrites face inputs.
    const incomingByNeuron = new Map<number, number[]>();
    for (const idx of midIndices) incomingByNeuron.set(idx, []);
    for (const i of midIndices) {
      const n = neurons[i];
      const candidates = midIndices
        .filter(j => j !== i)
        .map(j => {
          const dx = neurons[j].x - n.x;
          const dy = neurons[j].y - n.y;
          return { idx: j, dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
        })
        .filter(c => c.dist > 95 && c.dist < 360)
        .sort((a, b) => a.dist - b.dist);

      const targetCount = Math.min(candidates.length, Math.floor(randRange(4, 7)));
      const targets = candidates.slice(0, targetCount);
      n.targetIndices = targets.map(t => t.idx);
      for (const target of n.targetIndices) incomingByNeuron.get(target)?.push(i);

      if (targets.length > 0) {
        const avgX = targets.reduce((sum, t) => sum + neurons[t.idx].x, 0) / targets.length;
        const avgY = targets.reduce((sum, t) => sum + neurons[t.idx].y, 0) / targets.length;
        const axonAngle = Math.atan2(avgY - n.y, avgX - n.x);
        n.polarityAngle = axonAngle + Math.PI + randRange(-0.18, 0.18);
        n.axonBaseAngle = axonAngle + randRange(-0.08, 0.08);
        n.axon.angleOffset = randRange(-0.06, 0.06);
        n.axon.length = clamp(targets[0].dist * 0.7, 72, 160);
        n.axon.terminals = targets.map(target => {
          const relativeAngle = normalizeAngle(target.angle - axonAngle);
          const twigCount = Math.floor(randRange(1, 3));
          const twigs: DendriteBranch[] = [];
          for (let twigIdx = 0; twigIdx < twigCount; twigIdx++) {
            twigs.push({
              angle:  randRange(-0.65, 0.65),
              length: randRange(10, 22),
              curve1: randRange(-0.2, 0.2),
              curve2: randRange(-0.16, 0.16),
            });
          }
          return {
            angle:        clamp(relativeAngle, -0.95, 0.95) + randRange(-0.12, 0.12),
            length:       clamp(target.dist * 0.24, 22, 58),
            curve1:       randRange(-0.18, 0.18),
            curve2:       randRange(-0.14, 0.14),
            boutonRadius: randRange(1.2, 2.0),
            twigs,
          };
        });
      }
    }

    for (const i of midIndices) {
      const sources = incomingByNeuron.get(i) ?? [];
      if (sources.length === 0) continue;
      const n = neurons[i];
      const avgX = sources.reduce((sum, sourceIdx) => sum + neurons[sourceIdx].x, 0) / sources.length;
      const avgY = sources.reduce((sum, sourceIdx) => sum + neurons[sourceIdx].y, 0) / sources.length;
      n.dendritePoleAngle = Math.atan2(avgY - n.y, avgX - n.x) + randRange(-0.22, 0.22);
    }

    // ── Helpers ───────────────────────────────────────────────────────
    const getDendritePole = (n: NeuronCell) => n.dendritePoleAngle + n.rotation;
    const getAxonAngle    = (n: NeuronCell) => n.axonBaseAngle + n.axon.angleOffset + n.rotation;

    const somaSurface = (n: NeuronCell, angle: number, inset = 0.82) => ({
      x: n.x + Math.cos(angle) * n.somaRadius * inset,
      y: n.y + Math.sin(angle) * n.somaRadius * inset,
    });

    const sampleCubic = (
      p0x: number, p0y: number,
      c1x: number, c1y: number,
      c2x: number, c2y: number,
      p3x: number, p3y: number,
      t: number
    ) => {
      const omt = 1 - t;
      return {
        x: omt * omt * omt * p0x + 3 * omt * omt * t * c1x + 3 * omt * t * t * c2x + t * t * t * p3x,
        y: omt * omt * omt * p0y + 3 * omt * omt * t * c1y + 3 * omt * t * t * c2y + t * t * t * p3y,
      };
    };

    const getAxonGeometry = (n: NeuronCell) => {
      const axAngle = getAxonAngle(n);
      const cosAx = Math.cos(axAngle);
      const sinAx = Math.sin(axAngle);
      const start = somaSurface(n, axAngle, 0.88);
      const endX  = start.x + cosAx * n.axon.length;
      const endY  = start.y + sinAx * n.axon.length;
      const nx = sinAx, ny = -cosAx;
      const c1x = start.x + cosAx * n.axon.length * 0.33 + nx * n.axon.length * n.axon.curve1;
      const c1y = start.y + sinAx * n.axon.length * 0.33 + ny * n.axon.length * n.axon.curve1;
      const c2x = start.x + cosAx * n.axon.length * 0.66 + nx * n.axon.length * n.axon.curve2;
      const c2y = start.y + sinAx * n.axon.length * 0.66 + ny * n.axon.length * n.axon.curve2;
      return { axAngle, start, endX, endY, c1x, c1y, c2x, c2y, cosAx, sinAx };
    };

    const getAxonTerminals = (n: NeuronCell) => {
      const { axAngle, endX, endY } = getAxonGeometry(n);
      const points: { x: number; y: number }[] = [];
      for (const t of n.axon.terminals) {
        const tAngle = axAngle + t.angle;
        const terminalEnd = branchEndpoint(endX, endY, tAngle, t.length);
        points.push(terminalEnd);
        for (const twig of t.twigs) {
          const twigAngle = tAngle + twig.angle;
          points.push(branchEndpoint(terminalEnd.x, terminalEnd.y, twigAngle, twig.length));
        }
      }
      return points;
    };

    const getDendriteTips = (n: NeuronCell) => {
      const pole = getDendritePole(n);
      const tips: { x: number; y: number }[] = [];
      for (const d of n.dendrites) {
        const sway  = Math.sin(d.swayPhase) * d.swayAmount;
        const angle = pole + d.angle + sway;
        const cosA  = Math.cos(angle);
        const sinA  = Math.sin(angle);
        const origin = somaSurface(n, angle, 0.72);
        const tipX   = origin.x + cosA * d.length;
        const tipY   = origin.y + sinA * d.length;
        tips.push({ x: tipX, y: tipY });
        for (const b of d.branches) {
          const bAngle = angle + b.angle;
          const branchEnd = branchEndpoint(tipX, tipY, bAngle, b.length);
          tips.push({
            x: branchEnd.x,
            y: branchEnd.y,
          });
        }
      }
      return tips;
    };

    const drawBranch = (
      x1: number, y1: number, angle: number, length: number,
      width: number, color: string, fireColor: string, fireGlow: number,
      curve1: number, curve2: number
    ): { x: number; y: number } => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const x2 = x1 + cosA * length;
      const y2 = y1 + sinA * length;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      if (Math.abs(curve1) > 0.02 || Math.abs(curve2) > 0.02) {
        const nx = sinA, ny = -cosA;
        const c1x = x1 + cosA * length * 0.33 + nx * length * curve1;
        const c1y = y1 + sinA * length * 0.33 + ny * length * curve1;
        const c2x = x1 + cosA * length * 0.66 + nx * length * curve2;
        const c2y = y1 + sinA * length * 0.66 + ny * length * curve2;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
      } else {
        ctx.lineTo(x2, y2);
      }

      ctx.strokeStyle = fireGlow > 0 ? fireColor : color;
      ctx.lineWidth   = width + fireGlow * 0.9;
      ctx.lineCap     = "round";
      ctx.stroke();

      return { x: x2, y: y2 };
    };

    const branchEndpoint = (
      x1: number, y1: number, angle: number, length: number
    ) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      return {
        x: x1 + cosA * length,
        y: y1 + sinA * length,
      };
    };

    const strokeCubic = (
      x0: number, y0: number,
      c1x: number, c1y: number,
      c2x: number, c2y: number,
      x3: number, y3: number,
      color: string, width: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x3, y3);
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.lineCap     = "round";
      ctx.stroke();
    };

    const angleDistance = (a: number, b: number) => {
      return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    };

    const somaRadiusAtAngle = (
      n: NeuronCell,
      angle: number,
      radius: number,
      drawNeurites: boolean
    ) => {
      if (!drawNeurites) return radius;

      let scale = 1;
      const pole = getDendritePole(n);
      for (const d of n.dendrites) {
        const delta = angleDistance(angle, pole + d.angle);
        scale += 0.22 * Math.exp(-(delta * delta) / 0.028);
      }

      const axonDelta = angleDistance(angle, getAxonAngle(n));
      scale += 0.42 * Math.exp(-(axonDelta * axonDelta) / 0.022);
      return radius * Math.min(scale, 1.52);
    };

    const traceSomaMembrane = (n: NeuronCell, radius: number, drawNeurites: boolean) => {
      const steps = 52;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const r = somaRadiusAtAngle(n, angle, radius, drawNeurites);
        const x = n.x + Math.cos(angle) * r;
        const y = n.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
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
    interface DendriteContact {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      alpha: number;
    }
    let cachedSynapses: SynapseConnection[] = [];
    let cachedDendriteContacts: DendriteContact[] = [];
    let synapseUpdateCounter = 0;
    const SYNAPSE_UPDATE_INTERVAL = 30; // recompute every 30 frames

    const recomputeSynapseConnections = () => {
      cachedSynapses = [];
      cachedDendriteContacts = [];
      const contactBudget = 120;
      for (const i of midIndices) {
        const n = neurons[i];
        const terminals = getAxonTerminals(n);
        const sourceTips = getDendriteTips(neurons[i]);
        const targetSet = n.targetIndices.length > 0 ? n.targetIndices : midIndices.filter(j => j !== i);
        for (const j of targetSet) {
          // Quick bounding-box pre-check (neurons too far apart)
          const ndx = neurons[i].x - neurons[j].x;
          const ndy = neurons[i].y - neurons[j].y;
          if (ndx * ndx + ndy * ndy > 160000) continue; // ~400px max possible reach

          const tips = getDendriteTips(neurons[j]);
          if (j > i && cachedDendriteContacts.length < contactBudget) {
            for (const a of sourceTips) {
              for (const b of tips) {
                const cdx = a.x - b.x;
                const cdy = a.y - b.y;
                const cdistSq = cdx * cdx + cdy * cdy;
                if (cdistSq < DENDRITE_CONTACT_DIST_SQ) {
                  cachedDendriteContacts.push({
                    x1: a.x, y1: a.y,
                    x2: b.x, y2: b.y,
                    alpha: 1 - Math.sqrt(cdistSq) / DENDRITE_CONTACT_DIST,
                  });
                  break;
                }
              }
              if (cachedDendriteContacts.length >= contactBudget) break;
            }
          }
          let best: SynapseConnection | null = null;
          for (const term of terminals) {
            for (const tip of tips) {
              const dx = term.x - tip.x;
              const dy = term.y - tip.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < SYNAPSE_DIST_SQ * 1.8) {
                const candidate = {
                  fromIdx: i, toIdx: j,
                  termX: term.x, termY: term.y,
                  tipX: tip.x, tipY: tip.y,
                  dist: Math.sqrt(distSq),
                };
                if (!best || candidate.dist < best.dist) best = candidate;
              }
            }
          }
          if (best) cachedSynapses.push(best);
        }
      }
    };
    recomputeSynapseConnections();

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
      vignette.addColorStop(0.55, "rgba(0,0,0,0.05)");
      vignette.addColorStop(0.8,  "rgba(4,2,1,0.18)");
      vignette.addColorStop(1,    "rgba(6,3,1,0.38)");
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
    const drawNeuron = (n: NeuronCell, opacityMult: number, drawNeurites: boolean) => {
      const pulse     = Math.sin(n.pulsePhase) * 0.5 + 0.5;
      const vis       = (0.46 + pulse * 0.08) * opacityMult;

      const somaFire     = n.firing ? Math.max(0, 1 - Math.abs(n.fireProgress - 0.12) * 6) : 0;
      const axonFire     = n.firing ? Math.max(0, Math.min((n.fireProgress - 0.18) * 3.2, 1) * (1 - Math.max(0, (n.fireProgress - 0.82) * 5))) : 0;
      const terminalFire = n.firing ? Math.max(0, (n.fireProgress - 0.68) * 3.5) : 0;
      const dendGlow     = Math.min(n.stimulation, 1);

      const sr         = n.somaRadius + somaFire * 0.8 + n.cursorGlow * 0.9;
      const dendColor  = `hsla(30, 32%, 58%, ${vis * 0.72})`;
      const dendFire   = `hsla(42, 82%, 76%, ${Math.min(0.82, vis + 0.12)})`;
      const axonColor  = `hsla(36, 38%, 62%, ${vis * 0.76})`;
      const axonFireC  = `hsla(44, 95%, 82%, ${Math.min(1, vis + 0.2)})`;
      const termColor  = `hsla(40, 34%, 56%, ${vis * 0.48})`;
      const termFireC  = `hsla(42, 70%, 68%, ${Math.min(0.58, vis * 0.72)})`;

      // Soft membrane wash first, so neurites appear to emerge through the soma.
      const membrane = ctx.createRadialGradient(
        n.x - sr * 0.25, n.y - sr * 0.25, 0,
        n.x, n.y, sr * 1.15
      );
      membrane.addColorStop(0, `hsla(34, 22%, 58%, ${vis * 0.14})`);
      membrane.addColorStop(0.72, `hsla(30, 22%, 44%, ${vis * 0.12})`);
      membrane.addColorStop(1, `hsla(25, 18%, 30%, ${vis * 0.03})`);
      traceSomaMembrane(n, sr * 1.08, drawNeurites);
      ctx.fillStyle = membrane;
      ctx.fill();

      if (drawNeurites) {
        const pole = getDendritePole(n);

        // Dendritic arbor — input side of the soma
        for (const d of n.dendrites) {
          d.swayPhase += d.swaySpeed;
          const sway  = Math.sin(d.swayPhase) * d.swayAmount;
          const angle = pole + d.angle + sway;
          const origin = somaSurface(n, angle, 0.72);
          const tip = drawBranch(
            origin.x, origin.y, angle, d.length,
            1.25, dendColor, dendFire, dendGlow * 0.55 + somaFire * 0.14,
            d.curve1, d.curve2
          );
          for (const b of d.branches) {
            const bAngle = angle + b.angle;
            drawBranch(
              tip.x, tip.y, bAngle, b.length,
              0.72, dendColor, dendFire, dendGlow * 0.35,
              b.curve1, b.curve2
            );
          }
        }

        const { axAngle, start, endX, endY, c1x, c1y, c2x, c2y } = getAxonGeometry(n);

        // Main axon shaft
        strokeCubic(
          start.x, start.y, c1x, c1y, c2x, c2y, endX, endY,
          axonFire > 0 ? axonFireC : axonColor,
          1.45 + axonFire * 0.8
        );

        // Axon hillock — thicker initial segment at the output pole
        const hillockPt = sampleCubic(start.x, start.y, c1x, c1y, c2x, c2y, endX, endY, 0.1);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(hillockPt.x, hillockPt.y);
        ctx.strokeStyle = axonFire > 0 ? axonFireC : `hsla(34, 50%, 58%, ${vis * 0.9})`;
        ctx.lineWidth   = 2.35 + axonFire * 0.9;
        ctx.lineCap     = "round";
        ctx.stroke();

        // Action-potential wave traveling along the axon
        if (n.firing && n.fireProgress > 0.15 && n.fireProgress < 0.88) {
          const waveT = Math.min(1, (n.fireProgress - 0.15) / 0.7);
          const head  = sampleCubic(start.x, start.y, c1x, c1y, c2x, c2y, endX, endY, waveT);
          const tailT = Math.max(0, waveT - 0.22);
          const tail  = sampleCubic(start.x, start.y, c1x, c1y, c2x, c2y, endX, endY, tailT);
          const waveAlpha = (0.55 + somaFire * 0.35) * opacityMult;

          ctx.beginPath();
          ctx.moveTo(tail.x, tail.y);
          const steps = 8;
          for (let s = 1; s <= steps; s++) {
            const t = tailT + (waveT - tailT) * (s / steps);
            const p = sampleCubic(start.x, start.y, c1x, c1y, c2x, c2y, endX, endY, t);
            ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = `hsla(42, 82%, 68%, ${waveAlpha * 0.58})`;
          ctx.lineWidth   = 2.4 + somaFire * 0.9;
          ctx.lineCap     = "round";
          ctx.stroke();

          const spikeGlow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 9);
          spikeGlow.addColorStop(0,   `rgba(235,175,100,${waveAlpha * 0.34})`);
          spikeGlow.addColorStop(0.45, `rgba(215,145,75,${waveAlpha * 0.16})`);
          spikeGlow.addColorStop(1,   `rgba(255,180,100,0)`);
          ctx.beginPath();
          ctx.arc(head.x, head.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = spikeGlow;
          ctx.fill();
        }

        // Axon terminals + synaptic boutons
        for (const t of n.axon.terminals) {
          const tAngle = axAngle + t.angle;
          const tFire = terminalFire;

          const terminalEnd = drawBranch(
            endX, endY, tAngle, t.length,
            0.75, termColor, termFireC, tFire * 0.45,
            t.curve1, t.curve2
          );

          const drawBouton = (x: number, y: number, radius: number) => {
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.78 + tFire * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = tFire > 0
              ? `hsla(44, 70%, 66%, ${vis * 0.22 + tFire * 0.18})`
              : `hsla(38, 36%, 52%, ${vis * 0.42})`;
            ctx.fill();
            ctx.strokeStyle = `hsla(32, 28%, 42%, ${vis * 0.3})`;
            ctx.lineWidth = 0.45;
            ctx.stroke();
          };

          drawBouton(terminalEnd.x, terminalEnd.y, t.boutonRadius);

          for (const twig of t.twigs) {
            const twigAngle = tAngle + twig.angle;
            const twigEnd = drawBranch(
              terminalEnd.x, terminalEnd.y, twigAngle, twig.length,
              0.5, termColor, termFireC, tFire * 0.35,
              twig.curve1, twig.curve2
            );
            drawBouton(twigEnd.x, twigEnd.y, Math.max(0.9, t.boutonRadius * 0.72));
          }
        }
      }

      // Firing soma flash
      if (somaFire > 0.1) {
        const flashR = n.somaRadius * (1.35 + somaFire * 0.75);
        const flash  = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, flashR);
        flash.addColorStop(0,   `rgba(255,230,180,${somaFire * 0.16 * opacityMult})`);
        flash.addColorStop(0.5, `rgba(255,200,130,${somaFire * 0.045 * opacityMult})`);
        flash.addColorStop(1,   `rgba(255,180,100,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, flashR, 0, Math.PI * 2);
        ctx.fillStyle = flash;
        ctx.fill();
      }

      // Cursor halo — tight, only on interaction
      if (n.cursorGlow > 0.05) {
        const haloR = n.somaRadius * 2.4 + n.cursorGlow * 11;
        const halo  = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        halo.addColorStop(0,    `hsla(44, 100%, 82%, ${n.cursorGlow * 0.08 * opacityMult})`);
        halo.addColorStop(0.6,  `hsla(38,  90%, 65%, ${n.cursorGlow * 0.025 * opacityMult})`);
        halo.addColorStop(1,    `rgba(0,0,0,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
      }

      // Dendritic input glow when receiving stimulation
      if (dendGlow > 0.08 && drawNeurites) {
        const pole = getDendritePole(n);
        const inputGlow = ctx.createRadialGradient(
          n.x + Math.cos(pole) * n.somaRadius * 0.5,
          n.y + Math.sin(pole) * n.somaRadius * 0.5,
          0,
          n.x + Math.cos(pole) * n.somaRadius * 0.5,
          n.y + Math.sin(pole) * n.somaRadius * 0.5,
          n.somaRadius * 2.4
        );
        inputGlow.addColorStop(0,   `hsla(200, 70%, 70%, ${dendGlow * 0.08 * opacityMult})`);
        inputGlow.addColorStop(0.5, `hsla(210, 60%, 55%, ${dendGlow * 0.025 * opacityMult})`);
        inputGlow.addColorStop(1,   `rgba(0,0,0,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.somaRadius * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = inputGlow;
        ctx.fill();
      }

      // Soma membrane — translucent, integrated with the neurites instead of blob-like.
      traceSomaMembrane(n, sr, drawNeurites);
      const somaGrad = ctx.createRadialGradient(
        n.x - sr * 0.35, n.y - sr * 0.35, 0, n.x, n.y, sr
      );
      if (somaFire > 0) {
        somaGrad.addColorStop(0,   `hsla(45, 68%, 76%, ${vis * 0.46})`);
        somaGrad.addColorStop(0.65, `hsla(38, 48%, 56%, ${vis * 0.36})`);
        somaGrad.addColorStop(1,   `hsla(30, 34%, 38%, ${vis * 0.22})`);
      } else {
        somaGrad.addColorStop(0,   `hsla(36, 20%, 62%, ${vis * 0.34})`);
        somaGrad.addColorStop(0.7, `hsla(31, 22%, 46%, ${vis * 0.26})`);
        somaGrad.addColorStop(1,   `hsla(26, 20%, 34%, ${vis * 0.15})`);
      }
      ctx.fillStyle = somaGrad;
      ctx.fill();
      ctx.strokeStyle = `hsla(30, 22%, 42%, ${vis * 0.24})`;
      ctx.lineWidth   = 0.55;
      ctx.stroke();

      // Root collars make dendrites and axon feel continuous through the soma membrane.
      if (drawNeurites) {
        const pole = getDendritePole(n);
        for (const d of n.dendrites) {
          const angle = pole + d.angle;
          const outerRadius = somaRadiusAtAngle(n, angle, sr, true) * 1.14;
          const inner = {
            x: n.x + Math.cos(angle) * sr * 0.16,
            y: n.y + Math.sin(angle) * sr * 0.16,
          };
          const outer = {
            x: n.x + Math.cos(angle) * outerRadius,
            y: n.y + Math.sin(angle) * outerRadius,
          };
          ctx.beginPath();
          ctx.moveTo(inner.x, inner.y);
          ctx.lineTo(outer.x, outer.y);
          ctx.strokeStyle = `hsla(31, 30%, 58%, ${vis * 0.45})`;
          ctx.lineWidth = 1.45;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        const axAngle = getAxonAngle(n);
        const axonOuterRadius = somaRadiusAtAngle(n, axAngle, sr, true) * 1.2;
        const inner = {
          x: n.x + Math.cos(axAngle) * sr * 0.14,
          y: n.y + Math.sin(axAngle) * sr * 0.14,
        };
        const outer = {
          x: n.x + Math.cos(axAngle) * axonOuterRadius,
          y: n.y + Math.sin(axAngle) * axonOuterRadius,
        };
        ctx.beginPath();
        ctx.moveTo(inner.x, inner.y);
        ctx.lineTo(outer.x, outer.y);
        ctx.strokeStyle = `hsla(34, 34%, 60%, ${vis * 0.56})`;
        ctx.lineWidth = 2.05;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Nucleus
      ctx.beginPath();
      ctx.arc(n.x - sr * 0.1, n.y - sr * 0.08, n.somaRadius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = somaFire > 0
        ? `hsla(40, 42%, 52%, ${vis * 0.24})`
        : `hsla(28, 18%, 32%, ${vis * 0.18})`;
      ctx.fill();
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      time++;

      // Fill with background color instead of clearRect (alpha:false context)
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Spontaneous firing starts only from neurons with structural outgoing synapses.
      if (time % 28 === 0) {
        const connectedSources = midIndices.filter(idx =>
          !neurons[idx].firing &&
          neurons[idx].refractoryTimer <= 0 &&
          cachedSynapses.some(s => s.fromIdx === idx)
        );
        if (connectedSources.length > 0) {
          triggerFire(connectedSources[Math.floor(Math.random() * connectedSources.length)]);
        }
      }

      // ── Collect firing neuron indices once per frame ───────────────
      const firingIndices: number[] = [];
      for (let i = 0; i < neurons.length; i++) {
        if (neurons[i].firing) firingIndices.push(i);
      }

      // ── Update all neurons (ECM-anchored tissue physics + firing) ─
      for (let i = 0; i < neurons.length; i++) {
        const n = neurons[i];

        // Spring tether to extracellular-matrix anchor (real somas barely drift).
        const anchorScale = n.layer === 0 ? 1.3 : n.layer === 2 ? 0.7 : 1;
        n.vx += (n.homeX - n.x) * ECM_SPRING * anchorScale;
        n.vy += (n.homeY - n.y) * ECM_SPRING * anchorScale;

        // Thermal Brownian jitter — sub-pixel, not directional drift.
        n.vx += randRange(-BROWNIAN_JITTER, BROWNIAN_JITTER);
        n.vy += randRange(-BROWNIAN_JITTER, BROWNIAN_JITTER);

        // Soft soma repulsion — maintains local spacing like packed cortical tissue.
        for (let j = i + 1; j < neurons.length; j++) {
          const o = neurons[j];
          const odx = n.x - o.x;
          const ody = n.y - o.y;
          const distSq = odx * odx + ody * ody;
          const minDist = MIN_SOMA_SEPARATION * (n.layer === o.layer ? 1 : 0.65);
          if (distSq < minDist * minDist && distSq > 0.25) {
            const dist     = Math.sqrt(distSq);
            const overlap  = minDist - dist;
            const force    = overlap * REPULSION_STRENGTH;
            const normX    = odx / dist;
            const normY    = ody / dist;
            n.vx += normX * force;
            n.vy += normY * force;
            o.vx -= normX * force;
            o.vy -= normY * force;
          }
        }

        n.vx *= ECM_DAMPING;
        n.vy *= ECM_DAMPING;
        const speed = Math.hypot(n.vx, n.vy);
        if (speed > MAX_NEURON_SPEED) {
          n.vx = (n.vx / speed) * MAX_NEURON_SPEED;
          n.vy = (n.vy / speed) * MAX_NEURON_SPEED;
        }

        n.x += n.vx;
        n.y += n.vy;
        n.pulsePhase += n.pulseSpeed;
        n.rotation   += n.rotationSpeed;

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
              const outgoing = cachedSynapses.filter(s => s.fromIdx === i);
              const MAX_OUT = Math.random() < 0.35 ? 3 : 2;
              let emitted = 0;
              for (const synapse of outgoing) {
                if (emitted >= MAX_OUT) break;
                // Probabilistic release — most structural synapses stay quiet.
                if (Math.random() < 0.58) {
                  synapticSpikes.push({
                    fromNeuronIdx: i,
                    toNeuronIdx:   synapse.toIdx,
                    fromPoint:     { x: synapse.termX, y: synapse.termY },
                    toPoint:       { x: synapse.tipX, y: synapse.tipY },
                    progress:      0,
                    speed:         0.018 + Math.random() * 0.012,
                    active:        true,
                    trailPoints:   [],
                  });
                  emitted++;
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
          if (
            n.layer === 1 &&
            cachedSynapses.some(s => s.fromIdx === i) &&
            cdx * cdx + cdy * cdy < CLICK_R_SQ
          ) triggerFire(i);
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
          if (target) target.stimulation += 0.34 + Math.random() * 0.18;

          if (spike.trailPoints.length >= 3) {
            synapticTrails.push({
              points:    spike.trailPoints,
              alpha:     0.9,
              fadeSpeed: 0.005 + Math.random() * 0.006,
              hue:       200 + Math.random() * 25,
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
        if (speed > 0.55) { v.vx = (v.vx / speed) * 0.55; v.vy = (v.vy / speed) * 0.55; }
        v.vx *= 0.988;
        v.vy *= 0.988;
        v.vx += randRange(-0.004, 0.004);
        v.vy += randRange(-0.004, 0.004);
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

        // ── Mid-layer: live spikes + trails only (no static filaments) ──
        if (layerIdx === 1) {
          ctx.lineCap = "round";

          // Structural N:M axon-to-dendrite links — faint baseline connectome.
          ctx.save();
          ctx.lineCap = "round";
          for (const synapse of cachedSynapses) {
            const alpha = Math.max(0.018, 0.075 * (1 - synapse.dist / (SYNAPSE_DIST * 1.35)));
            const mx = (synapse.termX + synapse.tipX) * 0.5;
            const my = (synapse.termY + synapse.tipY) * 0.5;
            ctx.beginPath();
            ctx.moveTo(synapse.termX, synapse.termY);
            ctx.quadraticCurveTo(mx, my - synapse.dist * 0.04, synapse.tipX, synapse.tipY);
            ctx.strokeStyle = `hsla(38, 40%, 58%, ${alpha})`;
            ctx.lineWidth = 0.65;
            ctx.stroke();
          }
          ctx.restore();

          // Local dendrite contacts — short, dim bridges only where arbors nearly touch.
          ctx.save();
          ctx.lineCap = "round";
          for (const contact of cachedDendriteContacts) {
            ctx.beginPath();
            ctx.moveTo(contact.x1, contact.y1);
            ctx.lineTo(contact.x2, contact.y2);
            ctx.strokeStyle = `hsla(34, 38%, 56%, ${contact.alpha * 0.16})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();

            const cx = (contact.x1 + contact.x2) * 0.5;
            const cy = (contact.y1 + contact.y2) * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(40, 45%, 64%, ${contact.alpha * 0.22})`;
            ctx.fill();
          }
          ctx.restore();

          // Synaptic transmission — neurotransmitter pulse from bouton to dendrite
          for (const spike of synapticSpikes) {
            if (!spike.active) continue;
            const { fromPoint: fp, toPoint: tp } = spike;
            const dx   = tp.x - fp.x;
            const dy   = tp.y - fp.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const mx   = (fp.x + tp.x) / 2;
            const my   = (fp.y + tp.y) / 2 - dist * 0.1;
            const t    = spike.progress;
            const x    = (1 - t) * (1 - t) * fp.x + 2 * (1 - t) * t * mx + t * t * tp.x;
            const y    = (1 - t) * (1 - t) * fp.y + 2 * (1 - t) * t * my + t * t * tp.y;

            const fadeIn  = Math.min(t * 6, 1);
            const fadeOut = Math.min((1 - t) * 4, 1);
            const alpha   = fadeIn * fadeOut;

            // Faint synaptic cleft path
            ctx.beginPath();
            ctx.moveTo(fp.x, fp.y);
            ctx.quadraticCurveTo(mx, my, tp.x, tp.y);
            ctx.strokeStyle = `hsla(205, 75%, 72%, ${alpha * 0.22})`;
            ctx.lineWidth   = 1.8;
            ctx.stroke();

            // Comet tail behind the traveling vesicle
            const tailT = Math.max(0, t - 0.18);
            const tailX = (1 - tailT) * (1 - tailT) * fp.x + 2 * (1 - tailT) * tailT * mx + tailT * tailT * tp.x;
            const tailY = (1 - tailT) * (1 - tailT) * fp.y + 2 * (1 - tailT) * tailT * my + tailT * tailT * tp.y;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = `hsla(42, 80%, 68%, ${alpha * 0.56})`;
            ctx.lineWidth   = 2.2;
            ctx.lineCap     = "round";
            ctx.stroke();

            const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
            glow.addColorStop(0,   `rgba(225,170,100,${alpha * 0.38})`);
            glow.addColorStop(0.45, `rgba(205,135,75,${alpha * 0.18})`);
            glow.addColorStop(1,   `rgba(255,190,110,0)`);
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, 2.3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(230,165,95,${alpha * 0.72})`;
            ctx.fill();
          }

          // Lingering synaptic trails after transmission
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

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi].x, pts[pi].y);
            ctx.strokeStyle = `hsla(${trail.hue}, 80%, 68%, ${trail.alpha * 0.15})`;
            ctx.lineWidth   = 5;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi].x, pts[pi].y);
            ctx.strokeStyle = `hsla(${trail.hue + 5}, 95%, 88%, ${trail.alpha * 0.82})`;
            ctx.lineWidth   = 1.8;
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw neurons for this layer
        for (let ni = 0; ni < neurons.length; ni++) {
          if (neurons[ni].layer !== layerIdx) continue;
          drawNeuron(neurons[ni], cfg.opacity, layerIdx === 1);
        }
      }

      // ── Fog patches (rendered to offscreen canvas, no blur filter) ─
      if (FOG_COUNT > 0) {
        fogUpdateCounter++;
        if (fogUpdateCounter >= FOG_UPDATE_INTERVAL || fogDirty) {
          fogUpdateCounter = 0;
          fogDirty = false;
          renderFogOffscreen();
        }
        ctx.drawImage(fogCanvas, 0, 0);
      }

      // ── Vignette (cached offscreen) ────────────────────────────────
      if (vignetteNeedsRender) renderVignette();
      ctx.drawImage(vignetteCanvas, 0, 0);

      // (Noise texture overlay removed — was producing visible diagonal streaks.)


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
