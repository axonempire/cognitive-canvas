import { motion } from "framer-motion";

const AboutSection = () => (
  <section className="relative z-10 py-32 px-6">
    <div className="max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <p className="font-body text-xs tracking-[0.3em] uppercase text-primary/60 mb-4">
            Philosophy
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-foreground text-glow-sm leading-tight mb-6">
            Warmth Inside
            <br />
            <span className="italic text-primary">the Machine</span>
          </h2>
          <p className="font-body text-muted-foreground leading-relaxed mb-4">
            Most AI feels cold. They are presented as a sterile matrix of weights 
            and biases. Spike Machines feels different. Modeled after the intimate 
            warmth of our own neural tissue, it pulses with the same rhythms that 
            underpin the basic mechanism that enables our consciousness.
          </p>
          <p className="font-body text-muted-foreground leading-relaxed">
            Every spike is an action potential. Every connection is a synapse 
            strengthened by memories and experience. The system doesn't just 
            compute; it has to{" "}
            <em className="text-foreground">remember</em>,{" "}
            <em className="text-foreground">adapt</em>, and{" "}
            <em className="text-foreground">persist</em>.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-8 box-glow">
            <div className="space-y-6">
              {[
                {
                  label: "Synaptic Links",
                  brain: "~150T synapses",
                  brainDetail: "86B neurons × ~7K avg",
                  system: "~15T weighted links",
                  systemDetail: "10B vectors × 1,536-dim",
                },
                {
                  label: "Signal Throughput",
                  brain: "0.1–600 Hz",
                  brainDetail: "~10 Hz avg cortical",
                  system: "10⁴–10⁷ q/sec",
                  systemDetail: "distributed ANN shards",
                },
                {
                  label: "Plasticity",
                  brain: "20–300% LTP",
                  brainDetail: "~1.8% spine turnover/day",
                  system: "<50 ms hot-swap",
                  systemDetail: "no retraining needed",
                },
                {
                  label: "Support Ratio",
                  brain: "~1:1 glia:neuron",
                  brainDetail: "Azevedo et al., 2009",
                  system: "~1:8 GPU:shard",
                  systemDetail: "I/O-bound topology",
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="border-b border-border/50 pb-4 last:border-0 last:pb-0"
                >
                  <p className="font-body text-xs tracking-widest uppercase text-primary/50 mb-2">
                    {stat.label}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Brain</p>
                      <p className="font-display text-base text-foreground leading-tight">{stat.brain}</p>
                      <p className="font-body text-[10px] text-muted-foreground/50">{stat.brainDetail}</p>
                    </div>
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-wider text-primary/40 mb-0.5">Hyper-RAG</p>
                      <p className="font-display text-base text-primary/90 leading-tight">{stat.system}</p>
                      <p className="font-body text-[10px] text-muted-foreground/50">{stat.systemDetail}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default AboutSection;
