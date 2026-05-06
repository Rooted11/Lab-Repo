import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import { formatMountainDateTime } from "../utils/time";

export default function PlaybooksPage({ showAlert }) {
  const [playbooks, setPlaybooks] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [showForm, setShowForm] = useState(true);
  const [showList, setShowList] = useState(true);
  const [loading, setLoading] = useState(true);
  const [execLoading, setExecLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPlaybookDefs();
      setPlaybooks(data);
    } catch (err) {
      setError(err.message);
      showAlert?.(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const refreshExecutions = useCallback(async () => {
    setExecLoading(true);
    try {
      const data = await api.getPlaybookExecutions(50);
      setExecutions(data || []);
    } catch (err) {
      // Soft-fail — don't block the page if this endpoint isn't available yet
      setExecutions([]);
    } finally {
      setExecLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshExecutions();
    const interval = setInterval(refreshExecutions, 15000);
    return () => clearInterval(interval);
  }, [refresh, refreshExecutions]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createPlaybookDef({
        name: form.name,
        description: form.description,
        enabled: true,
        triggers: [],
        actions: [],
      });
      setForm({ name: "", description: "" });
      showAlert?.("Playbook created", "success");
      refresh();
    } catch (err) {
      showAlert?.(err.message, "error");
    }
  }

  async function togglePlaybook(pb) {
    try {
      await api.updatePlaybookDef(pb.id, { enabled: !pb.enabled });
      refresh();
    } catch (err) {
      showAlert?.(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Playbooks</h2>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-cyan-400"
          >
            {showForm ? "Hide Form" : "Show Form"}
          </button>
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-cyan-400"
          >
            {showList ? "Hide List" : "Show List"}
          </button>
        </div>
      </div>

      {/* Recent Auto-Fires - what actually ran */}
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-cyan-200">Recent Auto-Fires</h3>
            <p className="text-xs text-slate-400">
              Every action the system took on its own. Auto-refreshes every 15 seconds.
            </p>
          </div>
          <button
            onClick={refreshExecutions}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
          >
            Refresh
          </button>
        </div>

        {execLoading && executions.length === 0 ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : executions.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            No automated playbook fires yet. Run an attack simulation, and this feed will fill up.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {executions.map((e) => {
              const ok = e.status === "completed";
              const borderClass = ok
                ? "border-emerald-700/30 bg-emerald-950/20"
                : "border-rose-700/40 bg-rose-950/30";
              return (
                <div key={e.id} className={`rounded-xl border ${borderClass} p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-cyan-900/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200 font-semibold">
                        {e.playbook}
                      </span>
                      <span className="text-slate-300">{e.action}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-medium text-white">{e.target || "—"}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          ok ? "bg-emerald-900/60 text-emerald-200" : "bg-rose-900/60 text-rose-200"
                        }`}
                      >
                        {ok ? "RAN" : "FAILED"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatMountainDateTime(e.executed_at)}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Triggered by{" "}
                    <span className="text-slate-300">
                      Incident #{e.incident_id}
                      {e.incident_severity ? ` (${e.incident_severity})` : ""}
                    </span>
                    {e.incident_title ? `  —  ${e.incident_title}` : ""}
                  </div>

                  {e.result ? (
                    <div className="mt-1 text-[11px] text-slate-500 break-all">
                      {e.result.length > 220 ? e.result.slice(0, 220) + "..." : e.result}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
          <div className="text-sm text-slate-300 font-semibold">Add Playbook</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Create Playbook
          </button>
        </form>
      )}

      {showList && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-300">Available Playbooks</div>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : error ? (
            <div className="text-rose-300 text-sm">{error}</div>
          ) : (
            <div className="grid gap-3">
              {playbooks.map((pb) => (
                <div key={pb.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold">{pb.name}</div>
                    <button
                      onClick={() => togglePlaybook(pb)}
                      className={`rounded-full px-3 py-1 text-[11px] border ${
                        pb.enabled
                          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                          : "border-slate-700 bg-slate-800 text-slate-300"
                      }`}
                    >
                      {pb.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{pb.description}</div>
                  <div className="mt-2 text-xs text-slate-500">Actions: {pb.actions?.length || 0}</div>
                </div>
              ))}
              {playbooks.length === 0 && <div className="text-slate-400 text-sm">No playbooks yet.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
