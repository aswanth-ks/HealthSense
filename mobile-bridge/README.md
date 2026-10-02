# HealthSense Mobile Bridge

A browser or installed PWA **cannot** read Android Health Connect or Apple HealthKit. Only a native app
can, after the user grants permission on the phone. HealthSense therefore keeps three layers separate:

```text
Android Health Connect / Apple Health (HealthKit)
        ↓  native permission sheet, native read APIs
HealthSense Mobile Bridge   (this folder: thin native shell hosting the web app in a WebView)
        ↓  window.HealthSenseBridge  (JS interface)  →  client/src/services/healthBridge.js
HealthSense API             POST /api/health/connect · POST /api/health/sync   (server/routes/healthRoutes.js)
        ↓
MongoDB HealthRecord        (one record per user + metric + date + source, provenance IMPORTED)
        ↓
24-h cycles → personal baseline → 3-Day Assessment → next-24h monitoring
```

The web app works unchanged without the bridge. Without it, Settings → Health Data shows the connect button
disabled and explains that the mobile app is needed. It never simulates a permission grant.

## JS contract (`window.HealthSenseBridge`)

Every method returns a Promise with JSON-serialisable data.

| Method | Returns |
| --- | --- |
| `platform()` | `'android'` or `'ios'` |
| `isAvailable()` | `{ available, reason? }`, where `reason` is `'not_installed'` (Health Connect missing) or `'unsupported'` |
| `requestPermissions(metrics)` | `{ granted: string[], denied: string[] }`, showing the OS permission sheet. Only `['steps']` is requested today. |
| `readDaily('steps', from, to)` | `[{ date: 'YYYY-MM-DD', value, source_record_id? }]`: **daily totals** in the phone's local time zone. Days with no data are omitted, never sent as 0. |
| `openSettings()` | Opens the OS health-permission screen |

The web layer (`client/src/services/healthApi.js`) does the rest:

1. `connectHealth()` calls `requestPermissions`, then `POST /api/health/connect { source, granted_metrics }`.
   - If `granted_metrics` is empty, the server stores the connection as `permission_denied`.
2. `syncNow()` calls `readDaily` for the last 30 days, then `POST /api/health/sync { source, records, today }`.
   - The server upserts on `userId + metric + date + source`, so repeated syncs never create duplicates.
   - It also records `syncedAt` and recomputes the affected days.
   - A failure on the phone is reported with `{ failed: true, error }`, so "Last sync" stays honest.

Run a sync when the app opens, on pull-to-refresh, and from **Sync Now**. Health Connect and HealthKit
already aggregate step data from all of the phone's sources, so HealthSense never counts steps itself.

## Reference implementations

- [`android/HealthConnectBridge.kt`](android/HealthConnectBridge.kt): Health Connect (`androidx.health.connect:connect-client`).
  It needs `<uses-permission android:name="android.permission.health.READ_STEPS"/>` and the
  Health Connect permissions-rationale activity in the manifest.
- [`ios/HealthKitBridge.swift`](ios/HealthKitBridge.swift): HealthKit, using `HKStatisticsCollectionQuery` with `.cumulativeSum` per day.
  It needs the HealthKit capability and `NSHealthShareUsageDescription` in Info.plist.

Both files are reference code for the native shell (for example a Capacitor app or a plain WebView app). They are
not compiled as part of this repository. The WebView loads the deployed HealthSense web app, and the
user's JWT stays in the web layer's `localStorage`, so all API calls go through the normal authenticated client.
