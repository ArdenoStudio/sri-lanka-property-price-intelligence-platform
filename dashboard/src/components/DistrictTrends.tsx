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
        // Reverse to show chronological order (backend returns desc)
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

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Linear regression over last N historical points → project 3 months forward
  function linearRegression(values: number[]): { slope: number; intercept: number; rmse: number } {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rmse: 0 };
    const sumX = (n * (n - 1)) / 2;
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY = values.reduce((a, v) => a + v, 0);
    const sumXY = values.reduce((a, v, i) => a + i * v, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const residuals = values.map((v, i) => (v - (intercept + slope * i)) ** 2);
    const rmse = Math.sqrt(residuals.reduce((a, v) => a + v, 0) / n);
    return { slope, intercept, rmse };
  }

  const historicalPoints = data.map(d => ({
    ...d,
    name: `${monthNames[d.month - 1]} ${d.year}`,
    price: d.median_price_lkr ? Number(d.median_price_lkr) : 0,
    perch: d.median_price_per_perch ? Number(d.median_price_per_perch) : 0,
  }));

  // Build prediction points for next 3 months
  const PREDICT_MONTHS = 3;
  const prices = historicalPoints.map(d => d.price).filter(v => v > 0);
  const reg = prices.length >= 3 ? linearRegression(prices) : null;

  const predPoints = reg ? (() => {
    const lastPt = historicalPoints[historicalPoints.length - 1];
    const points = [];
    for (let i = 1; i <= PREDICT_MONTHS; i++) {
      let m = lastPt.month + i;
      let y = lastPt.year;
      if (m > 12) { m -= 12; y++; }
      const predVal = reg.intercept + reg.slope * (prices.length - 1 + i);
      const ci = reg.rmse * 1.5;
      points.push({
        name: `${monthNames[m - 1]} ${y}`,
        month: m, year: y,
        price: undefined as number | undefined,
        pred: Math.max(0, predVal),
        predLow: Math.max(0, predVal - ci),
        predHigh: Math.max(0, predVal + ci),
        isPrediction: true,
      });
    }
    return points;
  })() : [];

  // Connect the last historical point to the prediction line
  const chartData = [
    ...historicalPoints.map((d, i) => ({
      ...d,
      pred: i === historicalPoints.length - 1 && reg ? d.price : undefined as number | undefined,
      predLow: undefined as number | undefined,
      predHigh: undefined as number | undefined,
      isPrediction: false,
    })),
    ...predPoints,
  ];

  const chartKey = `${district}-${propertyType}-${chartData.length}`;

  const pctChange = (() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].price;
    const last = chartData[chartData.length - 1].price;
    if (!first || last == null) return null;
    return ((last - first) / first) * 100;
  })();

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
              {data.length > 0 ? formatCurrency(chartData[chartData.length - 1].price ?? 0) : 'N/A'}
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          {pctChange !== null && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${
              pctChange >= 0
                ? 'bg-success/15 text-success'
                : 'bg-danger/15 text-danger'
            }`}>
              <TrendingUp className={`w-3 h-3 ${pctChange < 0 ? 'rotate-180' : ''}`} />
              {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
            </div>
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
              <ComposedChart key={chartKey} data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.04}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => {
                    if (name === 'price') return [formatCurrency(Number(val)), 'Median Price'];
                    if (name === 'pred') return [formatCurrency(Number(val)), 'Forecast'];
                    return [formatCurrency(Number(val)), String(name)];
                  }}
                  itemSorter={(a: any) => a.name === 'price' ? 0 : 1}
                />
                {/* Confidence band (prediction only) */}
                <Area
                  type="monotone"
                  dataKey="predHigh"
                  stroke="none"
                  fill="url(#colorCI)"
                  fillOpacity={1}
                  legendType="none"
                  isAnimationActive={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="predLow"
                  stroke="none"
                  fill="#0f172a"
                  fillOpacity={1}
                  legendType="none"
                  isAnimationActive={false}
                  connectNulls
                />
                {/* Historical price area */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#818cf8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  animationBegin={150}
                  animationDuration={1400}
                  animationEasing="ease-out"
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  connectNulls={false}
                />
                {/* Prediction line */}
                {reg && (
                  <Line
                    type="monotone"
                    dataKey="pred"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 3, stroke: '#a78bfa', strokeWidth: 2 }}
                    animationBegin={1200}
                    animationDuration={800}
                    connectNulls
                  />
                )}
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
            Forecast (linear regression ±1.5σ) — indicative only
          </span>
        )}
      </div>
    </motion.div>
  );
}
