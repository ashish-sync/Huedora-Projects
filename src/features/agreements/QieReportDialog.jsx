import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { qieIndicatorGlyph } from './qieIndicators.js';

const HR_ACTIONS = [
  { id: 'approve', label: 'Approve', variant: 'primary' },
  { id: 'hold', label: 'Hold', variant: 'secondary' },
  { id: 'reject', label: 'Reject', variant: 'danger' },
  { id: 'escalate', label: 'Escalate', variant: 'secondary' },
];

const ASSESSMENT_COPY = {
  low_risk: {
    label: 'Low risk',
    summary: 'No significant authenticity concerns were found. Please complete the HR decision.',
  },
  review_required: {
    label: 'Review required',
    summary: 'One or more items need a human check before this certificate can be accepted.',
  },
  high_risk: {
    label: 'High risk',
    summary: 'Multiple serious concerns were found. Treat this document with caution.',
  },
  verified: {
    label: 'Independently verified',
    summary: 'This certificate was confirmed through an authoritative source.',
  },
};

const ACTION_LABELS = {
  manual_verify_ai_watermark: 'Visually check for AI tool watermarks, then decide',
  manual_verify_ai_origin: 'Confirm whether the document was created or edited with an AI tool',
  inspect_highlighted_regions: 'Inspect the highlighted areas on the certificate',
  review_document_edges: 'Check the document edges and margins for cropping or pasting',
  review_edit_history: 'Review whether the file shows signs of image editing',
  validate_verification_url: 'Open and confirm any verification link belongs to the issuer',
  request_higher_quality_scan: 'Ask the applicant for a clearer scan or photo',
  request_higher_resolution: 'Ask the applicant for a higher-resolution copy',
  reupload_document: 'Ask the applicant to re-upload the certificate',
  confirm_file_type: 'Confirm the uploaded file type is correct',
  manual_visual_review: 'Complete a full visual review of the document',
  manual_review: 'Complete a manual review before deciding',
};

const FINDING_TITLES = {
  AI_TOOL_WATERMARK_SPARKLE: 'Possible AI watermark (sparkle mark)',
  AI_TOOL_WATERMARK_TEXT: 'Possible AI tool marker in the file',
  IMAGE_EDITOR_TRACE: 'Possible image-editor trace',
  COMPRESSION_INCONSISTENCY: 'Signs of image editing or compositing',
  MARGIN_BACKGROUND_INCONSISTENCY: 'Uneven margins or background',
  SUSPICIOUS_VERIFICATION_URL: 'Embedded verification link to confirm',
  LOW_RESOLUTION: 'Low-resolution image',
  FILE_TOO_SMALL: 'File appears unusually small',
  FILE_MISSING: 'Stored file could not be analysed',
  UNEXPECTED_EXT: 'Unexpected file type',
  RASTERIZATION_UNAVAILABLE: 'Full visual scan was limited',
  VISUAL_PIPELINE_ERROR: 'Visual inspection partially failed',
  OCR_TEXT_UNAVAILABLE: 'Certificate text could not be read',
  OCR_CORRUPTED_OR_BINARY: 'File content could not be read as text',
  LOW_CONFIDENCE_QUALIFICATION: 'Qualification text is unclear',
  LOW_CONFIDENCE_INSTITUTION: 'Institution text is unclear',
  AWARD_YEAR_FROM_CAPTURE_DATE: 'Award year may be a photo date',
  CANDIDATE_NAME_NOT_EXTRACTED: 'Candidate name could not be read',
  CORE_FIELDS_MISSING: 'Key certificate fields are missing',
};

const IDENTITY_LABELS = {
  matched: { label: 'Matched', tone: 'green' },
  mismatch: { label: 'Mismatch', tone: 'red' },
  inconclusive: { label: 'Needs review', tone: 'amber' },
  extracted_only: { label: 'Extracted only', tone: 'amber' },
};

const AUTH_LABELS = {
  clear: { label: 'No major concerns', tone: 'green' },
  review: { label: 'Review needed', tone: 'amber' },
  concerns: { label: 'Concerns found', tone: 'red' },
};

const AUTHORITATIVE_LABELS = {
  not_checked: { label: 'Not checked', tone: 'amber' },
  verified: { label: 'Verified', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
};

const STATUS_LABELS = {
  queued: 'Queued for analysis',
  processing: 'Analysis in progress',
  hr_review: 'Awaiting HR decision',
  verified: 'Approved',
  rejected: 'Rejected',
  discrepancy: 'Discrepancy flagged',
  held: 'On hold',
  escalated: 'Escalated',
  failed: 'Analysis failed',
};

function humanizeKey(value = '') {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isReadableText(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.length < 2) return false;
  if (/JFIF|Exif|PNG|IHDR|\\x[0-9a-f]{2}/i.test(text)) return false;
  const letters = (text.match(/[A-Za-z0-9]/g) || []).length;
  return letters / text.length >= 0.55;
}

function displayValue(value, fallback = 'Not available') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (!isReadableText(text)) return 'Could not read clearly';
  return text;
}

function Field({ label, value }) {
  return (
    <div className="qie-report-field">
      <span className="qie-report-field__label">{label}</span>
      <span className="qie-report-field__value">{value || 'Not available'}</span>
    </div>
  );
}

function StatusPill({ tone = 'neutral', children }) {
  return <span className={`qie-status-pill qie-status-pill--${tone}`}>{children}</span>;
}

function outcomeTone(assessmentKey) {
  if (assessmentKey === 'low_risk' || assessmentKey === 'verified') return 'green';
  if (assessmentKey === 'high_risk') return 'red';
  if (assessmentKey === 'review_required') return 'amber';
  return 'neutral';
}

function findingTitle(finding) {
  if (FINDING_TITLES[finding.code]) {
    if (finding.code === 'AI_TOOL_WATERMARK_TEXT' && finding.evidence?.toolLabel) {
      return `Possible ${finding.evidence.toolLabel} marker detected`;
    }
    return FINDING_TITLES[finding.code];
  }
  return finding.message || humanizeKey(finding.code) || 'Review item';
}

function findingExplanation(finding) {
  if (finding.code === 'AI_TOOL_WATERMARK_SPARKLE') {
    return 'A faint multi-point mark was found near the bottom-right corner. This can resemble an AI-tool watermark and should be checked by eye.';
  }
  if (finding.code === 'AI_TOOL_WATERMARK_TEXT') {
    const tool = finding.evidence?.toolLabel || 'an AI tool';
    return `The file may contain markers associated with ${tool}. This is a warning for review, not proof of fraud on its own.`;
  }
  if (finding.code === 'OCR_TEXT_UNAVAILABLE' || finding.code === 'OCR_CORRUPTED_OR_BINARY') {
    return 'QIE could not read reliable certificate text from this file. Please verify the details visually before deciding.';
  }
  if (finding.code === 'CANDIDATE_NAME_NOT_EXTRACTED') {
    return 'The candidate name was not clearly readable, so identity matching could not be confirmed automatically.';
  }
  if (finding.code === 'CORE_FIELDS_MISSING') {
    return 'Key fields such as qualification, institution or certificate number were not found with enough confidence.';
  }
  if (finding.code === 'AWARD_YEAR_FROM_CAPTURE_DATE') {
    return 'A year found in the filename looks like a photo/capture date, not a trusted award year.';
  }
  if (finding.message && !/[_|]{2,}|tylo-qie|bbox/i.test(finding.message)) {
    return finding.message;
  }
  return 'Please review this item before accepting the certificate.';
}

function actionLabel(code) {
  return ACTION_LABELS[code] || (code ? humanizeKey(code) : 'Complete a manual review');
}

function severityLabel(severity) {
  const s = String(severity || 'medium').toLowerCase();
  if (s === 'high') return 'Important';
  if (s === 'low') return 'Minor';
  return 'Needs attention';
}

function severityTone(severity) {
  const s = String(severity || 'medium').toLowerCase();
  if (s === 'high') return 'red';
  if (s === 'low') return 'neutral';
  return 'amber';
}

function hrDecisionCopy(report) {
  const action = String(report?.hrDecision?.action || '').toLowerCase();
  const status = String(report?.status || '').toLowerCase();
  if (action === 'approve' || status === 'verified') {
    return { label: 'Approved', tone: 'green', detail: 'HR has accepted this certificate.' };
  }
  if (action === 'reject' || status === 'rejected') {
    return { label: 'Rejected', tone: 'red', detail: 'HR has rejected this certificate.' };
  }
  if (action === 'hold' || status === 'held') {
    return { label: 'On hold', tone: 'amber', detail: 'HR has placed this review on hold.' };
  }
  if (action === 'escalate' || status === 'escalated') {
    return { label: 'Escalated', tone: 'amber', detail: 'This case was escalated for further review.' };
  }
  if (status === 'discrepancy') {
    return { label: 'Discrepancy', tone: 'red', detail: 'A discrepancy was flagged for HR attention.' };
  }
  if (['queued', 'processing'].includes(status)) {
    return { label: 'Pending analysis', tone: 'amber', detail: 'Automated checks are still running.' };
  }
  return { label: 'Decision pending', tone: 'amber', detail: 'Waiting for an authorised HR decision.' };
}

function RegionPreview({ regions = [] }) {
  if (!regions.length) return null;
  return (
    <div className="qie-region-preview" aria-label="Flagged regions on the document">
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
        Highlighted areas show where QIE noticed something worth checking.
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
  const [techOpen, setTechOpen] = useState(false);

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
      setTechOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const indicator = report?.indicator || 'amber';
  const credentialPassed = Boolean(report?.credentialVerification?.passed);
  const history = Array.isArray(report?.history) ? [...report.history].reverse() : [];
  const assessmentKey = String(report?.risk?.assessmentOutcome || '').toLowerCase();
  const assessment = ASSESSMENT_COPY[assessmentKey] || {
    label: assessmentKey ? humanizeKey(assessmentKey) : 'Assessment pending',
    summary: 'Automated checks finished. Please review the details below.',
  };
  const findings = Array.isArray(report?.forensic?.findings) ? report.forensic.findings : [];
  const previewRegions = Array.isArray(report?.forensic?.previewRegions)
    ? report.forensic.previewRegions
    : findings.filter((f) => f.location?.bboxNorm).map((f) => ({
      code: f.code,
      severity: f.severity,
      bboxNorm: f.location.bboxNorm,
      label: f.message,
    }));
  const hrDecision = hrDecisionCopy(report);
  const workflowLabel = STATUS_LABELS[String(report?.status || '').toLowerCase()]
    || humanizeKey(report?.status)
    || 'In progress';
  const authenticityScore = report?.forensic?.authenticityScore ?? report?.risk?.authenticityScore;
  const ocrScore = report?.ocr?.accuracyScore ?? report?.risk?.ocrAccuracyScore;
  const identityCheck = report?.credentialVerification?.identityCheck || {};
  const documentAuthenticity = report?.credentialVerification?.documentAuthenticity || {};
  const authoritativeVerification = report?.credentialVerification?.authoritativeVerification || {};
  const extractionQuality = report?.credentialVerification?.extractionQuality
    || report?.extracted?.extractionQuality
    || {};
  const identityMeta = IDENTITY_LABELS[identityCheck.status]
    || IDENTITY_LABELS[report?.credentialVerification?.nameMatch === true
      ? 'matched'
      : report?.credentialVerification?.nameMatch === false
        ? 'inconclusive'
        : 'inconclusive'];
  const authMeta = AUTH_LABELS[documentAuthenticity.status]
    || (report?.forensic?.aiWatermarkOnly ? AUTH_LABELS.review : AUTH_LABELS.clear);
  const authoritativeMeta = AUTHORITATIVE_LABELS[authoritativeVerification.status] || AUTHORITATIVE_LABELS.not_checked;
  const fileName = displayValue(
    report?.extracted?.sourceFileName || report?.originalName,
    'Certificate file',
  );
  const hrFacingFindings = findings.filter((f) => f.category === 'extraction'
    || f.code?.startsWith('AI_TOOL_WATERMARK')
    || ['COMPRESSION_INCONSISTENCY', 'MARGIN_BACKGROUND_INCONSISTENCY', 'LOW_RESOLUTION', 'FILE_TOO_SMALL', 'FILE_MISSING'].includes(f.code)
    || f.severity === 'high'
    || f.severity === 'medium');

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
            <p className="qie-report-kicker">Quality &amp; Intelligence Engine</p>
            <h3 id="qie-report-title" className="qie-report-title">Educational Certificate Review</h3>
          </div>
          <button type="button" className="cd-drawer-close-btn" onClick={onClose} aria-label="Close report">
            ×
          </button>
        </div>

        <div className="qie-report-scroll">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
          {busy === 'load' && !report ? <p className="muted">Loading review…</p> : null}

          {report ? (
            <>
              <section className={`qie-outcome qie-outcome--${outcomeTone(assessmentKey) || indicator}`}>
                <div className="qie-outcome__icon" aria-hidden="true">
                  {qieIndicatorGlyph(indicator)}
                </div>
                <div className="qie-outcome__body">
                  <p className="qie-outcome__eyebrow">{workflowLabel}</p>
                  <h4 className="qie-outcome__title">{assessment.label}</h4>
                  <p className="qie-outcome__summary">{assessment.summary}</p>
                </div>
              </section>

              <section className="qie-report-section">
                <h4>Verification status</h4>
                <div className="qie-status-grid">
                  <article className="qie-status-card">
                    <div className="qie-status-card__head">
                      <span className="qie-status-card__title">Identity matching</span>
                      <StatusPill tone={identityMeta.tone}>{identityMeta.label}</StatusPill>
                    </div>
                    <p className="qie-status-card__text">
                      {identityCheck.details
                        || 'Identity is checked only against the name read from the certificate.'}
                    </p>
                    <p className="qie-status-card__meta">
                      Expected: {displayValue(identityCheck.expectedHolderName || report.credentialVerification?.expectedHolderName, 'Not provided')}
                      {' · '}
                      From document: {displayValue(identityCheck.extractedHolderName || report.extracted?.holderName)}
                    </p>
                  </article>

                  <article className="qie-status-card">
                    <div className="qie-status-card__head">
                      <span className="qie-status-card__title">Document authenticity</span>
                      <StatusPill tone={authMeta.tone}>{authMeta.label}</StatusPill>
                    </div>
                    <p className="qie-status-card__text">
                      {documentAuthenticity.details
                        || (report.forensic?.aiWatermarkOnly
                          ? 'Possible AI-related markers were found. This requires manual verification and is not automatic fraud.'
                          : 'Forensic signals are evidence for review only and do not alone prove authenticity or fraud.')}
                    </p>
                    <p className="qie-status-card__meta">
                      Forensic score:{' '}
                      {authenticityScore != null ? `${authenticityScore}/100` : 'Not available'}
                      {' · '}
                      Extraction: {extractionQuality.status || 'unknown'}
                    </p>
                  </article>

                  <article className="qie-status-card">
                    <div className="qie-status-card__head">
                      <span className="qie-status-card__title">Authoritative credential check</span>
                      <StatusPill tone={authoritativeMeta.tone}>{authoritativeMeta.label}</StatusPill>
                    </div>
                    <p className="qie-status-card__text">
                      {authoritativeVerification.details
                        || 'Issuer/registry confirmation is separate from OCR and forensic scanning.'}
                    </p>
                    <p className="qie-status-card__meta">
                      Overall credential gate: {credentialPassed ? 'Ready for HR approve path' : 'Not passed — manual review required'}
                    </p>
                  </article>

                  <article className="qie-status-card">
                    <div className="qie-status-card__head">
                      <span className="qie-status-card__title">HR decision</span>
                      <StatusPill tone={hrDecision.tone}>{hrDecision.label}</StatusPill>
                    </div>
                    <p className="qie-status-card__text">{hrDecision.detail}</p>
                    <p className="qie-status-card__meta">
                      {report.hrDecision?.notes
                        ? `Notes: ${report.hrDecision.notes}`
                        : 'No decision notes recorded yet.'}
                    </p>
                  </article>
                </div>
              </section>

              <section className="qie-report-section">
                <h4>Certificate details</h4>
                <div className="qie-report-grid">
                  <Field label="File" value={fileName} />
                  <Field label="Candidate name" value={displayValue(report.extracted?.holderName)} />
                  <Field label="Institution" value={displayValue(report.extracted?.institution)} />
                  <Field label="Qualification" value={displayValue(report.extracted?.qualification)} />
                  <Field label="Programme" value={displayValue(report.extracted?.programme)} />
                  <Field label="Award year" value={displayValue(report.extracted?.awardYear)} />
                  <Field label="Certificate no." value={displayValue(report.extracted?.referenceNo)} />
                  <Field
                    label="Document type"
                    value={
                      report.extracted?.classification === 'educational_certificate'
                        ? 'Educational certificate'
                        : displayValue(humanizeKey(report.extracted?.classification))
                    }
                  />
                </div>
              </section>

              <section className="qie-report-section">
                <h4>Why this needs attention</h4>
                {hrFacingFindings.length ? (
                  <ul className="qie-flag-list">
                    {hrFacingFindings.map((finding, idx) => (
                      <li key={`${finding.code}-${idx}`} className={`qie-flag-card qie-flag-card--${severityTone(finding.severity)}`}>
                        <div className="qie-flag-card__head">
                          <strong>{findingTitle(finding)}</strong>
                          <StatusPill tone={severityTone(finding.severity)}>
                            {severityLabel(finding.severity)}
                          </StatusPill>
                        </div>
                        <p className="qie-flag-card__text">{findingExplanation(finding)}</p>
                        <p className="qie-flag-card__action">
                          Recommended: {actionLabel(finding.recommendedAction)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="qie-empty-note">No authenticity flags were raised for this document.</p>
                )}
                <RegionPreview regions={previewRegions} />
              </section>

              <section className="qie-report-section">
                <button
                  type="button"
                  className="qie-tech-toggle"
                  aria-expanded={techOpen}
                  onClick={() => setTechOpen((openState) => !openState)}
                >
                  <span>Technical details</span>
                  <span aria-hidden="true">{techOpen ? '−' : '+'}</span>
                </button>
                {techOpen ? (
                  <div className="qie-tech-panel">
                    <p className="muted qie-tech-intro">
                      Internal diagnostics for support and audit. Not required for most HR decisions.
                    </p>

                    <h5 className="qie-tech-heading">Record identifiers</h5>
                    <div className="qie-report-grid">
                      <Field label="Document One ID" value={report.documentId || '—'} />
                      <Field label="HCW ID" value={report.hcwId || '—'} />
                      <Field label="Contact ID" value={report.contactId || '—'} />
                      <Field label="Employee ID" value={report.employeeId || '—'} />
                      <Field label="Verification ID" value={report._id || verificationId || '—'} />
                      <Field label="Workflow status" value={report.status || '—'} />
                    </div>

                    <h5 className="qie-tech-heading">OCR &amp; extraction</h5>
                    <div className="qie-report-grid">
                      <Field label="OCR accuracy" value={ocrScore != null ? String(ocrScore) : '—'} />
                      <Field label="OCR engine" value={report.ocr?.engine || '—'} />
                      <Field label="Verification URL" value={report.extracted?.verificationUrl || '—'} />
                      <Field label="Classification code" value={report.extracted?.classification || '—'} />
                    </div>
                    {report.extracted?.rawTextSnippet ? (
                      <pre className="qie-report-snippet">{report.extracted.rawTextSnippet}</pre>
                    ) : null}

                    <h5 className="qie-tech-heading">Forensic diagnostics</h5>
                    <div className="qie-report-grid">
                      <Field
                        label="Authenticity score"
                        value={authenticityScore != null ? String(authenticityScore) : '—'}
                      />
                      <Field label="Clean scan" value={report.forensic?.cleanScan ? 'Yes' : 'No'} />
                      <Field label="Forensic engine" value={report.forensic?.engine || '—'} />
                      <Field
                        label="AI watermark only"
                        value={report.forensic?.aiWatermarkOnly ? 'Yes' : 'No'}
                      />
                      <Field
                        label="Risk score"
                        value={report.risk?.score != null ? String(report.risk.score) : '—'}
                      />
                      <Field label="Risk level" value={report.risk?.level || '—'} />
                    </div>
                    <ul className="qie-report-list">
                      {findings.length
                        ? findings.map((finding, idx) => (
                            <li key={`tech-${finding.code}-${idx}`}>
                              <strong>{finding.code}</strong>
                              {finding.confidence != null
                                ? ` · confidence ${(Number(finding.confidence) * 100).toFixed(0)}%`
                                : ''}
                              <div className="muted">
                                {finding.location?.region || 'document'}
                                {finding.recommendedAction ? ` · ${finding.recommendedAction}` : ''}
                              </div>
                            </li>
                          ))
                        : <li>No forensic finding codes</li>}
                    </ul>
                    {(report.risk?.factors || []).length ? (
                      <ul className="qie-report-list">
                        {report.risk.factors.map((factor) => (
                          <li key={factor}>{factor}</li>
                        ))}
                      </ul>
                    ) : null}

                    <h5 className="qie-tech-heading">Credential diagnostics</h5>
                    <div className="qie-report-grid">
                      <Field label="Method" value={report.credentialVerification?.method || '—'} />
                      <Field
                        label="Authoritative source"
                        value={report.credentialVerification?.authoritativeVerified ? 'Yes' : 'No'}
                      />
                    </div>
                    <p className="muted">{report.credentialVerification?.details || ''}</p>

                    <h5 className="qie-tech-heading">Audit history</h5>
                    <ul className="qie-report-history">
                      {history.length ? history.map((entry, idx) => (
                        <li key={`${entry.at}-${entry.action}-${idx}`}>
                          <strong>{entry.action}</strong>
                          <span className="muted">
                            {entry.at ? ` · ${new Date(entry.at).toLocaleString()}` : ''}
                            {entry.actorEmail ? ` · ${entry.actorEmail}` : ''}
                            {entry.from || entry.to ? ` · ${entry.from || '—'} → ${entry.to || '—'}` : ''}
                          </span>
                          {entry.meta?.assessmentOutcome ? (
                            <div className="muted">Assessment: {entry.meta.assessmentOutcome}</div>
                          ) : null}
                        </li>
                      )) : <li className="muted">No history yet</li>}
                    </ul>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>

        <div className="qie-report-footer">
          {canReview ? (
            <>
              <div className="field qie-report-notes">
                <label htmlFor="qie-hr-notes">Decision notes</label>
                <input
                  id="qie-hr-notes"
                  className="field-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for the audit trail"
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
                        ? 'Identity verification must pass before approve'
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
