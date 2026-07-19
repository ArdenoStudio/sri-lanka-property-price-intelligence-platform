import type { CSSProperties } from 'react';
import '@fontsource/cal-sans';
import '@fontsource-variable/inter';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, Loader2 } from 'lucide-react';
import type { PipelineStatusResponse, PipelineJobStatus } from '../api';

interface Props {
  status: PipelineStatusResponse | null;
}

const LABELS: Record<string, string> = {
  scrape_ikman: 'ikman API',
  scrape_lpw: 'LPW API',
  scrape_onlineproperty: 'onlineproperty.lk',
  scrape_lamudi: 'house.lk',
  clean_listings: 'Cleaner',
  geocode_listings: 'Geocoder',
  compute_aggregates: 'Aggregates',
};

const JOB_ORDER = [
  'scrape_ikman',
  'scrape_lpw',
  'scrape_onlineproperty',
  'scrape_lamudi',
  'clean_listings',
  'geocode_listings',
  'compute_aggregates',
];

const BODY_FONT: CSSProperties = {
  fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const DISPLAY_FONT: CSSProperties = {
  fontFamily: '"Cal Sans", "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  letterSpacing: '-0.04em',
};

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Invalid time';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'Just now';

  const diffHrs = Math.floor(diffMs / 3_600_000);
  if (diffHrs < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAbsoluteTime(iso: string | null | undefined): string {
  if (!iso) return 'No data';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Invalid time';
  return d.toLocaleString('en-LK', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString();
}

function formatSchedule(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? 'Daily SLA' : `${days} day SLA`;
  }
  return `${hours}h SLA`;
}

function statusLabel(status: PipelineJobStatus['status']) {
  if (status === 'ok') return 'Healthy';
  if (status === 'running') return 'Running';
  return 'Delayed';
}

function statusTone(status: PipelineJobStatus['status']) {
  if (status === 'ok') {
    return {
      text: '#bbf7d0',
      border: 'rgba(52, 211, 153, 0.18)',
      background: 'rgba(52, 211, 153, 0.08)',
      accent: '#34d399',
    };
  }

  if (status === 'running') {
    return {
      text: '#fde68a',
      border: 'rgba(251, 191, 36, 0.18)',
      background: 'rgba(251, 191, 36, 0.08)',
      accent: '#fbbf24',
    };
  }

  return {
    text: '#fecaca',
    border: 'rgba(248, 113, 113, 0.18)',
    background: 'rgba(248, 113, 113, 0.08)',
    accent: '#f87171',
  };
}

function orderFor(job: PipelineJobStatus): number {
  const index = JOB_ORDER.indexOf(job.name);
  return index === -1 ? JOB_ORDER.length : index;
}

function jobLabel(job: PipelineJobStatus): string {
  return job.label ?? LABELS[job.name] ?? job.name;
}

function StatusGlyph({
  status,
  className,
  style,
}: {
  status: PipelineJobStatus['status'];
  className?: string;
  style?: CSSProperties;
}) {
  if (status === 'ok') return <CheckCircle2 className={className} style={style} />;
  if (status === 'running') return <Loader2 className={className} style={style} />;
  return <AlertTriangle className={className} style={style} />;
}

function StatusPill({ status }: { status: PipelineJobStatus['status'] }) {
  const tone = statusTone(status);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.16em]"
      style={{
        ...BODY_FONT,
        color: tone.text,
        borderColor: tone.border,
        background: tone.background,
      }}
    >
      <StatusGlyph
        status={status}
        className="h-3 w-3 shrink-0"
        style={{
          color: tone.accent,
          animation: status === 'running' ? 'spin 1s linear infinite' : undefined,
        }}
      />
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[#525252]" style={BODY_FONT}>{label}</p>
        <Icon className="h-3.5 w-3.5 text-[#404040]" />
      </div>
      <p className="mt-3 font-display text-[1.5rem] leading-none text-white" style={DISPLAY_FONT}>{value}</p>
      <p className="mt-2 font-body text-[11px] text-[#737373]" style={BODY_FONT}>{caption}</p>
    </div>
  );
}

function PipelineStatusSkeleton() {
  return (
    <section className="py-4">
      <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111111]">
        <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <div className="p-6 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-10 w-52 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-72 animate-pulse rounded bg-white/[0.04]" />
              </div>
              <div className="h-8 w-28 animate-pulse rounded-md bg-white/[0.06]" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
                  <div className="mt-4 h-8 w-24 animate-pulse rounded bg-white/[0.06]" />
                  <div className="mt-3 h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="grid min-w-[760px] grid-cols-[minmax(0,1.55fr)_130px_150px_150px_140px] gap-3 border-b border-white/[0.08] bg-black/35 px-4 py-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-3 animate-pulse rounded bg-white/[0.05]" />
                ))}
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="grid min-w-[760px] grid-cols-[minmax(0,1.55fr)_130px_150px_150px_140px] gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0"
                >
                  {Array.from({ length: 5 }).map((__, j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 animate-pulse rounded bg-white/[0.06]" />
                      <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/[0.04]" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.08] bg-black/25 p-6 lg:border-l lg:border-t-0 lg:p-7">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-8 w-40 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="mt-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.08] p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
                  <div className="mt-3 h-3 w-16 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-4 h-3 w-full animate-pulse rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PipelineStatus({ status }: Props) {
  const loading = status === null;

  if (loading) {
    return <PipelineStatusSkeleton />;
  }

  const jobs = [...status.jobs].sort((a, b) => orderFor(a) - orderFor(b));
  const overall = status.overall_status;
  const sourceJobs = jobs.filter((job) => job.kind === 'scrape' || job.name.startsWith('scrape_'));
  const downstreamJobs = jobs.filter((job) => !(job.kind === 'scrape' || job.name.startsWith('scrape_')));
  const healthySources = sourceJobs.filter((job) => job.status === 'ok').length;
  const delayedJobs = jobs.filter((job) => job.status === 'delayed').length;
  const trackedListings = sourceJobs.reduce((sum, job) => sum + (job.listing_count ?? 0), 0);
  const latestSuccess = jobs
    .map((job) => job.last_success)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return (
    <section className="py-4">
      <div
        className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111111] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        style={BODY_FONT}
      >
        <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <div className="p-6 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.22em] text-[#525252]" style={BODY_FONT}>
                  Pipeline Status
                </p>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-[0.92] text-white" style={DISPLAY_FONT}>
                  Source Ops
                </h2>
                <p className="mt-3 max-w-2xl font-body text-[12px] leading-relaxed text-[#737373]" style={BODY_FONT}>
                  Monitor ikman and LPW scraper health, last probe recency, and stored listing volume in a denser
                  admin-style layout.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="font-body text-[10px] uppercase tracking-[0.16em] text-[#404040]" style={BODY_FONT}>Overall</p>
                  <p className="mt-1 font-body text-[11px] text-[#737373]" style={BODY_FONT}>
                    Refreshed {formatRelativeTime(status.generated_at)}
                  </p>
                </div>
                <StatusPill status={overall} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={Activity}
                label="Sources"
                value={`${healthySources}/${sourceJobs.length || 0}`}
                caption={sourceJobs.length > 0 ? `${healthySources} healthy at last check` : 'No source jobs reported'}
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Delayed"
                value={String(delayedJobs)}
                caption={delayedJobs === 0 ? 'No pipeline delays flagged' : 'Jobs outside freshness window'}
              />
              <SummaryCard
                icon={Database}
                label="Listings"
                value={formatCount(trackedListings)}
                caption={
                  sourceJobs[0]?.listing_count_source === 'raw'
                    ? 'Raw listings currently visible'
                    : 'Clean listings currently visible'
                }
              />
              <SummaryCard
                icon={Clock3}
                label="Last success"
                value={formatRelativeTime(latestSuccess)}
                caption={latestSuccess ? formatAbsoluteTime(latestSuccess) : 'No successful runs recorded'}
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(0,1.55fr)_130px_150px_150px_140px] gap-3 border-b border-white/[0.08] bg-black/35 px-4 py-3">
                    {['Source', 'Health', 'Last probe', 'Last success', 'Listings'].map((heading) => (
                      <p
                        key={heading}
                        className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-[#525252]"
                        style={BODY_FONT}
                      >
                        {heading}
                      </p>
                    ))}
                  </div>

                  {sourceJobs.map((job) => (
                    <div
                      key={job.name}
                      className="grid grid-cols-[minmax(0,1.55fr)_130px_150px_150px_140px] gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{ background: statusTone(job.status).accent }}
                            aria-hidden="true"
                          />
                          <p className="truncate font-body text-[13px] font-semibold text-white" style={BODY_FONT}>{jobLabel(job)}</p>
                        </div>
                        <p className="mt-1 truncate font-body text-[11px] text-[#737373]" style={BODY_FONT}>
                          {formatSchedule(job.expected_hours)}
                          {typeof job.last_found_count === 'number' ? ` · ${formatCount(job.last_found_count)} seen last probe` : ''}
                        </p>
                      </div>

                      <div className="flex items-start">
                        <StatusPill status={job.status} />
                      </div>

                      <div>
                        <p className="font-body text-[12px] font-medium text-white num" style={BODY_FONT}>
                          {formatRelativeTime(job.last_probe ?? job.last_run)}
                        </p>
                        <p className="mt-1 font-body text-[10px] text-[#525252]" style={BODY_FONT}>
                          {formatAbsoluteTime(job.last_probe ?? job.last_run)}
                        </p>
                      </div>

                      <div>
                        <p className="font-body text-[12px] font-medium text-white num" style={BODY_FONT}>
                          {formatRelativeTime(job.last_success)}
                        </p>
                        <p className="mt-1 font-body text-[10px] text-[#525252]" style={BODY_FONT}>
                          {formatAbsoluteTime(job.last_success)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-body text-[14px] font-semibold text-white num" style={BODY_FONT}>
                          {formatCount(job.listing_count)}
                        </p>
                        <p className="mt-1 font-body text-[10px] text-[#525252]" style={BODY_FONT}>
                          {(job.listing_count_source ?? 'cleaned') === 'raw' ? 'raw stored' : 'clean stored'}
                          {job.last_new_count ? ` · +${formatCount(job.last_new_count)} new` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="border-t border-white/[0.08] bg-black/25 p-6 lg:border-l lg:border-t-0 lg:p-7">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-[#525252]" style={BODY_FONT}>Pipeline jobs</p>
              <h3 className="mt-3 font-display text-[2rem] leading-none text-white" style={DISPLAY_FONT}>Downstream</h3>
              <p className="mt-3 font-body text-[12px] leading-relaxed text-[#737373]" style={BODY_FONT}>
                Compact job health for the cleaning and analytics stages that run after source ingestion.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {downstreamJobs.map((job) => (
                <div key={job.name} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-body text-[13px] font-semibold text-white" style={BODY_FONT}>{jobLabel(job)}</p>
                      <p className="mt-1 font-body text-[10px] uppercase tracking-[0.16em] text-[#525252]" style={BODY_FONT}>
                        {formatSchedule(job.expected_hours)}
                      </p>
                    </div>
                    <StatusPill status={job.status} />
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-[0.16em] text-[#404040]" style={BODY_FONT}>Last success</p>
                      <p className="mt-1 font-body text-[12px] text-white num" style={BODY_FONT}>{formatRelativeTime(job.last_success)}</p>
                    </div>
                    <p className="max-w-[140px] text-right font-body text-[10px] leading-relaxed text-[#525252]" style={BODY_FONT}>
                      {formatAbsoluteTime(job.last_success)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-4">
              <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[#525252]" style={BODY_FONT}>Signal note</p>
              <p className="mt-3 font-body text-[12px] leading-relaxed text-[#a3a3a3]" style={BODY_FONT}>
                Source rows report stored listing totals plus the most recent probe. Health turns delayed when the last
                successful run falls outside the expected freshness window.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
