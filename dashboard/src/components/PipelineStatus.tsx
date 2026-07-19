import type { PipelineStatusResponse, PipelineJobStatus } from '../api';

interface Props {
  status: PipelineStatusResponse | null;
}

const LABELS: Record<string, string> = {
  scrape_ikman: 'ikman.lk',
  scrape_lpw: 'LPW',
  scrape_onlineproperty: 'onlineproperty.lk',
  scrape_lamudi: 'house.lk',
  clean_listings: 'Cleaner',
  geocode_listings: 'Geocoder',
  compute_aggregates: 'Aggregates',
};

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'just now';

  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
}

function statusWord(status: PipelineJobStatus['status']): 'ok' | 'running' | 'delayed' {
  if (status === 'ok' || status === 'running' || status === 'delayed') return status;
  return 'delayed';
}

function jobLabel(job: PipelineJobStatus): string {
  return job.label ?? LABELS[job.name] ?? job.name;
}

function isSourceJob(job: PipelineJobStatus): boolean {
  return job.kind === 'scrape' || job.name.startsWith('scrape_');
}

export function PipelineStatus({ status }: Props) {
  if (status === null) {
    return (
      <section aria-label="Pipeline status" className="border-y border-white/[0.08] py-3">
        <p className="font-body text-[12px] text-[#525252]">Checking sources…</p>
      </section>
    );
  }

  const sources = status.jobs.filter(isSourceJob);

  if (sources.length === 0) {
    return (
      <section aria-label="Pipeline status" className="border-y border-white/[0.08] py-3">
        <p className="font-body text-[12px] text-[#525252]">
          Overall <span className="text-[#a3a3a3]">{statusWord(status.overall_status)}</span>
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Pipeline status" className="border-y border-white/[0.08] py-3">
      <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-body text-[12px] text-[#a3a3a3]">
        {sources.map((job) => (
          <li key={job.name} className="flex items-baseline gap-2">
            <span className="text-white">{jobLabel(job)}</span>
            <span className="text-[#525252]">·</span>
            <span className="num">{formatRelativeTime(job.last_success)}</span>
            <span className="text-[#525252]">·</span>
            <span className="text-[#737373]">{statusWord(job.status)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
