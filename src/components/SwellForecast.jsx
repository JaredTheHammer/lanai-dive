/**
 * SwellForecast -- 72h swell height + period chart from PacIOOS WW3 model.
 * Recharts AreaChart with dual Y-axis (height and period).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { fetchSwellForecast } from '../api/swellforecast.js';

export default function SwellForecast() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchSwellForecast();
        if (!cancelled) {
          setForecast(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Swell forecast error:', err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(() => {
    if (!forecast?.length) return [];
    return forecast.map(d => ({
      time: d.time.getTime(),
      height: parseFloat(d.height.toFixed(1)),
      period: parseFloat(d.period.toFixed(1)),
      direction: Math.round(d.direction),
    }));
  }, [forecast]);

  if (loading) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">72h Swell Forecast</h3>
        <div className="h-32 flex items-center justify-center text-white/30 text-sm">
          Loading swell model...
        </div>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">72h Swell Forecast</h3>
        <div className="h-16 flex items-center justify-center text-white/30 text-xs">
          {error ? `Model unavailable: ${error}` : 'No forecast data'}
        </div>
      </div>
    );
  }

  // Find peak swell
  const peak = chartData.reduce((best, d) => d.height > best.height ? d : best, chartData[0]);

  return (
    <div className="glass-card p-4 fade-in">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-white/60">72h Swell Forecast</h3>
        <span className="text-[10px] text-white/30">PacIOOS WW3</span>
      </div>

      {peak && (
        <div className="mb-2 text-xs text-white/50">
          Peak: {peak.height} ft @ {peak.period}s
          {' '}({format(new Date(peak.time), 'EEE ha')})
        </div>
      )}

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="swellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => {
              const d = new Date(t);
              const h = d.getHours();
              if (h === 0 || h === 12) return format(d, 'EEE ha').toLowerCase();
              return '';
            }}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            unit=" ft"
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(12,25,41,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff',
            }}
            labelFormatter={(t) => format(new Date(t), 'EEE h:mm a')}
            formatter={(val, name) => {
              if (name === 'height') return [`${val} ft`, 'Height'];
              if (name === 'period') return [`${val}s`, 'Period'];
              return [val, name];
            }}
          />
          <ReferenceLine y={3} stroke="rgba(251,191,36,0.3)" strokeDasharray="3 3" />
          <ReferenceLine y={6} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="height"
            stroke="#06b6d4"
            strokeWidth={1.5}
            fill="url(#swellGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-white/30 mt-1">
        <span>-72h</span>
        <span>Now</span>
        <span className="text-[10px] text-white/20">3 ft / 6 ft reference lines</span>
      </div>
    </div>
  );
}
