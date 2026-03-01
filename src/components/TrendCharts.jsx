/**
 * TrendCharts -- Historical trend visualization using Recharts.
 *
 * Shows:
 *  1. Overall score line chart with zone score area fill
 *  2. Wind speed + swell height dual-axis overlay
 *  3. Time range selector (6h, 24h, 48h, 7d)
 *
 * Data comes from useTrendHistory snapshots accumulated across refreshes.
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const RANGES = [
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '48h', label: '48h' },
  { key: '7d', label: '7d' },
];

const ZONE_COLORS = {
  south_shore: '#22d3ee',  // cyan-400
  southwest: '#a78bfa',    // violet-400
  west: '#f472b6',         // pink-400
  northwest: '#fb923c',    // orange-400
  north: '#4ade80',        // green-400
  east: '#facc15',         // yellow-400
};

const ZONE_LABELS = {
  south_shore: 'South',
  southwest: 'SW',
  west: 'West',
  northwest: 'NW',
  north: 'North',
  east: 'East',
};

function scoreColor(s) {
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#eab308';
  if (s >= 40) return '#f97316';
  return '#ef4444';
}

export default function TrendCharts({ getRange }) {
  const [range, setRange] = useState('24h');
  const [activeChart, setActiveChart] = useState('score'); // 'score' | 'conditions'

  const data = useMemo(() => {
    const raw = getRange(range);
    if (!raw.length) return [];

    return raw.map(snap => ({
      time: snap.t,
      score: snap.s,
      bestScore: snap.bs,
      wind: Math.round(snap.w * 10) / 10,
      swell: Math.round(snap.sh * 10) / 10,
      tide: Math.round(snap.tl * 100) / 100,
      ...Object.fromEntries(
        Object.entries(snap.zs || {}).map(([zid, zs]) => [`z_${zid}`, zs])
      ),
    }));
  }, [getRange, range]);

  // Detect which zones are present
  const zoneIds = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0])
      .filter(k => k.startsWith('z_'))
      .map(k => k.slice(2));
  }, [data]);

  if (!data.length) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Trend History</h3>
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <p className="text-sm text-white/30">No historical data yet</p>
            <p className="text-xs text-white/20 mt-1">Trends will appear after a few refresh cycles</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      {/* Header with chart toggle and range selector */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Trends</h3>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setActiveChart('score')}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                activeChart === 'score' ? 'bg-white/10 text-cyan-400' : 'text-white/30'
              }`}
            >
              Score
            </button>
            <button
              onClick={() => setActiveChart('conditions')}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                activeChart === 'conditions' ? 'bg-white/10 text-cyan-400' : 'text-white/30'
              }`}
            >
              Conditions
            </button>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                range === r.key ? 'bg-white/10 text-cyan-400' : 'text-white/30'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {activeChart === 'score' && (
        <ScoreChart data={data} zoneIds={zoneIds} range={range} />
      )}
      {activeChart === 'conditions' && (
        <ConditionsChart data={data} range={range} />
      )}

      {/* Zone legend */}
      {activeChart === 'score' && zoneIds.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {zoneIds.map(zid => (
            <div key={zid} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ZONE_COLORS[zid] || '#666' }} />
              <span className="text-[10px] text-white/30">{ZONE_LABELS[zid] || zid}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreChart({ data, zoneIds, range }) {
  const tickInterval = range === '6h' ? 'preserveStartEnd' : range === '7d' ? Math.floor(data.length / 6) : 'preserveStartEnd';

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTimeAxis(range)}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            interval={tickInterval}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
          />
          <Tooltip content={<ScoreTooltip />} />

          {/* Quality reference bands */}
          <ReferenceLine y={80} stroke="rgba(34,197,94,0.15)" strokeDasharray="3 3" />
          <ReferenceLine y={60} stroke="rgba(234,179,8,0.15)" strokeDasharray="3 3" />
          <ReferenceLine y={40} stroke="rgba(239,68,68,0.15)" strokeDasharray="3 3" />

          {/* Zone score lines (thin, behind main) */}
          {zoneIds.map(zid => (
            <Line
              key={zid}
              dataKey={`z_${zid}`}
              stroke={ZONE_COLORS[zid] || '#666'}
              strokeWidth={1}
              dot={false}
              opacity={0.35}
              isAnimationActive={false}
            />
          ))}

          {/* Overall score (bold foreground line) */}
          <Line
            dataKey="score"
            stroke="#22d3ee"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConditionsChart({ data, range }) {
  const tickInterval = range === '6h' ? 'preserveStartEnd' : range === '7d' ? Math.floor(data.length / 6) : 'preserveStartEnd';

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTimeAxis(range)}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            interval={tickInterval}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ConditionsTooltip />} />

          {/* Wind speed area */}
          <Area
            yAxisId="left"
            dataKey="wind"
            fill="rgba(96,165,250,0.1)"
            stroke="#60a5fa"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />

          {/* Swell height line */}
          <Line
            yAxisId="right"
            dataKey="swell"
            stroke="#f472b6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {/* Tide as subtle bar */}
          <Bar
            yAxisId="right"
            dataKey="tide"
            fill="rgba(34,211,238,0.12)"
            isAnimationActive={false}
            maxBarSize={4}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-blue-400" />
          <span className="text-[10px] text-white/30">Wind (mph)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-pink-400" />
          <span className="text-[10px] text-white/30">Swell (ft)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded bg-cyan-400/20" />
          <span className="text-[10px] text-white/30">Tide</span>
        </div>
      </div>
    </div>
  );
}

function ScoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-ocean-950/95 border border-white/10 rounded-lg px-3 py-2 text-xs backdrop-blur-md shadow-lg">
      <p className="text-white/40 mb-1">{formatTooltipTime(d.time)}</p>
      <p className="font-bold" style={{ color: scoreColor(d.score) }}>
        Score: {d.score}
      </p>
      {d.bestScore !== undefined && (
        <p className="text-white/40">Best zone: {d.bestScore}</p>
      )}
    </div>
  );
}

function ConditionsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-ocean-950/95 border border-white/10 rounded-lg px-3 py-2 text-xs backdrop-blur-md shadow-lg">
      <p className="text-white/40 mb-1">{formatTooltipTime(d.time)}</p>
      <p className="text-blue-400">Wind: {d.wind} mph</p>
      <p className="text-pink-400">Swell: {d.swell} ft</p>
      <p className="text-cyan-400/60">Tide: {d.tide} ft</p>
    </div>
  );
}

// --- Formatters ---

function formatTimeAxis(range) {
  return (ts) => {
    const d = new Date(ts);
    if (range === '7d') {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    const h = d.getHours();
    const ampm = h >= 12 ? 'p' : 'a';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  };
}

function formatTooltipTime(ts) {
  const d = new Date(ts);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${month} ${day}, ${h12}:${m} ${ampm}`;
}
