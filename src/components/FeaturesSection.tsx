import { motion } from "framer-motion";
import { Zap, BrainCircuit, Network, Atom, Waves, CircuitBoard } from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "Connectome",
    subtitle: "Graph-Native Memory",
    description:
      "A living knowledge graph where nodes are engrams and edges are weighted by experience — traversed like a database, felt like a memory.",
  },
  {
    icon: Zap,
    title: "Action Potentials",
    subtitle: "Sparse Activation Vectors",
    description:
      "Signals propagate through voltage-gated embeddings. Each spike is a query; each cascade, a retrieval from the substrate of learned patterns.",
  },
  {
    icon: Network,
    title: "Dendrites & Axons",
    subtitle: "RAG Pathways",
    description:
      "Branching receivers gather context from distributed stores. Long-range projectors route augmented signals to downstream reasoning centers.",
  },
  {
    icon: Atom,
    title: "Glial Support",
    subtitle: "Index & Cache Layer",
    description:
      "Background processes that maintain embedding indices, prune stale connections, and ensure retrieval latency stays within biological tolerances.",
  },
  {
    icon: Waves,
    title: "Synaptic Plasticity",
    subtitle: "Adaptive Embeddings",
    description:
      "Connections that co-activate strengthen their edge weights. The graph rewires through use — Hebbian learning meets gradient descent.",
  },
  {
    icon: CircuitBoard,
    title: "Soma Processing",
    subtitle: "Attention Integration",
    description:
      "The cell body where retrieved contexts converge, cross-attend, and resolve into coherent output — a biological transformer layer.",
  },
];

const FeatureCard = ({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) => {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="group relative rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 hover:border-glow hover:box-glow transition-all duration-500"
    >
      <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-muted p-2.5">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-xl text-foreground mb-1">{feature.title}</h3>
      <p className="text-xs font-body text-primary/70 tracking-widest uppercase mb-3">
        {feature.subtitle}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed font-body">
        {feature.description}
      </p>
    </motion.div>
  );
};

const FeaturesSection = () => (
  <section className="relative z-10 py-32 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="font-display text-4xl md:text-5xl text-foreground text-glow-sm mb-4">
          The Neural Substrate
        </h2>
        <p className="text-muted-foreground font-body max-w-2xl mx-auto text-lg">
          Every component mirrors biological neural architecture — 
          a machine that thinks the way brains do.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
