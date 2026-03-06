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
            Most AI feels cold — sterile matrices of weight and bias. Spike Machines 
            is different. Modeled after the intimate warmth of your own neural tissue, 
            it pulses with the same rhythms that underpin consciousness.
          </p>
          <p className="font-body text-muted-foreground leading-relaxed">
            Every spike is an action potential. Every connection is a synapse 
            strengthened by experience. The system doesn't just compute — 
            it <em className="text-foreground">remembers</em>, it{" "}
            <em className="text-foreground">adapts</em>, it{" "}
            <em className="text-foreground">persists</em>.
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
                { label: "Neural Density", value: "12.4B", unit: "connections" },
                { label: "Spike Rate", value: "847", unit: "Hz avg" },
                { label: "Plasticity Index", value: "0.94", unit: "adaptive" },
                { label: "Glia Ratio", value: "3:1", unit: "support cells" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="flex items-baseline justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0"
                >
                  <span className="font-body text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                  <div className="text-right">
                    <span className="font-display text-2xl text-foreground">
                      {stat.value}
                    </span>
                    <span className="font-body text-xs text-primary/60 ml-2">
                      {stat.unit}
                    </span>
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
