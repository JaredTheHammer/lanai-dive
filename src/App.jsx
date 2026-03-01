import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Header from './components/Header.jsx';
import LoadingFallback from './components/LoadingFallback.jsx';
import NotificationSettings from './components/NotificationSettings.jsx';

const DashboardView = React.lazy(() => import('./components/DashboardView.jsx'));
const MapView = React.lazy(() => import('./components/MapView.jsx'));
const ComparisonView = React.lazy(() => import('./components/ComparisonView.jsx'));
import { fetchAllConditions } from './api/index.js';
import { REFRESH_INTERVAL_MS } from './api/config.js';
import useOfflineStatus, { cacheConditions, restoreCachedConditions } from './hooks/useOfflineStatus.js';
import useNotifications from './hooks/useNotifications.js';
import useTrendHistory from './hooks/useTrendHistory.js';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  const { isOffline, isStale, staleSummary } = useOfflineStatus(data?.fetchedAt);
  const notif = useNotifications();
  const trends = useTrendHistory();

  // Keep a ref to the previous data for threshold comparison
  const prevDataRef = useRef(null);

  // Restore cached data on mount (before first fetch completes)
  useEffect(() => {
    const cached = restoreCachedConditions();
    if (cached) {
      setData(cached);
      prevDataRef.current = cached;
    }
  }, []);

  const refresh = useCallback(async () => {
    // Skip fetch attempt if offline (keep showing cached data)
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllConditions();

      // Check for notification triggers before updating state
      if (prevDataRef.current) {
        notif.checkAndNotify(prevDataRef.current, result);
      }

      prevDataRef.current = result;
      setData(result);
      // Persist to localStorage for offline use
      cacheConditions(result);
      // Record snapshot for trend history
      trends.recordSnapshot(result);
    } catch (err) {
      console.error('Failed to fetch conditions:', err);
      setError(err.message);
      // If we have no data at all, try restoring cache
      if (!data) {
        const cached = restoreCachedConditions();
        if (cached) {
          setData(cached);
          prevDataRef.current = cached;
        }
      }
    } finally {
      setLoading(false);
    }
  }, [data, notif]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Retry when coming back online
  useEffect(() => {
    if (!isOffline) {
      refresh();
    }
  }, [isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-ocean-950 text-white safe-bottom">
      <Header
        fetchedAt={data?.fetchedAt}
        errors={data?.errors}
        onRefresh={refresh}
        loading={loading}
        currentView={currentView}
        onViewChange={setCurrentView}
        isOffline={isOffline}
        isStale={isStale}
        staleSummary={staleSummary}
        notifUnreadCount={notif.unreadCount}
        onNotifClick={() => setShowNotifSettings(true)}
      />

      {currentView === 'dashboard' && (
        <Suspense fallback={<LoadingFallback />}>
          <div className="pb-8">
            <DashboardView
              data={data}
              loading={loading}
              error={error}
              onRefresh={refresh}
              trendGetRange={trends.getRange}
            />
          </div>
        </Suspense>
      )}

      {currentView === 'compare' && (
        <Suspense fallback={<LoadingFallback />}>
          <div className="pb-8">
            <ComparisonView
              data={data}
              zoneForecastScores={data?.zoneForecastScores}
              onSelectZone={(zoneId) => {
                // Switch to map view centered on the selected zone
                setCurrentView('map');
              }}
            />
          </div>
        </Suspense>
      )}

      {currentView === 'map' && (
        <Suspense fallback={<LoadingFallback />}>
          {data ? (
            <MapView data={data} />
          ) : loading ? (
            <LoadingFallback />
          ) : null}
        </Suspense>
      )}

      {/* Offline with no cached data fallback */}
      {!data && !loading && isOffline && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] px-6 text-center">
          <div className="text-4xl mb-4">📡</div>
          <h2 className="text-lg font-bold mb-2">No Connection</h2>
          <p className="text-sm text-white/50 max-w-xs">
            You're offline and no cached data is available. Connect to the internet and tap refresh to load conditions.
          </p>
          <button
            onClick={refresh}
            className="mt-6 px-6 py-3 min-h-[44px] rounded-xl bg-cyan-500/20 text-cyan-400 text-sm font-medium touch-active"
          >
            Retry
          </button>
        </div>
      )}

      {/* Notification settings overlay */}
      <NotificationSettings
        isOpen={showNotifSettings}
        onClose={() => setShowNotifSettings(false)}
        prefs={notif.prefs}
        updatePrefs={notif.updatePrefs}
        permission={notif.permission}
        requestPermission={notif.requestPermission}
        history={notif.history}
        clearHistory={notif.clearHistory}
        markRead={notif.markRead}
        supported={notif.supported}
      />
    </div>
  );
}
