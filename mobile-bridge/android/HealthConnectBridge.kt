// Reference: exposes window.HealthSenseBridge to the HealthSense web app inside an Android WebView.
// Dependency: androidx.health.connect:connect-client
// Manifest: <uses-permission android:name="android.permission.health.READ_STEPS"/> + permissions-rationale activity.
package app.healthsense.bridge

import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.Period

/**
 * The WebView injects a small JS shim (see INJECT_JS) that turns these callback-style methods into the
 * Promise-based window.HealthSenseBridge contract described in mobile-bridge/README.md.
 */
class HealthConnectBridge(private val activity: ComponentActivity, private val web: WebView) {
    private val scope = CoroutineScope(Dispatchers.Main)
    private val metricPermission = mapOf("steps" to HealthPermission.getReadPermission(StepsRecord::class))
    private var pendingGrant: CompletableDeferred<Set<String>>? = null

    // Must be registered before the activity is STARTED.
    private val permissionLauncher: ActivityResultLauncher<Set<String>> =
        activity.registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
            pendingGrant?.complete(granted)
        }

    private fun client() = HealthConnectClient.getOrCreate(activity)

    private fun reply(id: String, json: String) = web.post {
        web.evaluateJavascript("window.__hsBridgeResolve(${JSONObject.quote(id)}, $json)", null)
    }

    @JavascriptInterface fun platform(id: String) = reply(id, "\"android\"")

    @JavascriptInterface fun isAvailable(id: String) {
        val status = HealthConnectClient.getSdkStatus(activity)
        val json = when (status) {
            HealthConnectClient.SDK_AVAILABLE -> """{"available":true}"""
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> """{"available":false,"reason":"not_installed"}"""
            else -> """{"available":false,"reason":"unsupported"}"""
        }
        reply(id, json)
    }

    /** Shows the Health Connect permission sheet; never assumes a grant. */
    @JavascriptInterface fun requestPermissions(id: String, metricsJson: String) {
        val metrics = JSONArray(metricsJson).let { a -> (0 until a.length()).map { a.getString(it) } }
        val wanted = metrics.mapNotNull { metricPermission[it] }.toSet()
        scope.launch {
            val already = client().permissionController.getGrantedPermissions()
            val granted = if (already.containsAll(wanted)) already else {
                pendingGrant = CompletableDeferred()
                permissionLauncher.launch(wanted)
                pendingGrant!!.await()
            }
            val ok = metrics.filter { metricPermission[it] in granted }
            val out = JSONObject().put("granted", JSONArray(ok)).put("denied", JSONArray(metrics - ok.toSet()))
            reply(id, out.toString())
        }
    }

    /** Daily step totals (Health Connect de-duplicates across apps/devices). Days with no data are omitted. */
    @JavascriptInterface fun readDaily(id: String, metric: String, from: String, to: String) {
        scope.launch {
            try {
                require(metric == "steps") { "unsupported metric" }
                val result = client().aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(
                            LocalDate.parse(from).atStartOfDay(), LocalDate.parse(to).plusDays(1).atStartOfDay()
                        ),
                        timeRangeSlicer = Period.ofDays(1),
                    )
                )
                val rows = JSONArray()
                for (bucket in result) {
                    val steps = bucket.result[StepsRecord.COUNT_TOTAL] ?: continue // no data ≠ 0
                    val date = bucket.startTime.toLocalDate().toString()
                    rows.put(JSONObject().put("date", date).put("value", steps).put("source_record_id", "hc_steps_$date"))
                }
                reply(id, rows.toString())
            } catch (e: Exception) {
                web.post { web.evaluateJavascript("window.__hsBridgeReject(${JSONObject.quote(id)}, ${JSONObject.quote(e.message ?: "read failed")})", null) }
            }
        }
    }

    @JavascriptInterface fun openSettings(id: String) {
        activity.startActivity(android.content.Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
        reply(id, "null")
    }

    companion object {
        /** Call web.addJavascriptInterface(bridge, "HSNative") and inject this after page load. */
        const val INJECT_JS = """
          (function () {
            var calls = {}, n = 0;
            window.__hsBridgeResolve = function (id, v) { calls[id] && calls[id][0](v); delete calls[id]; };
            window.__hsBridgeReject = function (id, e) { calls[id] && calls[id][1](new Error(e)); delete calls[id]; };
            function call(name, args) {
              return new Promise(function (res, rej) { var id = 'c' + (++n); calls[id] = [res, rej]; HSNative[name].apply(HSNative, [id].concat(args || [])); });
            }
            window.HealthSenseBridge = {
              platform: function () { return call('platform'); },
              isAvailable: function () { return call('isAvailable'); },
              requestPermissions: function (m) { return call('requestPermissions', [JSON.stringify(m)]); },
              readDaily: function (metric, from, to) { return call('readDaily', [metric, from, to]); },
              openSettings: function () { return call('openSettings'); }
            };
          })();
        """
    }
}
