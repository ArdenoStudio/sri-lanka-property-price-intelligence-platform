import { motion } from 'framer-motion';
import ArdenoProductionCredit from './ArdenoProductionCredit';

export function Footer() {
  return (
    <footer id="contact" className="relative bg-[#080809] overflow-hidden mt-10">
      {/* Top border */}
      <div
        className="w-full h-px opacity-20"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5) 20%, rgba(255,255,255,0.2) 50%, rgba(99,102,241,0.5) 80%, transparent)',
        }}
      />
      
      {/* Grain / Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px',
        }}
      />
      
      <div className="py-8 flex flex-col items-center">
        <ArdenoProductionCredit color="#6366f1" />
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-[10px] text-zinc-600 tracking-[0.3em] uppercase pb-4"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          © {new Date().getFullYear()} Ardeno Studio
        </motion.div>
      </div>
    </footer>
  );
}
