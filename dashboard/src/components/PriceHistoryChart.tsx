import { useId } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PriceSnapshot } from '../api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRawPrice(s: string | null | undefined): number | null {
  if (!s) return null;
  // Normalise: strip currency symbols, commas, whitespace
  let cleaned = s.replace(/[Rrs\s,]/gi, '').toUpperCase();

  let multiplier = 1;
  if (cleaned.endsWith('M')) { multiplier = 1_000_000; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('K')) { multiplier = 1_000; cleaned = cleaned.slice(0, -1); }
  // Handle "LKR" prefix after stripping R already
  cleaned = cleaned.replace(/^LK/, '').replace(/^[A-Z]+/, '');

  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val * multiplier);
}

function formatY(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toString();
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-LK', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartDataPoint {
  date: string;
  price: number | null;
}

// ---------------------------------------------------------------------------
// Full-size area chart (used in ListingDetail)
// ---------------------------------------------------------------------------

interface FullChartProps {
  size: 'full';
  snapshots: PriceSnapshot[];
}

// ---------------------------------------------------------------------------
// Sparkline (used in listing cards)
// ---------------------------------------------------------------------------

interface SparklineProps {
  size: 'sparkline';
  data: { date: string; price: number | null }[];
}

type Props = FullChartProps | SparklineProps;

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#161616] border border-white/[0.1] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[10px] text-[#525252] mb-0.5">{label}</p>
      <p className="text-[13px] font-bold text-white num">
        {val != null ? `Rs ${(val / 1_000_000).toFixed(2)}M` : '—'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceHistoryChart(props: Props) {
  const gradientId = useId().replace(/:/g, '');

  if (props.size === 'sparkline') {
    const { data } = props;
    const validPoints = data.filter(d => d.price != null && d.price > 0);
    if (validPoints.length < 2) return null;

    return (
      <LineChart width={80} height={32} data={data}>
        <Line
          type="monotone"
          dataKey="price"
          stroke="#14b8a6"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    );
  }

  // Full-size chart
  const { snapshots } = props;
  const chartData: ChartDataPoint[] = snapshots
    .map(s => ({ date: formatDate(s.date), price: parseRawPrice(s.raw_price) }))
    .filter(d => d.price != null && d.price > 0);

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[#525252] text-[13px]">
        No price history available
      </div>
    );
  }

  const prices = chartData.map(d => d.price as number);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.15 || minPrice * 0.1;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`ph-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.18} />
              <stop offset="70%" stopColor="#14b8a6" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
            tickFormatter={formatY}
            tick={{ fontSize: 10, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#14b8a6"
            strokeWidth={2}
            fill={`url(#ph-${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: '#14b8a6', stroke: '#000', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
