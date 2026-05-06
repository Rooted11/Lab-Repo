import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { formatMountainDateTime } from "../utils/time";

const EVENT_OPTIONS = [
  { value: "", label: "All event types" },
  { value: "auth_failure", label: "Auth failure" },
  { value: "auth_success", label: "Auth success" },
  { value: "privilege_escalation", label: "Privilege escalation" },
  { value: "lateral_movement", label: "Lateral movement" },
  { value: "c2_beacon", label: "C2 beacon" },
  { value: "malware_detected", label: "Malware detected" },
  { value: "data_exfiltration", label: "Data exfiltration" },
  { value: "network_scan", label: "Network scan" },
  { value: "firewall_event", label: "Firewall event" },
  { value: "ssh_event", label: "SSH event" },
  { value: "account_change", label: "Account change" },
  { value: "scheduled_task", label: "Scheduled task" },
  { value: "system_event", label: "System event" },
  { value: "syslog", label: "Syslog" },
];

const LIMIT_OPTIONS = [
  { value: 100, label: "100 results" },
  { value: 200, label: "200 results" },
  { value: 500, label: "500 results" },
  { value: 1000, label: "1000 results" },
];

const RISK_COLOR = (r) => {
  if (r >= 80) return "text-red-400";
  if (r >= 60) return "text-orange-400";
  if (r >= 40) return "text-yellow-400";
  return "text-slate-500";
};

const RISK_BAR = (r) => {
  if (r >= 80) return "bg-red-500";
  if (r >= 60) return "bg-orange-500";
  if (r >= 40) return "bg-yellow-500";
  return "bg-blue-500";
};

function toIsoOrNull(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function LogArchive({ showAlert }) {
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState(null);

  const [results, setResults] = useState([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [filesScanned, setFilesScanned] = useState(0);
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [q, setQ] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [eventType, setEventType] = useState("");
  const [source, setSource] = useState("");
  const [minRisk, setMinRisk] = useState("");
  const [limit, setLimit] = useState(200);

  const [selected, setSelected] = useState(null);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const data = await api.getArchiveFiles();
      const list = Array.isArray(data) ? data : data.files || [];
      setFiles(list);
    } catch (err) {
      setFilesError(err.message);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const fileSummary = useMemo(() => {
    if (!files.length) return null;
    const sizeBytes = files.reduce((s, f) => s + (f.size_bytes || f.bytes || 0), 0);
    const sizeMb = sizeBytes / (1024 * 1024);
    const oldest = files[files.length - 1];
    const newest = files[0];
    return { count: files.length, sizeMb, oldest, newest };
  }, [files]);

  async function runSearch(e) {
    if (e) e.preventDefault();
    setSearchLoading(true);
    setSearchError(null);
    setSearched(true);
    try {
      const params = { limit };
      if (q.trim()) params.q = q.trim();
      const sinceIso = toIsoOrNull(since);
      const untilIso = toIsoOrNull(until);
      if (sinceIso) params.since = sinceIso;
      if (untilIso) params.until = untilIso;
      if (eventType) params.event_type = eventType;
      if (source.trim()) params.source = source.trim();
      if (minRisk !== "") {
        const v = Number(minRisk);
        if (!Number.isNaN(v)) params.min_risk = v;
      }
      const data = await api.searchArchivedLogs(params);
      const items = Array.isArray(data) ? data : data.items || data.logs || [];
      setResults(items);
      setResultsTotal(data?.total ?? items.length);
      setFilesScanned(data?.files_scanned ?? 0);
      setSelected(null);
    } catch (err) {
      setSearchError(err.message);
      setResults([]);
      setResultsTotal(0);
      setFilesScanned(0);
      showAlert?.(err.message, "error");
    } finally {
      setSearchLoading(false);
    }
  }

  function clearFilters() {
    setQ("");
    setSince("");
    setUntil("");
    setEventType("");
    setSource("");
    setMinRisk("");
    setLimit(200);
    setSearched(false);
    setResults([]);
    setResultsTotal(0);
    setFilesScanned(0);
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Log Archive</h2>
          <p className="text-xs text-slate-400">
            Pull up old logs that have been rotated out of the live database. Archives are gzipped daily snapshots
            kept for the full retention window.
          </p>
        </div>
        <button
          onClick={loadFiles}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
        >
          Refresh inventory
        </button>
      </div>

      {/* Inventory summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-2">Archive inventory</div>
        {filesLoading ? (
          <div className="text-slate-400 text-sm">Loading inventory...</div>
        ) : filesError ? (
          <div className="text-rose-300 text-sm">{filesError}</div>
        ) : !fileSummary ? (
          <div className="text-slate-400 text-sm">
            No archive files yet. Logs are archived once they age past the live retention window.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Files</div>
              <div className="text-white font-mono mt-0.5">{fileSummary.count.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Total size</div>
              <div className="text-white font-mono mt-0.5">{fileSummary.sizeMb.toFixed(1)} MB</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Oldest</div>
              <div className="text-white font-mono mt-0.5 text-xs">
                {fileSummary.oldest?.name || fileSummary.oldest?.filename || "?"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Newest</div>
              <div className="text-white font-mono mt-0.5 text-xs">
                {fileSummary.newest?.name || fileSummary.newest?.filename || "?"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search form */}
      <form
        onSubmit={runSearch}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Search text
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="user, IP, hostname, message text..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Event type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {EVENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Source
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="hostname or service"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              From (since)
            </label>
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              To (until)
            </label>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Min risk
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={minRisk}
              onChange={(e) => setMinRisk(e.target.value)}
              placeholder="0-100"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Limit
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {LIMIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={searchLoading}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            {searchLoading ? "Searching..." : "Search archives"}
          </button>
        </div>
      </form>

      {/* Results */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {searchLoading
              ? "Scanning archives..."
              : !searched
                ? "Set filters and run a search to scan the gzipped archive files."
                : `${results.length.toLocaleString()} of ${resultsTotal.toLocaleString()} matches across ${filesScanned.toLocaleString()} archive files`}
          </span>
          {searched && results.length >= limit && (
            <span className="text-amber-400">
              Result limit hit — narrow filters or raise the limit to see more
            </span>
          )}
        </div>

        {searchLoading ? (
          <div className="text-slate-400 text-sm">Scanning archives, this can take a moment...</div>
        ) : searchError ? (
          <div className="text-rose-300 text-sm">{searchError}</div>
        ) : !searched ? null : results.length === 0 ? (
          <div className="text-slate-400 text-sm">No archived logs match these filters.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-950 z-10">
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-widest">
                  <th className="text-left p-2 pl-3">Time</th>
                  <th className="text-left p-2">Source</th>
                  <th className="text-left p-2">Event</th>
                  <th className="text-left p-2">IP</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Risk</th>
                  <th className="text-left p-2">Archive</th>
                  <th className="text-left p-2 pr-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {results.map((log, idx) => {
                  const key = log.id ?? `${log.timestamp}-${idx}`;
                  const isSelected = selected && (selected.id ?? `${selected.timestamp}-${selected._idx}`) === key;
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelected(isSelected ? null : { ...log, _idx: idx })}
                      className={`border-b border-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? "bg-cyan-950/30 ring-1 ring-cyan-700" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="p-2 pl-3 text-slate-500 whitespace-nowrap font-mono">
                        {formatMountainDateTime(log.timestamp)}
                      </td>
                      <td className="p-2 text-slate-400 whitespace-nowrap">{log.source || "--"}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
                          {(log.event_type || "unknown").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-slate-400 whitespace-nowrap">{log.ip_src || "--"}</td>
                      <td className="p-2 text-slate-400 max-w-[8rem] truncate">{log.user || "--"}</td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <div className="w-8 h-1.5 bg-slate-800 rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${RISK_BAR(log.risk_score || 0)}`}
                              style={{ width: `${log.risk_score || 0}%` }}
                            />
                          </div>
                          <span className={`font-mono ${RISK_COLOR(log.risk_score || 0)}`}>
                            {Math.round(log.risk_score || 0)}
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-slate-500 text-[10px] whitespace-nowrap font-mono">
                        {log._archive_file || "--"}
                      </td>
                      <td className="p-2 pr-3 text-slate-400 max-w-md truncate">{log.message || "--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-cyan-200">
              Archived Log {selected.id ? `#${selected.id}` : ""}
            </h3>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-300">
            <div><span className="text-slate-500">Timestamp:</span> <span className="font-mono">{formatMountainDateTime(selected.timestamp)}</span></div>
            <div><span className="text-slate-500">Source:</span> <span className="font-mono">{selected.source || "--"}</span></div>
            <div><span className="text-slate-500">Event type:</span> <span className="font-mono">{selected.event_type || "--"}</span></div>
            <div><span className="text-slate-500">Log level:</span> <span className="font-mono">{selected.log_level || "--"}</span></div>
            <div><span className="text-slate-500">Source IP:</span> <span className="font-mono">{selected.ip_src || "--"}</span></div>
            <div><span className="text-slate-500">Dest IP:</span> <span className="font-mono">{selected.ip_dst || "--"}</span></div>
            <div><span className="text-slate-500">User:</span> <span className="font-mono">{selected.user || "--"}</span></div>
            <div><span className="text-slate-500">Risk score:</span> <span className={`font-mono ${RISK_COLOR(selected.risk_score || 0)}`}>{Math.round(selected.risk_score || 0)}/100</span></div>
            <div><span className="text-slate-500">Anomalous:</span> <span className="font-mono">{selected.is_anomalous ? "yes" : "no"}</span></div>
            <div><span className="text-slate-500">Archive file:</span> <span className="font-mono text-[11px]">{selected._archive_file || "--"}</span></div>
          </div>
          {selected.message && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Message</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300 font-mono break-all max-h-40 overflow-y-auto">
                {selected.message}
              </div>
            </div>
          )}
          {selected.raw_data && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Raw data</div>
              <pre className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400 font-mono break-all max-h-40 overflow-y-auto">
                {typeof selected.raw_data === "string" ? selected.raw_data : JSON.stringify(selected.raw_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
