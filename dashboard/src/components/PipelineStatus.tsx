import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
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

function statusColor(status: PipelineJobStatus['status']) {
  if (status === 'ok') return '#10b981';
  if (status === 'running') return '#f59e0b';
  return '#ef4444';
}

const LABELS: Record<string, string> = {
  scrape_ikman: 'Ikman',
  scrape_lpw: 'LPW',
  clean_listings: 'Cleaner',
  geocode_listings: 'Geocoder',
  compute_aggregates: 'Aggregates',
};

export function PipelineStatus({ status }: Props) {
  const jobs = status?.jobs ?? [];
  const overall = status?.overall_status ?? 'delayed';

  const overallColor =
    overall === 'ok' ? '#10b981' : overall === 'running' ? '#f59e0b' : '#ef4444';

  return (
    <section className="py-4">
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
        {/* Single unified row */}
        <div className="flex items-center divide-x divide-border">

          {/* Left label */}
          <div className="flex items-center gap-2 px-5 py-4 shrink-0">
            <Activity className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted whitespace-nowrap">
              Pipeline
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: overallColor, boxShadow: `0 0 5px ${overallColor}` }}
            />
          </div>

          {/* Jobs */}
          {jobs.map((job) => {
            const Icon = statusIcon(job.status);
            const color = statusColor(job.status);
            return (
              <div
                key={job.name}
                className="flex-1 flex items-center gap-2.5 px-5 py-4 hover:bg-bg-card-hover transition-colors"
              >
                <Icon
                  className="w-3 h-3 shrink-0"
                  style={{
                    color,
                    animation: job.status === 'running' ? 'spin 1s linear infinite' : undefined,
                  }}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-text-primary leading-none truncate">
                    {LABELS[job.name] ?? job.name}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-none">
                    {formatDate(job.last_success)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
