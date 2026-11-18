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

const ASSESSMENT_LABELS = {
  low_risk: 'Low Risk',
  review_required: 'Review Required',
  high_risk: 'High Risk',
  verified: 'Verified',
};

function Field({ label, value }) {
  return (
    <div className="qie-report-field">
      <span className="qie-report-field__label">{label}</span>
      <span className="qie-report-field__value">{value || '—'}</span>
    </div>
  );
}

function severityClass(severity) {
  const s = String(severity || '').toLowerCase();
  if (s === 'high') return 'qie-finding--high';
  if (s === 'medium') return 'qie-finding--medium';
  return 'qie-finding--low';
}

function RegionPreview({ regions = [] }) {
  if (!regions.length) return null;
  return (
    <div className="qie-region-preview" aria-label="Suspicious region highlights">
      <div className="qie-region-preview__canvas">
        {regions.map((region, idx) => {
          const box = region.bboxNorm || {};
          return (
            <span
              key={`${region.code}-${idx}`}
              className={`qie-region-preview__box qie-region-preview__box--${region.severity || 'medium'}`}
              style={{
                left: `${(box.x || 0) * 100}%`,
                top: `${(box.y || 0) * 100}%`,
                width: `${(box.w || 0.08) * 100}%`,
                height: `${(box.h || 0.08) * 100}%`,
              }}
              title={region.label || region.code}
            />
          );
        })}
      </div>
      <p className="muted qie-region-preview__hint">
        Highlighted regions show where QIE flagged visual or layout anomalies (normalized page coordinates).
      </p>
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
  const assessmentKey = String(report?.risk?.assessmentOutcome || '').toLowerCase();
  const assessmentLabel = ASSESSMENT_LABELS[assessmentKey] || (assessmentKey ? assessmentKey : '—');
  const findings = Array.isArray(report?.forensic?.findings) ? report.forensic.findings : [];
  const previewRegions = Array.isArray(report?.forensic?.previewRegions)
    ? report.forensic.previewRegions
    : findings.filter((f) => f.location?.bboxNorm).map((f) => ({
      code: f.code,
      severity: f.severity,
      bboxNorm: f.location.bboxNorm,
      label: f.message,
    }));

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
            <p className="qie-report-kicker">QIE · Authenticity &amp; Forensic Assessment</p>
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
                  <p className={`qie-assessment qie-assessment--${assessmentKey || 'unknown'}`}>
                    Assessment: {assessmentLabel}
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
                <h4>OCR results</h4>
                <div className="qie-report-grid">
                  <Field
                    label="OCR accuracy"
                    value={
                      report.ocr?.accuracyScore != null
                        ? String(report.ocr.accuracyScore)
                        : report.risk?.ocrAccuracyScore != null
                          ? String(report.risk.ocrAccuracyScore)
                          : '—'
                    }
                  />
                  <Field label="OCR engine" value={report.ocr?.engine || '—'} />
                  <Field label="Institution" value={report.extracted?.institution} />
                  <Field label="Qualification" value={report.extracted?.qualification} />
                  <Field label="Award year" value={report.extracted?.awardYear} />
                  <Field label="Reference" value={report.extracted?.referenceNo} />
                  <Field label="Classification" value={report.extracted?.classification} />
                  <Field label="Verification URL" value={report.extracted?.verificationUrl} />
                </div>
                {report.extracted?.rawTextSnippet ? (
                  <p className="qie-report-snippet">{report.extracted.rawTextSnippet}</p>
                ) : null}
              </section>

              <section className="qie-report-section">
                <h4>Forensic authenticity</h4>
                <div className="qie-report-grid">
                  <Field
                    label="Authenticity score"
                    value={
                      report.forensic?.authenticityScore != null
                        ? String(report.forensic.authenticityScore)
                        : report.risk?.authenticityScore != null
                          ? String(report.risk.authenticityScore)
                          : '—'
                    }
                  />
                  <Field label="Clean scan" value={report.forensic?.cleanScan ? 'Yes' : 'No'} />
                  <Field label="Engine" value={report.forensic?.engine || '—'} />
                  <Field
                    label="AI watermark only"
                    value={report.forensic?.aiWatermarkOnly ? 'Yes — review required, not automatic fraud' : 'No'}
                  />
                </div>
                <p className="muted">
                  Clean AI/forensic scan alone never grants a green tick. AI watermarks require manual verification and are not sole grounds for fraud.
                </p>
                <RegionPreview regions={previewRegions} />
                <ul className="qie-report-list">
                  {findings.length
                    ? findings.map((f, idx) => (
                        <li key={`${f.code}-${idx}`} className={severityClass(f.severity)}>
                          <strong>{f.code}</strong>
                          {' · '}
                          <span className="qie-finding-severity">{f.severity || 'medium'}</span>
                          {f.confidence != null ? ` · conf ${(Number(f.confidence) * 100).toFixed(0)}%` : ''}
                          <div>{f.message}</div>
                          <div className="muted">
                            Location: {f.location?.region || 'document'}
                            {f.recommendedAction ? ` · Action: ${f.recommendedAction}` : ''}
                          </div>
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
                  <Field
                    label="Authoritative"
                    value={report.credentialVerification?.authoritativeVerified ? 'Yes' : 'No'}
                  />
                </div>
                <p className="muted">{report.credentialVerification?.details}</p>
              </section>

              <section className="qie-report-section">
                <h4>Risk assessment</h4>
                <div className="qie-report-grid">
                  <Field label="Outcome" value={assessmentLabel} />
                  <Field label="Risk score" value={report.risk?.score != null ? String(report.risk.score) : '—'} />
                  <Field label="Level" value={report.risk?.level} />
                  <Field
                    label="OCR vs authenticity"
                    value={
                      report.risk?.ocrAccuracyScore != null && report.risk?.authenticityScore != null
                        ? `${report.risk.ocrAccuracyScore} / ${report.risk.authenticityScore}`
                        : '—'
                    }
                  />
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
                      {entry.meta?.assessmentOutcome ? (
                        <div className="muted">Assessment: {entry.meta.assessmentOutcome}</div>
                      ) : null}
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
