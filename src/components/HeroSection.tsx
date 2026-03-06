import { motion } from "framer-motion";

const HeroSection = () => (
  <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
    <div className="max-w-4xl mx-auto text-center">
      {/* Ambient glow behind title */}
      <div className="absolute inset-0 gradient-neural pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="font-body text-sm tracking-[0.3em] uppercase text-primary/70 mb-8"
        >
          Self-Preserving · Continuously Evolving
        </motion.p>

        <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-foreground text-glow leading-[0.9] mb-6">
          Spike
          <br />
          <span className="text-primary italic">Machines</span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mt-8 leading-relaxed"
        >
          An artificial connectome that breathes and remembers. Neurons fire, dendrites reach,
          glia nurture; a warm, living memory system woven from the same fabric
          as thought itself.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button className="font-body px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-medium tracking-wide hover:opacity-90 transition-opacity box-glow">
            Enter the Connectome
          </button>
          <button className="font-body px-8 py-3.5 rounded-lg border border-border text-foreground/70 hover:text-foreground hover:border-glow transition-all">
            Read the Whitepaper
          </button>
        </motion.div>
      </motion.div>

      {/* Scrolling hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-muted-foreground/30 flex items-start justify-center p-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-primary/60" />
        </motion.div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
