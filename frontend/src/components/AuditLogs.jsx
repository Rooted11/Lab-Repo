import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import { formatMountainDateTime } from "../utils/time";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "login", label: "Login" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "system", label: "System" },
];

const SINCE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "60", label: "Last hour" },
  { value: "1440", label: "Last 24 hours" },
  { value: "10080", label: "Last 7 days" },
  { value: "43200", label: "Last 30 days" },
];

const SUCCESS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "true", label: "Successful only" },
  { value: "false", label: "Failed only" },
];

export default function AuditLogs({ showAlert }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [since, setSince] = useState("");
  const [successFilter, setSuccessFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 200 };
      if (q.trim()) params.q = q.trim();
      if (action) params.action = action;
      if (since) params.since_minutes = since;
      if (successFilter) params.success = successFilter;
      const data = await api.getAuditLogs(params);
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError(err.message);
      showAlert?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [q, action, since, successFilter, showAlert]);

  useEffect(() => {
    load();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    load();
  }

  function clearFilters() {
    setQ("");
    setAction("");
    setSince("");
    setSuccessFilter("");
    setTimeout(() => load(), 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Audit Logs</h2>
          <p className="text-xs text-slate-400">
            Search and filter every privileged action — including login attempts.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
        >
          Refresh
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Search
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="username, IP, entity, or text in details"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Status
            </label>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {SUCCESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Time
            </label>
            <select
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {SINCE_OPTIONS.map((o) => (
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
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Search
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {loading ? "Loading..." : `${items.length} of ${total} entries`}
          </span>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : error ? (
          <div className="text-rose-300 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-slate-400 text-sm">No audit entries match your search.</div>
        ) : (
          <div className="space-y-2">
            {items.map((log) => {
              const success = log.details?.success;
              const reason = log.details?.reason;
              const isLogin = log.action === "login";
              const failure = success === false;
              const borderColor = failure
                ? "border-rose-700/40 bg-rose-950/30"
                : isLogin
                  ? "border-emerald-700/30 bg-emerald-950/20"
                  : "border-slate-800 bg-slate-950/60";
              return (
                <div key={log.id} className={`rounded-xl border ${borderColor} p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{log.actor}</span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
                        {log.action}
                      </span>
                      {isLogin && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            failure ? "bg-rose-900/60 text-rose-200" : "bg-emerald-900/60 text-emerald-200"
                          }`}
                        >
                          {failure ? "FAILED" : "OK"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatMountainDateTime(log.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {log.entity_type} {log.entity_id ? `- ${log.entity_id}` : ""}
                    {log.ip_address ? `  -  IP ${log.ip_address}` : ""}
                    {reason ? `  -  ${reason}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
