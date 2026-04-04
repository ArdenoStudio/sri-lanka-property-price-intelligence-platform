import { RefreshCw, Shield, MessageSquare } from 'lucide-react';
import type { Stats } from '../api';
import { DataFlowBeam } from './DataFlowBeam';

interface Props {
  stats: Stats | null;
}

export function About({ stats: _stats }: Props) {
  return (
    <section className="mt-16 pt-12 border-t border-border">
      <div className="text-center mb-10">
        <h3 className="text-2xl font-bold mb-2">About This Platform</h3>
        <p className="text-text-secondary text-sm max-w-lg mx-auto">
          An open-source property intelligence tool for Sri Lanka, built by Ardeno Studio.
        </p>
      </div>

      <div className="mb-6">
        <DataFlowBeam />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl bg-bg-card border border-border p-5">
          <RefreshCw className="w-6 h-6 text-success mb-3" />
          <h4 className="font-semibold text-sm mb-1">Update Frequency</h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Automated scrapers run daily at 2:00 AM UTC. Data is cleaned,
            geocoded, and aggregated automatically.
          </p>
        </div>

        <div className="rounded-xl bg-bg-card border border-border p-5">
          <Shield className="w-6 h-6 text-warning mb-3" />
          <h4 className="font-semibold text-sm mb-1">Data Quality</h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            Outlier detection, duplicate flagging, and price normalization
            ensure reliable market insights.
          </p>
        </div>

        <div className="rounded-xl bg-bg-card border border-border p-5">
          <MessageSquare className="w-6 h-6 text-danger mb-3" />
          <h4 className="font-semibold text-sm mb-1">Send Feedback</h4>
          <p className="text-xs text-text-secondary leading-relaxed mb-2">
            This is a beta release. We'd love to hear what features you want next.
          </p>
          <a
            href="https://forms.gle/placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-light hover:underline no-underline"
          >
            Share feedback &rarr;
          </a>
        </div>
      </div>

      {/* Tech stack */}
      <div className="flex flex-wrap justify-center gap-2">
        {['FastAPI', 'PostgreSQL', 'Playwright', 'React', 'Leaflet', 'Tailwind CSS'].map((tech) => (
          <span key={tech} className="px-3 py-1 rounded-full text-[10px] font-medium bg-bg-secondary border border-border text-text-muted">
            {tech}
          </span>
        ))}
      </div>
    </section>
  );
}
