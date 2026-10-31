import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import ImportInProgressGuard from '../../components/ui/ImportInProgressGuard.jsx';
import { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT } from '../../shared/importFilePolicy.js';
import { getErrorMessage, validateImportFileClient } from '../../shared/importErrors.js';
import {
  importKindLabel,
  importOutcomeSummary,
  importStatusLabel,
} from '../dashboards/opsReviewCatalog.js';
import '../audit/activityLog.css';

export default function ImportsPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const [result, setResult] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const canImport = can('imports:execute') || can('*');

  const loadJobs = () =>
    api('/imports/jobs')
      .then((r) => setJobs(r.data || []))
      .catch(() => {});

  useEffect(() => {
    if (!canImport) return;
    loadJobs();
  }, [canImport]);

  if (!canImport) {
    return <p className="error">You do not have permission to upload spreadsheets.</p>;
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
      if (res.data?._id) setSelectedId(String(res.data._id));
      loadJobs();
    } catch (err) {
      setError(getErrorMessage(err, IMPORT_ACCEPT_HINT));
    } finally {
      setBusy(false);
    }
  };

  const selected = result && String(result._id || '') === selectedId
    ? result
    : jobs.find((job) => String(job._id) === selectedId);

  return (
    <PageShell
      bare={embedded}
      breadcrumbs={embedded ? [] : [{ to: '/', label: MODULE.HOME }, { label: MODULE.UPLOADS }]}
      title={embedded ? '' : MODULE.UPLOADS}
      description={
        embedded
          ? ''
          : 'Check a spreadsheet first, then save the good rows into Asset One or Verification One.'
      }
    >
      <ImportInProgressGuard active={busy} />
      {error ? <p className="error">{error}</p> : null}

      <div className="ops-upload-grid">
        <UploadCard
          title="Asset register"
          hint="People looking after devices, asset names, serial numbers, and custody."
          busy={busy}
          onCheck={(f) => run('/imports/inventory/dry-run', f)}
          onSave={(f) => run('/imports/inventory/commit', f)}
        />
        <UploadCard
          title="Monthly verification"
          hint="Month, serial number, physical check, and whether the device is working."
          busy={busy}
          onCheck={(f) => run('/imports/verification/dry-run', f)}
          onSave={(f) => run('/imports/verification/commit', f)}
        />
      </div>

      <div className={`activity-log ops-split-follow${selected ? ' activity-log--split' : ''}`}>
        <div className="card card--flush activity-log-list">
          <p className="section-label activity-log-list-head">Recent uploads</p>
          {(result && !jobs.some((j) => String(j._id) === String(result._id)) ? [result, ...jobs] : jobs)
            .slice(0, 20)
            .map((job) => {
              const id = String(job._id || job.startedAt || job.type);
              const open = selectedId === id;
              const failed = Number(job.errorRows) > 0
                || ['FAILED', 'FAIL', 'ERROR'].includes(String(job.status || '').toUpperCase());
              const partial = failed && Number(job.successRows) > 0;
              const tone = partial ? 'warn' : failed ? 'bad' : 'ok';
              return (
                <button
                  key={id}
                  type="button"
                  className={`activity-log-row${open ? ' is-open' : ''}`}
                  onClick={() => setSelectedId(open ? '' : id)}
                  aria-expanded={open}
                >
                  <div className="activity-log-row__top">
                    <p className="activity-log-row__title">{importKindLabel(job)}</p>
                    <span className={`activity-log-status activity-log-status--${tone}`}>
                      {importStatusLabel(job.status)}
                    </span>
                  </div>
                  <p className="activity-log-row__meta">
                    {job.fileName ? `${job.fileName} · ` : ''}
                    {Number(job.successRows) || 0} saved
                    {Number(job.errorRows) ? ` · ${job.errorRows} need attention` : ''}
                    {job.startedAt || job.finishedAt
                      ? ` · ${formatDateTime(job.finishedAt || job.startedAt)}`
                      : ''}
                  </p>
                </button>
              );
            })}
          {!jobs.length && !result ? (
            <p className="muted activity-log-empty">No uploads yet. Check a file above to get started.</p>
          ) : null}
        </div>

        {selected ? (
          <section className="card activity-log-detail" aria-label="Upload details">
            <div className="activity-log-row__top">
              <span className={`activity-log-status activity-log-status--${
                Number(selected.errorRows) > 0 && Number(selected.successRows) > 0
                  ? 'warn'
                  : Number(selected.errorRows) > 0
                    ? 'bad'
                    : 'ok'
              }`}>
                {importStatusLabel(selected.status)}
              </span>
              <button type="button" className="btn ghost btn-compact" onClick={() => setSelectedId('')}>
                Close
              </button>
            </div>
            <h3>{importKindLabel(selected)}</h3>
            <p className="activity-log-detail__summary">{importOutcomeSummary(selected)}</p>
            <dl className="activity-log-facts">
              <div>
                <dt>Rows in the file</dt>
                <dd>{selected.totalRows ?? 0}</dd>
              </div>
              <div>
                <dt>Ready / saved</dt>
                <dd>{selected.successRows ?? 0}</dd>
              </div>
              <div>
                <dt>Need attention</dt>
                <dd>{selected.errorRows ?? 0}</dd>
              </div>
              {selected.fileName ? (
                <div>
                  <dt>File</dt>
                  <dd>{selected.fileName}</dd>
                </div>
              ) : null}
            </dl>
            {selected.errorReport?.downloadPath ? (
              <p className="muted">
                A spreadsheet of the rows that need attention is waiting in Updates & approvals.
              </p>
            ) : null}
            {!!(selected.rowErrors || selected.errors)?.length && (
              <table className="ops-data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>What to fix</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.rowErrors || selected.errors).slice(0, 50).map((item, i) => (
                    <tr key={i}>
                      <td>{item.row}</td>
                      <td>{item.field}</td>
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function UploadCard({ title, hint, busy, onCheck, onSave }) {
  const [file, setFile] = useState(null);
  return (
    <div className="card ops-upload-card">
      <h3 className="card-title">{title}</h3>
      <p className="muted">{hint}</p>
      <p className="muted">{IMPORT_ACCEPT_HINT}</p>
      <FilePicker
        accept={IMPORT_ACCEPT_ATTR}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <div className="row">
        <button className="btn secondary" type="button" disabled={!file || busy} onClick={() => onCheck(file)}>
          Check file
        </button>
        <button className="btn" type="button" disabled={!file || busy} onClick={() => onSave(file)}>
          Save to Tylo One
        </button>
      </div>
    </div>
  );
}
