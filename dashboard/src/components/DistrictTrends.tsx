import { useState, useEffect, useRef } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getPrices, type PriceHistory } from '../api';
import { formatCurrencyAmount } from '../lib/pricing';
import { EmptyStatePanel } from './ui/EmptyStatePanel';

interface Props {
  district: string;
  propertyType: string;
  onViewListings: () => void;
}

export function DistrictTrends({ district, propertyType, onViewListings }: Props) {
  const [data, setData] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!district) return;

    async function load() {
      const reqId = ++requestRef.current;
      setLoading(true);

      try {
        const history = await getPrices(district, propertyType || 'land');
        if (requestRef.current !== reqId) return;
        setData([...history].reverse());
      } catch (err) {
        console.error('Failed to load prices', err);
        if (requestRef.current !== reqId) return;
        setData([]);
      }

      if (requestRef.current === reqId) {
        setLoading(false);
      }
    }

    load();
  }, [district, propertyType]);

  if (!district) {
    return (
      <div className="card p-12 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#2e2e2e] mb-4">Price Trends</p>
        <p className="text-[#525252] text-[15px]">Select a district to view price history</p>
        <p className="text-[11px] text-[#2e2e2e] mt-2">Click a district on the map or use the filter above</p>
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    formatCurrencyAmount(val, 'LKR', { variant: 'axis', showCurrency: false });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function linearRegression(values: number[]) {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

    const sumX = (n * (n - 1)) / 2;
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY = values.reduce((a, v) => a + v, 0);
    const sumXY = values.reduce((a, v, i) => a + i * v, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  const historicalPoints = data.map(d => ({
    ...d,
    name: `${monthNames[d.month - 1]} ${d.year}`,
    price: d.median_price_lkr ? Number(d.median_price_lkr) : 0,
  }));

  const cleanPrices = historicalPoints.map(d => d.price).filter(v => v > 0);
  const regressionWindow = cleanPrices.slice(-6);
  const reg = regressionWindow.length >= 3 ? linearRegression(regressionWindow) : null;

  const lastHistorical = historicalPoints[historicalPoints.length - 1];
  const lastPrice = lastHistorical?.price ?? 0;
  const maxSlope = lastPrice * 0.05;
  const clampedSlope = reg ? Math.max(-maxSlope, Math.min(maxSlope, reg.slope)) : 0;

  const predPoints = reg && lastHistorical
    ? Array.from({ length: 3 }, (_, index) => {
        const offset = index + 1;
        let month = lastHistorical.month + offset;
        let year = lastHistorical.year;

        if (month > 12) {
          month -= 12;
          year++;
        }

        return {
          name: `${monthNames[month - 1]} ${year}`,
          month,
          year,
          price: undefined as number | undefined,
          pred: Math.max(0, lastPrice + clampedSlope * offset),
        };
      })
    : [];

  const chartData = [
    ...historicalPoints.map((d, index) => ({
      ...d,
      pred: index === historicalPoints.length - 1 && reg ? d.price : undefined as number | undefined,
    })),
    ...predPoints,
  ];

  const chartKey = `${district}-${propertyType}-${chartData.length}`;
  const firstHistPrice = historicalPoints[0]?.price ?? 0;
  const pctChange = firstHistPrice && lastPrice
    ? ((lastPrice - firstHistPrice) / firstHistPrice) * 100
    : null;

  return (
    <div className="card p-6 mb-8 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#525252] mb-2">Price History</p>
          <h3 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-white tracking-tight">
            {district}
          </h3>
        </div>

        <div className="flex items-center gap-4 bg-[#161616] border border-white/[0.08] rounded-2xl px-4 py-3">
          <div>
            <span className="text-[10px] text-[#525252] uppercase block tracking-[0.1em]">Median</span>
            <span className="text-white font-bold text-lg num">
              {lastPrice > 0 ? formatCurrency(lastPrice) : 'N/A'}
            </span>
          </div>
          {pctChange !== null && (
            <>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div className={`flex items-center gap-1 text-xs font-bold num ${
                pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                <TrendingUp className={`w-3 h-3 ${pctChange < 0 ? 'rotate-180' : ''}`} />
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-[300px] w-full relative overflow-hidden rounded-2xl">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-bg-card-hover/20 rounded-2xl border border-dashed border-border">
            <p className="text-xs text-text-muted">Loading trends...</p>
          </div>
        ) : data.length === 0 ? (
          <EmptyStatePanel
            eyebrow="Price Trends"
            title={`No ${district} trendline yet`}
            body={`We do not have enough monthly observations in ${district} to publish a stable district trendline yet. Review live listings while coverage builds.`}
            ctaLabel={`View ${district} listings`}
            onCta={onViewListings}
            className="h-full"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={280} minWidth={300}>
            <ComposedChart key={chartKey} data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.18} />
                  <stop offset="70%" stopColor="#14b8a6" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="0" vertical={false} stroke="#ffffff" strokeOpacity={0.03} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#2e2e2e', fontSize: 10, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#2e2e2e', fontSize: 10, fontWeight: 500 }}
                tickFormatter={formatCurrency}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: '#161616',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#f5f5f5',
                  fontSize: '13px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  padding: '12px 16px',
                  fontFamily: 'Inter Variable, Inter, sans-serif',
                }}
                itemStyle={{ fontWeight: 600 }}
                labelStyle={{
                  color: '#525252',
                  marginBottom: '4px',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
                formatter={(val: unknown, name: unknown) => {
                  if (name === 'price') return [formatCurrency(Number(val)), 'Median Price'];
                  if (name === 'pred') return [formatCurrency(Number(val)), 'Forecast'];
                  return null;
                }}
              />

              {reg && (
                <Area
                  type="monotone"
                  dataKey="pred"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="none"
                  activeDot={{ r: 4, fill: '#161616', stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}

              <Area
                type="monotone"
                dataKey="price"
                stroke="#14b8a6"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorPrice)"
                isAnimationActive={false}
                activeDot={{ r: 5, fill: '#161616', stroke: '#5eead4', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-4 text-[11px] text-[#2e2e2e]">
        Median advertised prices. Actual sale prices vary.
        {reg && ' · Dashed line: 3-month forecast (indicative).'}
      </p>
    </div>
  );
}
