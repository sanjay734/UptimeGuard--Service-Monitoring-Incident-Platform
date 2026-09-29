import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const api = async (path, opts = {}) => {
  const r = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { let m = 'Request failed'; try { const j = await r.json(); m = j.errors?.[0]?.defaultMessage || j.message || m; } catch {} throw new Error(m); }
  return r.status === 204 ? null : r.json();
};
const time = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const usePoll = (fn, ms = 5000) => { useEffect(() => { fn(); const i = setInterval(fn, ms); return () => clearInterval(i); }, [fn, ms]); };

function StatusPage() {
  const [d, setD] = useState(null);
  usePoll(useCallback(() => api('/status').then(setD).catch(() => {}), []));
  if (!d) return <div className="wrap">Loading status...</div>;
  return (
    <div className="wrap">
      <h1>UptimeGuard Status</h1>
      <div className={'banner ' + d.overall}>{d.overall === 'OPERATIONAL' ? 'All systems operational' : 'Some services are experiencing an outage'}</div>
      {d.services.map(s => (
        <div className="card row" key={s.name}><b>{s.name}</b><span className="mu">{s.uptime24h}% uptime (24h) · {s.avgResponseMs} ms</span><span className={'pill ' + s.status}>{s.status}</span></div>
      ))}
      <h2>Recent incidents</h2>
      {d.incidents.length === 0 ? <p className="mu">No incidents.</p> : d.incidents.map(i => (
        <div className="card row" key={i.id}><span>{i.title}</span><span className="mu">{time(i.startedAt)}</span><span className={'pill ' + i.status}>{i.status}</span></div>
      ))}
      <a href="#/">Back to dashboard</a>
    </div>
  );
}

function Dashboard() {
  const [rows, setRows] = useState([]); const [incidents, setIncidents] = useState([]);
  const [sel, setSel] = useState(null); const [results, setResults] = useState([]);
  const [form, setForm] = useState({ name: '', url: '', intervalSeconds: 60, alertEmail: '' }); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setRows(await api('/monitors')); setIncidents(await api('/incidents')); if (sel) setResults(await api(`/monitors/${sel}/results`)); }
    catch (e) { setErr('Cannot reach the backend: ' + e.message); }
  }, [sel]);
  usePoll(load);
  const add = async e => {
    e.preventDefault(); setErr('');
    try { await api('/monitors', { method: 'POST', body: JSON.stringify({ ...form, intervalSeconds: +form.intervalSeconds }) }); setForm({ name: '', url: '', intervalSeconds: 60, alertEmail: '' }); load(); }
    catch (e) { setErr(e.message); }
  };
  const act = async (fn) => { try { await fn(); load(); } catch (e) { setErr(e.message); } };
  const up = rows.filter(r => r.monitor.status === 'UP').length, down = rows.filter(r => r.monitor.status === 'DOWN').length;
  return (
    <div className="wrap">
      <div className="row"><h1>UptimeGuard</h1><a href="#/status">Public status page</a></div>
      <div className="card row"><span><b>{up}</b> up</span><span><b>{down}</b> down</span><span><b>{incidents.filter(i => i.status === 'OPEN').length}</b> open incidents</span></div>
      <div className="card"><form onSubmit={add}>
        <input placeholder="Name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="https://your-service.com/health" required value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
        <input type="number" min="10" title="Interval (seconds)" value={form.intervalSeconds} onChange={e => setForm({ ...form, intervalSeconds: e.target.value })} />
        <input type="email" placeholder="Alert email (optional)" value={form.alertEmail} onChange={e => setForm({ ...form, alertEmail: e.target.value })} />
        <button className="p">Add monitor</button></form>
        {err && <div className="err">{err}</div>}</div>
      <div className="grid">
        {rows.map(({ monitor: m, uptime24h, avgResponseMs }) => (
          <div key={m.id} className={'card' + (sel === m.id ? ' sel' : '')} onClick={() => { setSel(m.id); api(`/monitors/${m.id}/results`).then(setResults); }}>
            <div className="row"><b>{m.name}</b><span className={'pill ' + (m.active ? m.status : 'PAUSED')}>{m.active ? m.status : 'PAUSED'}</span></div>
            <div className="mu">{m.url}</div><div className="mu">{uptime24h}% uptime (24h) · {avgResponseMs} ms avg · every {m.intervalSeconds}s</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={e => { e.stopPropagation(); act(() => api(`/monitors/${m.id}/toggle`, { method: 'POST' })); }}>{m.active ? 'Pause' : 'Resume'}</button>
              <button className="d" onClick={e => { e.stopPropagation(); if (confirm('Delete ' + m.name + '?')) { if (sel === m.id) setSel(null); act(() => api(`/monitors/${m.id}`, { method: 'DELETE' })); } }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="mu">No monitors yet. Add a URL above to start monitoring.</p>}
      {sel && <div className="card" style={{ marginTop: 12 }}><h2>Response time (last 100 checks)</h2>
        <div style={{ height: 240 }}><ResponsiveContainer><LineChart data={results.map(r => ({ t: time(r.checkedAt), ms: r.success ? r.responseTimeMs : null }))}>
          <XAxis dataKey="t" minTickGap={40} /><YAxis unit=" ms" /><Tooltip /><Line dataKey="ms" stroke="#0f9d58" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div></div>}
      <div className="card" style={{ marginTop: 12 }}><h2>Incidents</h2>
        {incidents.length === 0 ? <p className="mu">No incidents yet.</p> : <table><thead><tr><th>Service</th><th>Title</th><th>Started</th><th>Resolved</th><th>Status</th></tr></thead><tbody>
          {incidents.map(i => <tr key={i.id}><td>{i.monitorName}</td><td>{i.title}</td><td>{time(i.startedAt)}</td><td>{i.resolvedAt ? time(i.resolvedAt) : '-'}</td><td><span className={'pill ' + i.status}>{i.status}</span></td></tr>)}</tbody></table>}
      </div>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash === '#/status' ? <StatusPage /> : <Dashboard />;
}
