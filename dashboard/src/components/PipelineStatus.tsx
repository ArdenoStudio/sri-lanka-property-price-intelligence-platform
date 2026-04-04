import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PipelineStatusResponse, PipelineJobStatus } from '../api';

interface Props {
  status: PipelineStatusResponse | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
}

function statusIcon(status: PipelineJobStatus['status']) {
  if (status === 'ok') return CheckCircle2;
  if (status === 'running') return Loader2;
  return AlertTriangle;
}

function statusClass(status: PipelineJobStatus['status']) {
  if (status === 'ok') return 'text-emerald-300';
  if (status === 'running') return 'text-amber-300';
  return 'text-rose-300';
}

const LABELS: Record<string, string> = {
  scrape_ikman: 'Ikman Scrape',
  scrape_lpw: 'LPW Scrape',
  clean_listings: 'Cleaner',
  geocode_listings: 'Geocoder',
  compute_aggregates: 'Aggregates',
};

export function PipelineStatus({ status }: Props) {
  const jobs = status?.jobs ?? [];
  const overall = status?.overall_status ?? 'delayed';

  return (
    <section className="pt-6 pb-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-light" />
          <h3 className="text-sm font-black uppercase tracking-widest text-text-muted">
            Pipeline Status
          </h3>
        </div>
        <div
          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
            overall === 'ok'
              ? 'text-emerald-300 border-emerald-300/30 bg-emerald-500/10'
              : overall === 'running'
              ? 'text-amber-300 border-amber-300/30 bg-amber-500/10'
              : 'text-rose-300 border-rose-300/30 bg-rose-500/10'
          }`}
        >
          {overall}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {jobs.map((job, idx) => {
          const Icon = statusIcon(job.status);
          return (
            <motion.div
              key={job.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className="rounded-xl p-4 border bg-bg-card border-border hover:border-border-hover transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${statusClass(job.status)} ${job.status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                  {LABELS[job.name] ?? job.name}
                </span>
              </div>
              <div className="text-lg font-black text-text-primary">
                {job.status}
              </div>
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Last Success: {formatDate(job.last_success)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
