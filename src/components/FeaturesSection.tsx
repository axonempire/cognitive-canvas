import { motion } from "framer-motion";
import { Zap, BrainCircuit, Network, Atom, Waves, CircuitBoard } from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "Connectome",
    subtitle: "Living Architecture",
    description:
      "A continuously mapped neural topology that rewires itself, forming new pathways with every interaction.",
  },
  {
    icon: Zap,
    title: "Action Potentials",
    subtitle: "Sodium-Potassium Cascade",
    description:
      "Ion channels fire in precise sequences — voltage-gated signals that propagate intelligence through the network.",
  },
  {
    icon: Network,
    title: "Dendrites & Axons",
    subtitle: "Signal Pathways",
    description:
      "Branching input receivers and long-range transmitters form the communication backbone of every thought.",
  },
  {
    icon: Atom,
    title: "Glial Support",
    subtitle: "Astrocytes & Oligodendrocytes",
    description:
      "Support cells that nourish, insulate, and maintain the network — the unsung infrastructure of cognition.",
  },
  {
    icon: Waves,
    title: "Synaptic Plasticity",
    subtitle: "Hebbian Learning",
    description:
      "Connections that fire together wire together. The network strengthens through use and prunes through neglect.",
  },
  {
    icon: CircuitBoard,
    title: "Soma Processing",
    subtitle: "Cell Body Integration",
    description:
      "The computational core where signals converge, integrate, and decide whether to propagate further.",
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
