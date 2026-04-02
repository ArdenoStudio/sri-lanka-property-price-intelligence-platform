import React, { useEffect, useRef, useState } from 'react';

const ArdenoProductionCredit: React.FC<{ color?: string }> = ({ color = "#E50914" }) => {
  const [isAutoShining, setIsAutoShining] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayedOnce) {
          setIsAutoShining(true);
          setHasPlayedOnce(true);
          setTimeout(() => {
            setIsAutoShining(false);
          }, 2000);
        }
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasPlayedOnce]);

  return (
    <div 
      ref={containerRef}
      className="w-full flex flex-col items-center justify-center pt-12 pb-12 bg-transparent pointer-events-auto"
    >
      <style>{`
        @keyframes shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shine-text {
          color: rgba(255, 255, 255, 0.4);
          transition: all 0.7s ease;
        }
        .auto-shine {
          animation: shine 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          background: linear-gradient(110deg, rgba(255,255,255,0.3) 40%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.3) 60%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .group:hover .shine-text {
          animation: shine 1.5s linear infinite;
          background: linear-gradient(110deg, rgba(255,255,255,0.5) 40%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.5) 60%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
      `}</style>
      <div 
        className="flex flex-col items-center gap-4 group cursor-pointer" 
        onClick={() => window.open('https://ardenostudio.com', '_blank')}
      >
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-white/5 group-hover:bg-white/10 transition-all duration-1000 rounded-full scale-150" />
          <svg
            className="ardeno-mark relative z-10 opacity-70 group-hover:opacity-100 transition-all duration-700"
            viewBox="240 600 285 300"
            xmlns="http://www.w3.org/2000/svg"
            style={{ height: 36, width: "auto" }}
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              fill={color}
              d="M 514.300781 878.699219 L 434.792969 718.777344 C 411.382812 739.714844 390.78125 776.453125 391.929688 806.554688 L 415.984375 853.996094 C 416.851562 855.699219 418.324219 857.015625 420.113281 857.679688 L 504.851562 889.203125 C 511.304688 891.605469 517.367188 884.867188 514.300781 878.699219 Z M 371.617188 791.304688 C 371.410156 791.605469 371.222656 791.925781 371.054688 792.265625 L 340.871094 853.445312 C 340.011719 855.183594 338.523438 856.527344 336.707031 857.207031 L 250.40625 889.308594 C 243.988281 891.699219 237.9375 885.042969 240.917969 878.878906 L 369.019531 614.007812 C 371.769531 608.324219 379.851562 608.277344 382.664062 613.929688 L 432.074219 713.316406 C 404.980469 732.679688 383.765625 759.746094 371.617188 791.304688"
            />
          </svg>
        </div>
        
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/30 group-hover:text-white/50 transition-all duration-700">
            An Ardeno Production
          </span>
          <span 
            className={`shine-text font-medium tracking-[0.15em] text-lg italic transition-all duration-700 ${isAutoShining ? 'auto-shine' : ''}`}
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Based in LK
          </span>
        </div>
      </div>
    </div>
  );
};

export default ArdenoProductionCredit;
