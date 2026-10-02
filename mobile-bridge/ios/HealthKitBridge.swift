// Reference: exposes window.HealthSenseBridge to the HealthSense web app inside a WKWebView.
// Requires the HealthKit capability and NSHealthShareUsageDescription in Info.plist.
import Foundation
import HealthKit
import WebKit

final class HealthKitBridge: NSObject, WKScriptMessageHandler {
    private let store = HKHealthStore()
    private weak var web: WKWebView?
    private let types: [String: HKQuantityType] = ["steps": HKQuantityType(.stepCount)]

    init(web: WKWebView) {
        self.web = web
        super.init()
        web.configuration.userContentController.add(self, name: "hsBridge")
        web.configuration.userContentController.addUserScript(
            WKUserScript(source: HealthKitBridge.injectJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private func reply(_ id: String, _ json: String) {
        DispatchQueue.main.async { self.web?.evaluateJavaScript("window.__hsBridgeResolve('\(id)', \(json))") }
    }
    private func fail(_ id: String, _ msg: String) {
        DispatchQueue.main.async { self.web?.evaluateJavaScript("window.__hsBridgeReject('\(id)', \(Self.quote(msg)))") }
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let id = body["id"] as? String, let name = body["name"] as? String else { return }
        let args = body["args"] as? [Any] ?? []
        switch name {
        case "platform": reply(id, "\"ios\"")
        case "isAvailable": reply(id, HKHealthStore.isHealthDataAvailable() ? "{\"available\":true}" : "{\"available\":false,\"reason\":\"unsupported\"}")
        case "requestPermissions": requestPermissions(id, metrics: args.first as? [String] ?? [])
        case "readDaily": readDaily(id, metric: args[0] as? String ?? "", from: args[1] as? String ?? "", to: args[2] as? String ?? "")
        case "openSettings":
            DispatchQueue.main.async { UIApplication.shared.open(URL(string: "x-apple-health://")!) }
            reply(id, "null")
        default: fail(id, "unknown method")
        }
    }

    /// Shows the HealthKit permission sheet. HealthKit deliberately hides *read* denials, so a metric is reported
    /// as granted only if a query can return data; an empty read later surfaces as "no data", never as 0.
    private func requestPermissions(_ id: String, metrics: [String]) {
        let wanted = Set(metrics.compactMap { types[$0] })
        store.requestAuthorization(toShare: [], read: wanted) { ok, _ in
            let granted = ok ? metrics.filter { self.types[$0] != nil } : []
            let denied = metrics.filter { !granted.contains($0) }
            self.reply(id, "{\"granted\":\(Self.json(granted)),\"denied\":\(Self.json(denied))}")
        }
    }

    /// Daily step totals (HealthKit merges iPhone + Apple Watch without double counting). Empty days are omitted.
    private func readDaily(_ id: String, metric: String, from: String, to: String) {
        guard let type = types[metric] else { return fail(id, "unsupported metric") }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        guard let start = f.date(from: from), let endDay = f.date(from: to),
              let end = Calendar.current.date(byAdding: .day, value: 1, to: endDay) else { return fail(id, "bad dates") }
        let q = HKStatisticsCollectionQuery(
            quantityType: type, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
            options: .cumulativeSum, anchorDate: start, intervalComponents: DateComponents(day: 1))
        q.initialResultsHandler = { _, results, error in
            if let error = error { return self.fail(id, error.localizedDescription) }
            var rows: [String] = []
            results?.enumerateStatistics(from: start, to: end) { s, _ in
                guard let sum = s.sumQuantity() else { return } // no data ≠ 0
                let date = f.string(from: s.startDate)
                rows.append("{\"date\":\"\(date)\",\"value\":\(Int(sum.doubleValue(for: .count()))),\"source_record_id\":\"hk_steps_\(date)\"}")
            }
            self.reply(id, "[\(rows.joined(separator: ","))]")
        }
        store.execute(q)
    }

    private static func json(_ a: [String]) -> String { "[" + a.map { "\"\($0)\"" }.joined(separator: ",") + "]" }
    private static func quote(_ s: String) -> String { "\"" + s.replacingOccurrences(of: "\"", with: "\\\"") + "\"" }

    static let injectJS = """
    (function () {
      var calls = {}, n = 0;
      window.__hsBridgeResolve = function (id, v) { calls[id] && calls[id][0](v); delete calls[id]; };
      window.__hsBridgeReject = function (id, e) { calls[id] && calls[id][1](new Error(e)); delete calls[id]; };
      function call(name, args) {
        return new Promise(function (res, rej) { var id = 'c' + (++n); calls[id] = [res, rej];
          window.webkit.messageHandlers.hsBridge.postMessage({ id: id, name: name, args: args || [] }); });
      }
      window.HealthSenseBridge = {
        platform: function () { return call('platform'); },
        isAvailable: function () { return call('isAvailable'); },
        requestPermissions: function (m) { return call('requestPermissions', [m]); },
        readDaily: function (metric, from, to) { return call('readDaily', [metric, from, to]); },
        openSettings: function () { return call('openSettings'); }
      };
    })();
    """
}
