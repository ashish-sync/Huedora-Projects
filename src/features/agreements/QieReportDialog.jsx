import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { qieIndicatorGlyph, qieIndicatorLabel } from './qieIndicators.js';

const HR_ACTIONS = [
  { id: 'approve', label: 'Approve', variant: 'primary' },
  { id: 'hold', label: 'Hold', variant: 'secondary' },
  { id: 'reject', label: 'Reject', variant: 'danger' },
  { id: 'escalate', label: 'Escalate', variant: 'secondary' },
];

function Field({ label, value }) {
  return (
    <div className="qie-report-field">
      <span className="qie-report-field__label">{label}</span>
      <span className="qie-report-field__value">{value || '—'}</span>
    </div>
  );
}

export default function QieReportDialog({
  verificationId = '',
  open = false,
  canReview = false,
  onClose,
  onUpdated,
}) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!verificationId) return;
    setBusy('load');
    setError('');
    try {
      const res = await api(`/qie/verifications/${verificationId}`);
      setReport(res.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load QIE report');
      setReport(null);
    } finally {
      setBusy('');
    }
  }, [verificationId]);

  useEffect(() => {
    if (!open || !verificationId) return undefined;
    load();
    return undefined;
  }, [open, verificationId, load]);

  useEffect(() => {
    if (!open || !verificationId) return undefined;
    const indicator = String(report?.indicator || '');
    const status = String(report?.status || '');
    const shouldPoll = indicator === 'amber'
      || ['queued', 'processing', 'hr_review', 'held', 'escalated'].includes(status);
    if (!shouldPoll) return undefined;
    const timer = setInterval(() => {
      load();
    }, 4000);
    return () => clearInterval(timer);
  }, [open, verificationId, report?.indicator, report?.status, load]);

  useEffect(() => {
    if (!open) {
      setReport(null);
      setNotes('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const indicator = report?.indicator || 'amber';
  const credentialPassed = Boolean(report?.credentialVerification?.passed);
  const history = Array.isArray(report?.history) ? [...report.history].reverse() : [];

  async function runReanalyze() {
    setBusy('reanalyze');
    setError('');
    try {
      const res = await api(`/qie/verifications/${verificationId}/reanalyze`, { method: 'POST', body: {} });
      setReport(res.data || null);
      onUpdated?.(res.data);
    } catch (err) {
      setError(err.message || 'Reanalysis failed');
    } finally {
      setBusy('');
    }
  }

  async function runHr(action) {
    setBusy(action);
    setError('');
    try {
      const res = await api(`/qie/verifications/${verificationId}/hr-decision`, {
        method: 'POST',
        body: { action, notes },
      });
      setReport(res.data || null);
      onUpdated?.(res.data);
    } catch (err) {
      setError(err.message || 'HR decision failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="qie-report-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="qie-report-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qie-report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qie-report-header">
          <div>
            <p className="qie-report-kicker">QIE · Post-Upload Verification</p>
            <h3 id="qie-report-title" className="qie-report-title">Educational Certificate Report</h3>
          </div>
          <button type="button" className="cd-drawer-close-btn" onClick={onClose} aria-label="Close report">
            ×
          </button>
        </div>

        <div className="qie-report-scroll">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
          {busy === 'load' && !report ? <p className="muted">Loading report…</p> : null}

          {report ? (
            <>
              <div className={`qie-report-status qie-report-status--${indicator}`}>
                <span className="qie-indicator__glyph" aria-hidden="true">
                  {qieIndicatorGlyph(indicator)}
                </span>
                <div>
                  <strong>{qieIndicatorLabel(indicator)}</strong>
                  <p className="muted">
                    Status: {report.status || '—'} · Phase: {report.phase || '—'}
                  </p>
                </div>
              </div>

              <section className="qie-report-section">
                <h4>Identifiers</h4>
                <div className="qie-report-grid">
                  <Field label="Document One ID" value={report.documentId} />
                  <Field label="HCW ID" value={report.hcwId} />
                  <Field label="Contact ID" value={report.contactId} />
                  <Field label="Employee ID" value={report.employeeId || '—'} />
                </div>
              </section>

              <section className="qie-report-section">
                <h4>Extracted details</h4>
                <div className="qie-report-grid">
                  <Field label="Institution" value={report.extracted?.institution} />
                  <Field label="Qualification" value={report.extracted?.qualification} />
                  <Field label="Award year" value={report.extracted?.awardYear} />
                  <Field label="Reference" value={report.extracted?.referenceNo} />
                  <Field label="Classification" value={report.extracted?.classification} />
                </div>
                {report.extracted?.rawTextSnippet ? (
                  <p className="qie-report-snippet">{report.extracted.rawTextSnippet}</p>
                ) : null}
              </section>

              <section className="qie-report-section">
                <h4>Forensic findings</h4>
                <p className="muted">
                  Clean AI scan: {report.forensic?.cleanScan ? 'Yes' : 'No'} (never sufficient for a green tick alone)
                </p>
                <ul className="qie-report-list">
                  {(report.forensic?.findings || []).length
                    ? report.forensic.findings.map((f) => (
                        <li key={`${f.code}-${f.message}`}>
                          <strong>{f.code}</strong> · {f.message}
                        </li>
                      ))
                    : <li>No forensic anomalies recorded</li>}
                </ul>
              </section>

              <section className="qie-report-section">
                <h4>Credential verification</h4>
                <div className="qie-report-grid">
                  <Field label="Passed" value={credentialPassed ? 'Yes' : 'No'} />
                  <Field label="Name match" value={
                    report.credentialVerification?.nameMatch == null
                      ? '—'
                      : report.credentialVerification.nameMatch ? 'Yes' : 'No'
                  }
                  />
                  <Field label="Method" value={report.credentialVerification?.method} />
                </div>
                <p className="muted">{report.credentialVerification?.details}</p>
              </section>

              <section className="qie-report-section">
                <h4>Risk assessment</h4>
                <div className="qie-report-grid">
                  <Field label="Score" value={report.risk?.score != null ? String(report.risk.score) : '—'} />
                  <Field label="Level" value={report.risk?.level} />
                </div>
                <ul className="qie-report-list">
                  {(report.risk?.factors || []).map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </section>

              <section className="qie-report-section">
                <h4>Audit history</h4>
                <ul className="qie-report-history">
                  {history.length ? history.map((entry, idx) => (
                    <li key={`${entry.at}-${entry.action}-${idx}`}>
                      <strong>{entry.action}</strong>
                      <span className="muted">
                        {entry.at ? new Date(entry.at).toLocaleString() : ''}
                        {entry.actorEmail ? ` · ${entry.actorEmail}` : ''}
                        {entry.from || entry.to ? ` · ${entry.from || '—'} → ${entry.to || '—'}` : ''}
                      </span>
                    </li>
                  )) : <li className="muted">No history yet</li>}
                </ul>
              </section>
            </>
          ) : null}
        </div>

        <div className="qie-report-footer">
          {canReview ? (
            <>
              <div className="field qie-report-notes">
                <label htmlFor="qie-hr-notes">HR notes</label>
                <input
                  id="qie-hr-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional decision notes"
                  disabled={Boolean(busy)}
                />
              </div>
              <div className="qie-report-actions">
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={Boolean(busy)}
                  onClick={runReanalyze}
                >
                  {busy === 'reanalyze' ? 'Reanalyzing…' : 'Reanalyze'}
                </button>
                {HR_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`btn btn-compact${action.variant === 'secondary' ? ' secondary' : ''}${action.variant === 'danger' ? ' danger' : ''}`}
                    disabled={Boolean(busy) || (action.id === 'approve' && report && !credentialPassed)}
                    title={
                      action.id === 'approve' && report && !credentialPassed
                        ? 'Credential verification must pass before approve'
                        : undefined
                    }
                    onClick={() => runHr(action.id)}
                  >
                    {busy === action.id ? 'Saving…' : action.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="btn secondary btn-compact" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
