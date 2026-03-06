import { motion } from "framer-motion";

const Footer = () => (
  <footer className="relative z-10 border-t border-border/50 py-12 px-6">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="font-display text-lg text-foreground">Spike Machines</span>
      </div>
      <p className="font-body text-xs text-muted-foreground tracking-wide">
        A living network. Always firing. Always evolving.
      </p>
    </div>
  </footer>
);

export default Footer;
