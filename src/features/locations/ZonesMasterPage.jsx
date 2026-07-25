import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import PageShell from '../../components/ui/PageShell.jsx';

export default function ZonesMasterPage({ embedded = false } = {}) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api('/geo/zones')
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const content = (
  <div className="zones-master-page">
    <p className="meta-text">
      Camp zones are mapped to states. When a state is selected on a camp request, the zone is filled in automatically.
    </p>
    {error ? <p className="error-text">{error}</p> : null}
    {loading ? <p className="meta-text">Loading zones…</p> : null}
    <div className="zones-master-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
      {rows.map((zone) => (
        <article key={zone._id} className="zones-master-card" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{zone.name}</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
            {(zone.states || []).map((st) => (
              <li key={st.stateId || st.stateName}>{st.stateName}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
    {!loading && !rows.length && !error ? (
      <p className="meta-text">No zones configured yet. Restart the server to seed zone master data.</p>
    ) : null}
  </div>
  );

  if (embedded) return content;

  return (
    <PageShell title="Zones" subtitle="Camp One geography zones">
      {content}
    </PageShell>
  );
}
