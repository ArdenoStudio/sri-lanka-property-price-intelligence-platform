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
import { formatCurrencyAmount } from '../lib/pricing';
import { chartTheme } from '../lib/chartTheme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRawPrice(s: string | null | undefined): number | null {
  if (!s) return null;
  // Normalise: strip currency symbols, commas, whitespace
  let cleaned = s.replace(/[Rrs\s,]/gi, '').toUpperCase();

  let multiplier = 1;
  if (cleaned.endsWith('BN')) { multiplier = 1_000_000_000; cleaned = cleaned.slice(0, -2); }
  else if (cleaned.endsWith('MN')) { multiplier = 1_000_000; cleaned = cleaned.slice(0, -2); }
  else if (cleaned.endsWith('M')) { multiplier = 1_000_000; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('B')) { multiplier = 1_000_000_000; cleaned = cleaned.slice(0, -1); }
  else if (cleaned.endsWith('K')) { multiplier = 1_000; cleaned = cleaned.slice(0, -1); }
  // Handle "LKR" prefix after stripping R already
  cleaned = cleaned.replace(/^LK/, '').replace(/^[A-Z]+/, '');

  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val * multiplier);
}

function formatY(val: number): string {
  return formatCurrencyAmount(val, 'LKR', { variant: 'axis', showCurrency: false });
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
    <div
      className="rounded-xl px-3 py-2 shadow-xl"
      style={{
        backgroundColor: chartTheme.tooltipBg,
        border: `1px solid ${chartTheme.tooltipBorder}`,
      }}
    >
      <p className="text-[10px] mb-0.5" style={{ color: chartTheme.axis }}>{label}</p>
      <p className="text-[13px] font-bold text-white num">
        {val != null ? formatCurrencyAmount(val, 'LKR', { variant: 'table' }) : '—'}
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
          stroke={chartTheme.series}
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
      <div className="h-[200px] flex items-center justify-center text-[13px]" style={{ color: chartTheme.axis }}>
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
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.14} />
              <stop offset="70%" stopColor="#ffffff" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: chartTheme.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
            tickFormatter={formatY}
            tick={{ fontSize: 10, fill: chartTheme.axis }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartTheme.grid, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={chartTheme.series}
            strokeWidth={2}
            fill={`url(#ph-${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: chartTheme.series, stroke: '#000', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
