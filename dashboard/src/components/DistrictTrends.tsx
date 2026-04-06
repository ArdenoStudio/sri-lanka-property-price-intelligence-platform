import { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  ReferenceArea,
} from 'recharts';
import { TrendingUp, Activity, Info } from 'lucide-react';
import { getPrices, type PriceHistory } from '../api';
import { motion } from 'framer-motion';

interface Props {
  district: string;
  propertyType: string;
}

export function DistrictTrends({ district, propertyType }: Props) {
  const [data, setData] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!district) return;
    async function load() {
      setLoading(true);
      try {
        const history = await getPrices(district, propertyType || 'land');
        setData([...history].reverse());
      } catch (err) {
        console.error('Failed to load prices', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [district, propertyType]);

  if (!district) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
        <Activity className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-20" />
        <h3 className="text-lg font-bold text-text-primary mb-1">Market Insights</h3>
        <p className="text-text-muted text-sm max-w-xs mx-auto">
          Select a district from the map or dropdown to view price trends and movement.
        </p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Simple linear regression
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

  // Use only the last 6 clean (non-zero) months for regression to avoid spike distortion
  const cleanPrices = historicalPoints.map(d => d.price).filter(v => v > 0);
  const regressionWindow = cleanPrices.slice(-6);
  const reg = regressionWindow.length >= 3 ? linearRegression(regressionWindow) : null;

  const lastHistorical = historicalPoints[historicalPoints.length - 1];
  const lastPrice = lastHistorical?.price ?? 0;

  // Cap slope at ±5% of last price per month to prevent wild extrapolations
  const maxSlope = lastPrice * 0.05;
  const clampedSlope = reg ? Math.max(-maxSlope, Math.min(maxSlope, reg.slope)) : 0;

  const PREDICT_MONTHS = 3;
  const predPoints = reg && lastHistorical ? (() => {
    const points = [];
    for (let i = 1; i <= PREDICT_MONTHS; i++) {
      let m = lastHistorical.month + i;
      let y = lastHistorical.year;
      if (m > 12) { m -= 12; y++; }
      // Project from last real price using clamped slope
      const predVal = Math.max(0, lastPrice + clampedSlope * i);
      points.push({
        name: `${monthNames[m - 1]} ${y}`,
        month: m,
        year: y,
        price: undefined as number | undefined,
        pred: predVal,
      });
    }
    return points;
  })() : [];

  // Connect last historical point to prediction line
  const chartData = [
    ...historicalPoints.map((d, i) => ({
      ...d,
      pred: i === historicalPoints.length - 1 && reg ? d.price : undefined as number | undefined,
    })),
    ...predPoints,
  ];

  const chartKey = `${district}-${propertyType}-${chartData.length}`;

  // Use historical points only for stat calculations
  const firstHistPrice = historicalPoints[0]?.price ?? 0;
  const pctChange = (firstHistPrice && lastPrice)
    ? ((lastPrice - firstHistPrice) / firstHistPrice) * 100
    : null;

  const predZoneStart = predPoints[0]?.name;
  const predZoneEnd = predPoints[predPoints.length - 1]?.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-bg-card border border-border rounded-2xl p-6 mb-8 overflow-hidden relative"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-accent-light" />
            <h3 className="text-xl font-bold text-text-primary">
              {district} Price Trends
            </h3>
          </div>
          <p className="text-text-muted text-xs flex items-center gap-1.5 uppercase tracking-wider font-medium">
            <Activity className="w-3 h-3" />
            Market Movement • Past 12 Months
          </p>
        </div>

        <div className="bg-bg-card-hover border border-border rounded-xl px-4 py-2 flex items-center gap-4">
          <div>
            <span className="text-[10px] text-text-muted uppercase block font-bold">Avg Median</span>
            <span className="text-accent-light font-bold text-lg">
              {lastPrice > 0 ? formatCurrency(lastPrice) : 'N/A'}
            </span>
          </div>
          {pctChange !== null && (
            <>
              <div className="w-px h-8 bg-border" />
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${
                pctChange >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}>
                <TrendingUp className={`w-3 h-3 ${pctChange < 0 ? 'rotate-180' : ''}`} />
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-[300px] w-full relative overflow-hidden rounded-xl">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-bg-card-hover/20 rounded-xl border border-dashed border-border">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-text-muted">Loading trends...</p>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-text-muted italic text-sm">
            Insufficient data for this district yet.
          </div>
        ) : (
          <>
            <motion.div
              key={chartKey}
              initial={{ x: '-60%', opacity: 0 }}
              animate={{ x: '60%', opacity: 0.35 }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent"
            />
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart key={chartKey} data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#818cf8" stopOpacity={0.5} />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>

                  <linearGradient id="predFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#e879f9" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>

                  <linearGradient id="predGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#e879f9" />
                  </linearGradient>

                  <pattern id="stripedPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="2" height="8" fill="#e879f9" fillOpacity="0.15" />
                  </pattern>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.06} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                  tickFormatter={formatCurrency}
                  width={40}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'rgba(20, 20, 23, 0.8)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '13px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ fontWeight: 700 }}
                  labelStyle={{ color: '#9ca3af', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  formatter={(val: any, name: any) => {
                    if (name === 'price') return [formatCurrency(Number(val)), 'Median Price'];
                    if (name === 'pred')  return [formatCurrency(Number(val)), 'Forecast'];
                    return null;
                  }}
                />

                {/* Forecast line and glowing gradient area — connects from last real point */}
                {reg && (
                  <Area
                    type="monotone"
                    dataKey="pred"
                    stroke="url(#predGradient)"
                    strokeWidth={3}
                    strokeDasharray="6 6"
                    fillOpacity={1}
                    fill="url(#predFill)"
                    activeDot={{ r: 5, fill: "#141417", stroke: "#e879f9", strokeWidth: 3 }}
                    animationBegin={1200}
                    animationDuration={800}
                    connectNulls
                  />
                )}

                {/* Historical area */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="url(#strokeGradient)"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  animationBegin={150}
                  animationDuration={1400}
                  animationEasing="ease-out"
                  activeDot={{ r: 6, fill: "#141417", stroke: "#818cf8", strokeWidth: 3 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-[10px] text-text-muted bg-bg-card-hover/50 p-3 rounded-xl border border-border/50">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-accent-light" />
          Based on median advertised prices. Actual sale prices may vary.
        </span>
        {reg && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-dashed border-[#a78bfa]" />
            Forecast (last 6 months trend) — indicative only
          </span>
        )}
      </div>
    </motion.div>
  );
}
