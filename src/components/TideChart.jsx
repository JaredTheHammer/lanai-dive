import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip
} from 'recharts';
import { format } from 'date-fns';

export default function TideChart({ predictions, extremes }) {
  const data = useMemo(() => {
    if (!predictions?.length) return [];
    // Downsample to ~10-minute intervals for performance
    return predictions.filter((_, i) => i % 2 === 0).map(p => ({
      time: p.time.getTime(),
      height: p.height,
      label: format(p.time, 'ha').toLowerCase()
    }));
  }, [predictions]);

  const nowMs = Date.now();

  if (!data.length) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">Tide (48h)</h3>
        <div className="h-32 flex items-center justify-center text-white/30 text-sm">
          Loading tide data...
        </div>
      </div>
    );
  }

  const minH = Math.min(...data.map(d => d.height));
  const maxH = Math.max(...data.map(d => d.height));

  return (
    <div className="glass-card p-4 fade-in">
      <h3 className="text-sm font-medium text-white/60 mb-3">Tide (48h) - Kahului</h3>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ba5d8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#2ba5d8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => format(new Date(t), 'ha').toLowerCase()}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[Math.floor(minH * 10) / 10, Math.ceil(maxH * 10) / 10]}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(1)}'`}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(12,25,41,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff'
            }}
            labelFormatter={(t) => format(new Date(t), 'EEE h:mm a')}
            formatter={(val) => [`${val.toFixed(2)} ft`, 'Height']}
          />
          <Area
            type="monotone"
            dataKey="height"
            stroke="#2ba5d8"
            strokeWidth={2}
            fill="url(#tideGrad)"
          />
          {/* Now line */}
          <ReferenceLine
            x={nowMs}
            stroke="rgba(255,255,255,0.4)"
            strokeDasharray="4 4"
            label={{
              value: 'Now',
              position: 'top',
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Hi/Lo labels */}
      {extremes?.length > 0 && (
        <div className="flex gap-3 mt-2 overflow-x-auto pb-1">
          {extremes.slice(0, 6).map((e, i) => (
            <div key={i} className="flex-shrink-0 text-xs text-white/50">
              <span className={e.type === 'H' ? 'text-cyan-400' : 'text-blue-400'}>
                {e.type === 'H' ? '\u25B2' : '\u25BC'}
              </span>
              {' '}
              {format(e.time, 'EEE h:mma').toLowerCase()}
              {' '}
              <span className="text-white/70">{e.height.toFixed(1)}'</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
