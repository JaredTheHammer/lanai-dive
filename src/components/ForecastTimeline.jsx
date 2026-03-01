import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { format, isToday, isTomorrow } from 'date-fns';
import { LANAI_ZONES } from '../data/zones.js';

const ZONE_IDS = Object.keys(LANAI_ZONES);

export default function ForecastTimeline({ forecastScores, zoneForecastScores }) {
  const [mode, setMode] = useState('island'); // 'island' or zone id
  const hasZoneData = zoneForecastScores && Object.keys(zoneForecastScores).length > 0;

  const data = useMemo(() => {
    let scores;
    if (mode === 'island') {
      scores = forecastScores;
    } else if (hasZoneData && zoneForecastScores[mode]) {
      scores = zoneForecastScores[mode];
    } else {
      scores = forecastScores;
    }

    if (!scores?.length) return [];
    return scores.map(f => ({
      time: f.time.getTime(),
      score: f.score,
      color: f.color,
      wind: f.wind,
      forecast: f.forecast,
      isDaytime: f.isDaytime,
      dayLabel: getDayLabel(f.time),
      hourLabel: format(f.time, 'ha').toLowerCase()
    }));
  }, [forecastScores, zoneForecastScores, mode, hasZoneData]);

  if (!data.length) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-white/60 mb-3">48h Dive Score Forecast</h3>
        <div className="h-32 flex items-center justify-center text-white/30 text-sm">
          Loading forecast...
        </div>
      </div>
    );
  }

  // Find best upcoming dive window
  const sourceScores = mode === 'island' ? forecastScores :
    (hasZoneData && zoneForecastScores[mode]) || forecastScores;
  const bestWindow = findBestWindow(sourceScores);

  return (
    <div className="glass-card p-4 fade-in">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-white/60">48h Dive Score Forecast</h3>
        {hasZoneData && (
          <button
            onClick={() => setMode(mode === 'island' ? ZONE_IDS[0] : 'island')}
            className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors px-2 py-1 rounded"
          >
            {mode === 'island' ? 'Zone Detail' : 'Island'}
          </button>
        )}
      </div>

      {/* Zone selector tabs */}
      {mode !== 'island' && hasZoneData && (
        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {ZONE_IDS.map(zid => (
            <button
              key={zid}
              onClick={() => setMode(zid)}
              className={`px-2 py-1 min-h-[32px] rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                mode === zid
                  ? 'bg-white/10 text-cyan-400'
                  : 'text-white/40 hover:bg-white/5'
              }`}
            >
              {LANAI_ZONES[zid].name}
            </button>
          ))}
        </div>
      )}

      {bestWindow && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-xs text-emerald-400">Best window: </span>
          <span className="text-xs text-white/80">
            {format(bestWindow.start, 'EEE ha')} - {format(bestWindow.end, 'ha')}
            {' '}(avg score: {bestWindow.avgScore})
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            ticks={[25, 50, 75]}
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
            formatter={(val, name, props) => {
              const d = props.payload;
              return [
                `Score: ${val} | Wind: ${Math.round(d.wind)} mph | ${d.forecast}`,
                ''
              ];
            }}
          />
          <Bar dataKey="score" radius={[2, 2, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} fillOpacity={entry.isDaytime ? 0.8 : 0.35} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-white/30 mt-1">
        <span>Now</span>
        <span>+24h</span>
        <span>+48h</span>
      </div>
    </div>
  );
}

function getDayLabel(date) {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE');
}

function findBestWindow(scores) {
  if (!scores || scores.length < 3) return null;

  // Only consider daytime hours
  const daytime = scores.filter(s => {
    const h = s.time.getHours();
    return h >= 6 && h <= 18;
  });

  if (daytime.length < 2) return null;

  let bestAvg = 0;
  let bestStart = 0;
  let bestEnd = 0;

  // Sliding window of 3-5 hours
  for (let windowSize = 3; windowSize <= 5; windowSize++) {
    for (let i = 0; i <= daytime.length - windowSize; i++) {
      const window = daytime.slice(i, i + windowSize);
      const avg = window.reduce((sum, s) => sum + s.score, 0) / windowSize;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestStart = i;
        bestEnd = i + windowSize - 1;
      }
    }
  }

  if (bestAvg < 40) return null;

  return {
    start: daytime[bestStart].time,
    end: daytime[bestEnd].time,
    avgScore: Math.round(bestAvg)
  };
}
