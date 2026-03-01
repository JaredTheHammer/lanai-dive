/**
 * DashboardView -- The original single-score dashboard,
 * extracted from App.jsx to support view switching.
 */

import React, { useState } from 'react';
import ScoreGauge from './ScoreGauge.jsx';
import ConditionCard from './ConditionCard.jsx';
import TideChart from './TideChart.jsx';
import ForecastTimeline from './ForecastTimeline.jsx';
import WaterTemp from './WaterTemp.jsx';
import SeasonBanner from './SeasonBanner.jsx';
import SpeciesGuide from './SpeciesGuide.jsx';
import TrendCharts from './TrendCharts.jsx';
import SwellForecast from './SwellForecast.jsx';
import { WEIGHTS } from '../scoring/index.js';

const FACTOR_ORDER = ['wind', 'swell', 'tide', 'rain', 'visibility'];

export default function DashboardView({ data, loading, error, onRefresh, trendGetRange }) {
  const [showSpeciesGuide, setShowSpeciesGuide] = useState(false);

  return (
    <main className="px-4 space-y-4 max-w-lg mx-auto">
      {/* Error state */}
      {error && !data && (
        <div className="glass-card p-6 text-center">
          <p className="text-amber-400 text-sm mb-2">Unable to load conditions</p>
          <p className="text-white/40 text-xs mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Score gauge */}
      {data?.score && (
        <>
          <div className="relative flex justify-center pt-2 pb-4">
            <ScoreGauge
              score={data.score.overall}
              label={data.score.overallLabel}
              color={data.score.overallColor}
            />
          </div>

          {/* Quick verdict */}
          <div className="text-center -mt-2 mb-2">
            <p className="text-sm text-white/50">
              {getVerdict(data.score.overall)}
            </p>
          </div>

          {/* Season status banner */}
          <SeasonBanner seasonInfo={data.seasonInfo} />

          {/* Species guide button */}
          <button
            onClick={() => setShowSpeciesGuide(true)}
            className="glass-card w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
          >
            <span className="text-base">{'\u{1F4D6}'}</span>
            <div className="flex-1">
              <span className="text-xs font-medium text-white/70">Species Guide</span>
              <span className="text-[10px] text-white/30 ml-2">
                {data.seasonInfo?.all?.openCount || 0} species in season
              </span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/30">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Water temp */}
          <WaterTemp tempF={data.waterTemp} buoyTime={data.buoyTime} />

          {/* Factor cards */}
          <div className="space-y-3">
            {FACTOR_ORDER.map(name => (
              <ConditionCard
                key={name}
                name={name}
                factor={data.score.factors[name]}
                weight={WEIGHTS[name]}
              />
            ))}
          </div>

          {/* Tide chart */}
          <TideChart
            predictions={data.tidePredictions}
            extremes={data.tideExtremes}
          />

          {/* Forecast timeline */}
          <ForecastTimeline forecastScores={data.forecastScores} zoneForecastScores={data.zoneForecastScores} />

          {/* Swell forecast from WW3 model */}
          <SwellForecast />

          {/* Historical trend charts */}
          {trendGetRange && (
            <TrendCharts getRange={trendGetRange} />
          )}

          {/* Data sources */}
          <div className="text-center text-xs text-white/20 pt-4 pb-2 space-y-1">
            <p>
              Tide: NOAA CO-OPS Kahului &middot; Weather: NWS Honolulu
            </p>
            <p>
              Swell: NDBC 51213 (Lanai SW) &middot; Scoring: v1.0
            </p>
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4 pt-8">
          <div className="flex justify-center">
            <div className="w-48 h-48 rounded-full bg-white/5 animate-pulse" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Species Guide overlay */}
      <SpeciesGuide
        isOpen={showSpeciesGuide}
        onClose={() => setShowSpeciesGuide(false)}
      />
    </main>
  );
}

function getVerdict(score) {
  if (score >= 85) return "Conditions are outstanding. Grab your gear and get in the water.";
  if (score >= 70) return "Good conditions for skin diving. Vis should be solid.";
  if (score >= 55) return "Diveable conditions. Check the swell direction for your spot.";
  if (score >= 40) return "Marginal. Experienced divers only. Watch the surge.";
  if (score >= 25) return "Poor conditions. Consider waiting for the next window.";
  return "Stay on land. Dangerous conditions for diving.";
}
