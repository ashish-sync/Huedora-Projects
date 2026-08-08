import { useState } from 'react';
import { api } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT } from '../../shared/importFilePolicy.js';
import { getErrorMessage, validateImportFileClient } from '../../shared/importErrors.js';

export default function ImportsPage() {
  const { can } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!can('imports:execute')) {
    return <p className="error">You do not have import permission.</p>;
  }

  const run = async (path, file) => {
    const pre = validateImportFileClient(file);
    if (pre) {
      setError(pre);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(path, { method: 'POST', body: fd });
      setResult(res.data);
    } catch (err) {
      setError(getErrorMessage(err, IMPORT_ACCEPT_HINT));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: 'Excel import' }]}
      title="Excel import"
      description="Validate rows first, then commit to Contact Directory, Asset Register, or verification."
    >
      {error && <p className="error">{error}</p>}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}
      >
        <ImportCard
          title={`${MODULE.ASSET_INVENTORY} sheet`}
          hint="Custodian Name, Email/Contact, Asset Name, Serial No, Agreement Status, Custody…"
          busy={busy}
          onDry={(f) => run('/imports/inventory/dry-run', f)}
          onCommit={(f) => run('/imports/inventory/commit', f)}
        />
        <ImportCard
          title={`${MODULE.ASSET_VERIFICATION} sheet`}
          hint="Month'Year, Serial No, Physical, Functionality, Final Status…"
          busy={busy}
          onDry={(f) => run('/imports/verification/dry-run', f)}
          onCommit={(f) => run('/imports/verification/commit', f)}
        />
      </div>

      {result && (
        <div className="card">
          <h3 className="card-title" style={{ margin: '0 0 var(--space-3)' }}>
            Last job: {result.type} / {result.mode}
          </h3>
          <p>
            Status <span className="badge tone-neutral">{result.status}</span> · rows {result.totalRows} · ok{' '}
            {result.successRows} · errors {result.errorRows}
          </p>
          {result.errorReport?.downloadPath ? (
            <p className="muted">
              Failed rows Excel is ready in Notifications ({result.errorReport.fileName}).
            </p>
          ) : null}
          {result.summary && (
            <pre style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-body-size)', overflow: 'auto' }}>
              {JSON.stringify(result.summary, null, 2)}
            </pre>
          )}
          {!!(result.rowErrors || result.errors)?.length && (
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {(result.rowErrors || result.errors).slice(0, 50).map((e, i) => (
                  <tr key={i}>
                    <td>{e.row}</td>
                    <td>{e.field}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </PageShell>
  );
}

function ImportCard({ title, hint, busy, onDry, onCommit }) {
  const [file, setFile] = useState(null);
  return (
    <div className="card">
      <h3 className="card-title" style={{ margin: '0 0 var(--space-2)' }}>{title}</h3>
      <p className="muted" style={{ margin: '0 0 var(--space-3)' }}>
        {hint}
      </p>
      <p className="muted mono-sm" style={{ margin: '0 0 var(--space-2)' }}>
        {IMPORT_ACCEPT_HINT}
      </p>
      <FilePicker
        accept={IMPORT_ACCEPT_ATTR}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <div className="row" style={{ marginTop: 'var(--space-3)' }}>
        <button className="btn secondary" type="button" disabled={!file || busy} onClick={() => onDry(file)}>
          Dry-run
        </button>
        <button className="btn" type="button" disabled={!file || busy} onClick={() => onCommit(file)}>
          Commit
        </button>
      </div>
    </div>
  );
}
