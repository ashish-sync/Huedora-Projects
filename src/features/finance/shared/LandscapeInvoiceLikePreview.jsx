import {
  amountInWordsIndian,
  computeInvoiceTotals,
  formatDisplayDate,
  formatInr,
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveLineGstRates,
  resolveTaxMode,
} from '../invoiceGenerator/invoiceCalculations.js';
import { InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import { defaultLineItem, MAX_INVOICE_LINE_ITEMS } from '../invoiceGenerator/invoiceStorage.js';
import '../invoiceGenerator/tylo-invoice-template.css';
import { LANDSCAPE_DOC_CONFIGS } from './landscapeDocConfigs.js';

const CREDIT_REASONS = [
  'Rate Revision / Cancellation / Service Adjustment',
  'Rate Revision',
  'Cancellation',
  'Service Adjustment',
];

const DEBIT_REASONS = [
  'Additional Service / Underbilling / Rate Revision / Tax Adjustment',
  'Additional Service',
  'Underbilling',
  'Rate Revision',
  'Tax Adjustment',
];

function money(n) {
  return formatInr(n);
}

function stateLine(party) {
  return [party?.stateName, party?.stateCode].filter(Boolean).join(' / ') || party?.stateCode || '';
}

function Field({
  label,
  value,
  onChange,
  editable,
  placeholder = '—',
  type = 'text',
  full = false,
  area = false,
  mono = false,
}) {
  return (
    <div className={`ti-field${full ? ' ti-field--full' : ''}`}>
      <span className="ti-field-label">{label}</span>
      <div className="ti-field-value">
        {editable ? (
          area ? (
            <InlineTextarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={2} />
          ) : (
            <InlineField type={type} value={value || ''} onChange={onChange} placeholder={placeholder} mono={mono} />
          )
        ) : type === 'date' ? (
          formatDisplayDate(value) || placeholder
        ) : (
          value || placeholder
        )}
      </div>
    </div>
  );
}

function MetaCell({ label, children }) {
  return (
    <div className="ti-meta-cell">
      <span className="ti-meta-label">{label}</span>
      <div className="ti-meta-value">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="ti-totals-row">
      <span className="ti-totals-row__label">{label}</span>
      <span className="ti-totals-row__value">{value}</span>
      <span className="ti-totals-row__gst" aria-hidden="true" />
    </div>
  );
}

function SummaryRows({ totals, isNil, taxMode, showAdjustments, adj, money }) {
  const cgst = isNil || taxMode !== 'cgst_sgst' ? 0 : totals.totalCgstAmount;
  const sgst = isNil || taxMode !== 'cgst_sgst' ? 0 : totals.totalSgstAmount;
  const igst = isNil || taxMode !== 'igst' ? 0 : totals.totalIgstAmount;

  return (
    <>
      <SummaryRow label="Taxable Value" value={money(totals.subtotal)} />
      <SummaryRow label="CGST" value={money(cgst)} />
      <SummaryRow label="SGST" value={money(sgst)} />
      <SummaryRow label="IGST" value={money(igst)} />
      {showAdjustments && Number(adj.cnAmount) ? (
        <SummaryRow label="Less: Credit Note" value={money(adj.cnAmount)} />
      ) : null}
      {showAdjustments && Number(adj.dnAmount) ? (
        <SummaryRow label="Add: Debit Note" value={money(adj.dnAmount)} />
      ) : null}
      {showAdjustments && Number(adj.advanceReceived) ? (
        <SummaryRow label="Less: Advance" value={money(adj.advanceReceived)} />
      ) : null}
      <SummaryRow label="Round Off" value={money(totals.roundOff)} />
    </>
  );
}

/** Amount In Words (Bank width) | Totals card Taxable→TOTAL (Ship To layout / Payment width) */
function WordsAndTotalsBlock({
  totals,
  isNil,
  taxMode,
  showAdjustments,
  adj,
  totalLabel,
  amountWords,
  money,
}) {
  return (
    <div className="ti-words-total">
      <div className="ti-words-total__left">
        <div className="ti-words-total__words">
          <strong>Amount In Words:</strong> Rupees {amountWords || '____________________ Only.'}
        </div>
      </div>

      <div className="ti-card ti-card--totals">
        <div className="ti-card-body ti-card-body--totals">
          <SummaryRows
            totals={totals}
            isNil={isNil}
            taxMode={taxMode}
            showAdjustments={showAdjustments}
            adj={adj}
            money={money}
          />
        </div>
        <div className="ti-totals-grand">
          <span className="ti-totals-grand__label">{totalLabel}</span>
          <span className="ti-totals-grand__value">{money(totals.grandTotal)}</span>
          <span className="ti-totals-grand__gst" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default function LandscapeInvoiceLikePreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
  onUpdateTerm,
  onAddTerm,
  config = {},
}) {
  const cfg = {
    ...(LANDSCAPE_DOC_CONFIGS[config.docKey] || LANDSCAPE_DOC_CONFIGS.invoice),
    ...config,
  };

  const {
    docKey,
    documentTitle,
    docNoLabel,
    dateLabel,
    dueLabel,
    totalLabel,
    gstMode,
    leftPartyTitle,
    rightPartyTitle,
    billNameLabel,
    shipNameLabel,
    shipGstinLabel,
    paymentTermsTitle,
    bankNote,
    defaultTerms,
    defaultDeclaration,
    showPoMeta,
    showPlaceOfSupply,
    showReverseCharge,
    showOriginalInvoice,
    originalRefField,
    reasonField,
    reasonLabel,
    showAdjustments,
    showTermsEditor,
  } = cfg;

  const isNil = gstMode === 'nil';
  const isCreditDoc = docKey === 'credit-note';
  const REASONS = isCreditDoc ? CREDIT_REASONS : DEBIT_REASONS;

  const { company, bank, billTo, shipTo, invoice, signature } = form || {};
  // Seller (company) vs customer billing (billTo) state → IGST or CGST+SGST
  const taxMode = resolveTaxMode(billTo?.stateCode, company?.stateCode);

  const rawLines = form?.lineItems?.length
    ? form.lineItems
    : [
        defaultLineItem(
          isNil
            ? { description: 'Healthcare Camp / Activation Services', igstRate: 0, cgstRate: 0, sgstRate: 0 }
            : { description: 'Healthcare Camp / Activation Services', igstRate: 18, cgstRate: 9, sgstRate: 9 }
        ),
      ];
  const effectiveLines = isNil
    ? rawLines.map((line) => ({ ...line, igstRate: 0, cgstRate: 0, sgstRate: 0 }))
    : rawLines.map((line) => ({ ...line, ...resolveLineGstRates(line, taxMode) }));

  const adj = form?.adjustments || {};
  const totals = computeInvoiceTotals(effectiveLines, taxMode, {
    cnAmount: showAdjustments ? adj.cnAmount || 0 : 0,
    dnAmount: showAdjustments ? adj.dnAmount || 0 : 0,
    advanceReceived: showAdjustments ? adj.advanceReceived || 0 : 0,
  });

  const legal = company?.legalName || 'Tylo Care Private Limited';
  const hasLogo = Boolean(company?.logoDataUrl);
  const words = amountInWordsIndian(totals.grandTotal);
  const realTerms = Array.isArray(form?.terms) && form.terms.length ? form.terms : [defaultTerms || ''];
  const declarationText =
    form?.declaration ||
    (typeof defaultDeclaration === 'function' ? defaultDeclaration(company) : defaultDeclaration) ||
    '';

  const handleUpdateTerm =
    onUpdateTerm || ((index, value) => onUpdate?.(`terms.${index}`, value));
  const handleAddTerm = onAddTerm || (() => onUpdate?.(`terms.${realTerms.length}`, ''));

  const companyMeta = [
    company?.gstin ? `GSTIN: ${company.gstin}` : null,
    company?.cin ? `CIN: ${company.cin}` : null,
    company?.udyam ? `Udyam: ${company.udyam}${company.udyamLabel ? ` (${company.udyamLabel})` : ''}` : null,
    company?.email ? `Email: ${company.email}` : null,
    company?.website ? `Website: ${company.website}` : null,
  ].filter(Boolean);

  const placeOfSupplyDisplay =
    invoice?.placeOfSupplyState ||
    [billTo?.stateName, billTo?.stateCode].filter(Boolean).join(' / ') ||
    invoice?.placeOfSupply ||
    '';

  return (
    <div ref={previewRef} className="invoice-print-root">
      <article className={`tylo-invoice tylo-invoice--${docKey}`} aria-label={documentTitle}>
        <header className="ti-header">
          <div className="ti-header-brand">
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={legal} className="ti-logo" />
            ) : (
              <>
                <span className="ti-logo-text">TYLO</span>
                <span className="ti-tagline">{company?.brandLine || '— Bringing Healthcare Closer. —'}</span>
              </>
            )}
          </div>

          <div className="ti-header-company">
            <p className="ti-company-address">
              <strong>Registered Office:</strong> {company?.address || '—'}
            </p>
            {companyMeta.length ? (
              <div className="ti-company-meta">
                {companyMeta.map((meta) => (
                  <span key={meta}>{meta}</span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ti-header-doc">
            <span className="ti-doc-badge">{documentTitle}</span>
          </div>
        </header>

        {/* Document meta — matches letterhead grid */}
        <div className="ti-meta-grid">
          <MetaCell label={docNoLabel}>
            <span className="ti-doc-meta-value--mono">
              {invoice?.documentNumber || (editable ? 'Assigned on approval' : '—')}
            </span>
          </MetaCell>
          <MetaCell label={dateLabel}>
            {editable ? (
              <InlineField
                type="date"
                value={invoice?.issueDate || ''}
                onChange={(v) => onUpdate?.('invoice.issueDate', v)}
              />
            ) : (
              formatDisplayDate(invoice?.issueDate) || 'DD/MM/YYYY'
            )}
          </MetaCell>
          <MetaCell label={dueLabel}>
            {editable ? (
              <InlineField
                type="date"
                value={invoice?.dueDate || ''}
                onChange={(v) => onUpdate?.('invoice.dueDate', v)}
              />
            ) : (
              formatDisplayDate(invoice?.dueDate) || 'DD/MM/YYYY'
            )}
          </MetaCell>

          {showPoMeta ? (
            <>
              <MetaCell label="PO / WO No.">
                {editable ? (
                  <InlineField
                    value={invoice?.poReference || ''}
                    onChange={(v) => onUpdate?.('invoice.poReference', v)}
                    placeholder="—"
                  />
                ) : (
                  invoice?.poReference || '—'
                )}
              </MetaCell>
              <MetaCell label="PO / WO Date">
                {editable ? (
                  <InlineField
                    type="date"
                    value={invoice?.poDate || ''}
                    onChange={(v) => onUpdate?.('invoice.poDate', v)}
                  />
                ) : (
                  formatDisplayDate(invoice?.poDate) || 'DD/MM/YYYY'
                )}
              </MetaCell>
              <MetaCell label="Project / Service Period">
                {editable ? (
                  <InlineField
                    value={invoice?.servicePeriod || invoice?.projectName || ''}
                    onChange={(v) => {
                      onUpdate?.('invoice.servicePeriod', v);
                      onUpdate?.('invoice.projectName', v);
                    }}
                    placeholder="—"
                  />
                ) : (
                  invoice?.servicePeriod || invoice?.projectName || '—'
                )}
              </MetaCell>
            </>
          ) : null}

          {showPlaceOfSupply || showReverseCharge ? (
            <>
              {showPlaceOfSupply ? (
                <MetaCell label="Place of Supply">
                  {editable ? (
                    <InlineField
                      value={placeOfSupplyDisplay}
                      onChange={(v) => {
                        onUpdate?.('invoice.placeOfSupplyState', v);
                        onUpdate?.('billTo.stateName', v);
                      }}
                      placeholder="State / State Code"
                    />
                  ) : (
                    placeOfSupplyDisplay || '—'
                  )}
                </MetaCell>
              ) : (
                <MetaCell label=""> </MetaCell>
              )}
              {showReverseCharge ? (
                <MetaCell label="Reverse Charge">
                  {editable ? (
                    <select
                      className="ei-inline"
                      value={invoice?.reverseCharge === 'Y' ? 'Y' : 'N'}
                      onChange={(e) => onUpdate?.('invoice.reverseCharge', e.target.value)}
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  ) : (
                    invoice?.reverseCharge === 'Y' ? 'Yes' : 'No'
                  )}
                </MetaCell>
              ) : (
                <MetaCell label=""> </MetaCell>
              )}
              <MetaCell label=""> </MetaCell>
            </>
          ) : null}

          {showOriginalInvoice ? (
            <>
              <MetaCell label="Original Invoice No.">
                {editable ? (
                  <InlineField
                    value={invoice?.[originalRefField] || ''}
                    onChange={(v) => onUpdate?.(`invoice.${originalRefField}`, v)}
                    placeholder="TYLO/26-27/0001"
                    mono
                  />
                ) : (
                  invoice?.[originalRefField] || '—'
                )}
              </MetaCell>
              <MetaCell label="Original Invoice Date">
                {editable ? (
                  <InlineField
                    type="date"
                    value={invoice?.originalInvoiceDate || ''}
                    onChange={(v) => onUpdate?.('invoice.originalInvoiceDate', v)}
                  />
                ) : (
                  formatDisplayDate(invoice?.originalInvoiceDate) || 'DD/MM/YYYY'
                )}
              </MetaCell>
              <MetaCell label={reasonLabel || 'Reason'}>
                {editable ? (
                  <select
                    className="ei-inline"
                    value={invoice?.[reasonField] || REASONS[0]}
                    onChange={(e) => onUpdate?.(`invoice.${reasonField}`, e.target.value)}
                  >
                    {REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                ) : (
                  invoice?.[reasonField] || REASONS[0]
                )}
              </MetaCell>
            </>
          ) : null}
        </div>

        {/* Parties — letterhead Bill To | Ship To / Service Location */}
        <div className="ti-cards ti-cards--parties">
          <div className="ti-card">
            <p className="ti-card-title">{leftPartyTitle}</p>
            <div className="ti-card-body">
              <Field
                full
                label={billNameLabel}
                value={billTo?.name}
                onChange={(v) => onUpdate?.('billTo.name', v)}
                editable={editable}
              />
              <Field
                full
                area
                label="Address"
                value={billTo?.address}
                onChange={(v) => onUpdate?.('billTo.address', v)}
                editable={editable}
              />
              <div className="ti-field-row">
                <Field
                  label="GSTIN"
                  value={billTo?.gstin}
                  onChange={(v) => onUpdate?.('billTo.gstin', v)}
                  editable={editable}
                />
                <Field
                  label="State / State Code"
                  value={stateLine(billTo)}
                  onChange={(v) => onUpdate?.('billTo.stateName', v)}
                  editable={editable}
                />
              </div>
            </div>
          </div>

          <div className="ti-card">
            <p className="ti-card-title">{rightPartyTitle}</p>
            <div className="ti-card-body">
              <Field
                full
                label={shipNameLabel}
                value={shipTo?.name}
                onChange={(v) => onUpdate?.('shipTo.name', v)}
                editable={editable}
              />
              <Field
                full
                area
                label="Address"
                value={shipTo?.address}
                onChange={(v) => onUpdate?.('shipTo.address', v)}
                editable={editable}
              />
              <div className="ti-field-row">
                <Field
                  label={shipGstinLabel}
                  value={shipTo?.gstin}
                  onChange={(v) => onUpdate?.('shipTo.gstin', v)}
                  editable={editable}
                />
                <Field
                  label="State / State Code"
                  value={stateLine(shipTo)}
                  onChange={(v) => onUpdate?.('shipTo.stateName', v)}
                  editable={editable}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line items — letterhead columns */}
        <section className="ti-lines-section">
          <table className="ti-lines ti-lines--letterhead">
            <colgroup>
              <col className="ti-col-num" />
              <col className="ti-col-desc" />
              <col className="ti-col-sac" />
              <col className="ti-col-qty" />
              <col className="ti-col-rate" />
              <col className="ti-col-taxable" />
              <col className="ti-col-taxpct" />
            </colgroup>
            <thead>
              <tr>
                <th className="ti-th-num">Sr.</th>
                <th className="ti-th-desc">Description of Services</th>
                <th className="ti-th-sac">SAC</th>
                <th className="ti-th-qty">Qty</th>
                <th className="ti-th-r">Rate (₹)</th>
                <th className="ti-th-r">Taxable Value (₹)</th>
                <th className="ti-th-tax">GST Rate</th>
              </tr>
            </thead>
            <tbody>
              {rawLines.map((line, index) => {
                const computed = totals.lines[index] || {};
                const rateDisplay = getLineGstRateDisplay(line, taxMode);
                return (
                  <tr key={line.id || index}>
                    <td className="ti-num">{index + 1}</td>
                    <td className="ti-desc">
                      {editable ? (
                        <InlineTextarea
                          rows={2}
                          value={line.description || ''}
                          onChange={(v) => onUpdateLine?.(index, { description: v })}
                          placeholder="Healthcare Camp / Activation Services"
                        />
                      ) : (
                        line.description || '—'
                      )}
                    </td>
                    <td className="ti-sac">
                      {editable ? (
                        <InlineTableInput
                          value={line.hsnSac || ''}
                          onChange={(v) => onUpdateLine?.(index, { hsnSac: v })}
                          align="center"
                        />
                      ) : (
                        line.hsnSac || '—'
                      )}
                    </td>
                    <td className="ti-qty">
                      {editable ? (
                        <InlineTableInput
                          value={line.qty}
                          onChange={(v) => onUpdateLine?.(index, { qty: Number(v) })}
                          align="center"
                        />
                      ) : (
                        line.qty
                      )}
                    </td>
                    <td className="ti-r">
                      {editable ? (
                        <InlineTableInput
                          value={line.rate}
                          onChange={(v) => onUpdateLine?.(index, { rate: Number(v) })}
                          align="right"
                        />
                      ) : (
                        money(line.rate)
                      )}
                    </td>
                    <td className="ti-r">{money(computed.taxableAmount)}</td>
                    <td className="ti-num ti-tax-rate">
                      {isNil ? (
                        '0.00'
                      ) : editable ? (
                        <InlineTableInput
                          value={rateDisplay}
                          onChange={(v) => onUpdateLine?.(index, patchLineGstRate(v, taxMode))}
                          align="center"
                        />
                      ) : rateDisplay === '' || rateDisplay == null ? (
                        '—'
                      ) : (
                        `${rateDisplay}%`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {editable && rawLines.length < MAX_INVOICE_LINE_ITEMS ? (
            <button type="button" className="ti-add-line" onClick={() => onAddLine?.()}>
              + Add line
            </button>
          ) : null}

          <WordsAndTotalsBlock
            totals={totals}
            isNil={isNil}
            taxMode={taxMode}
            showAdjustments={showAdjustments}
            adj={adj}
            totalLabel={totalLabel}
            amountWords={words}
            money={money}
          />
        </section>

        <div className="ti-split-stack">
          <div className="ti-card">
            <p className="ti-card-title">Bank Details</p>
            <div className="ti-card-body">
              <p className="ti-bank-line">Account Name: {bank?.accountHolder || legal}</p>
              <p className="ti-bank-line">Bank: {bank?.bankName || '—'}</p>
              <p className="ti-bank-line">Branch: {bank?.branchName || '—'}</p>
              <p className="ti-bank-line">Account No.: {bank?.accountNumber || '—'}</p>
              <p className="ti-bank-line">IFSC: {bank?.ifscCode || '—'}</p>
              <p className="ti-bank-note">{bankNote}</p>
            </div>
          </div>

          <div className="ti-card ti-card--terms-sign">
            <p className="ti-card-title">{paymentTermsTitle}</p>
            <div className="ti-card-body ti-card-body--terms-sign">
              <div className="ti-terms-block">
                <div className="ti-terms ti-terms--footer">
                  {realTerms.map((term, index) => (
                    <p key={index} className="ti-terms-line">
                      {editable && showTermsEditor ? (
                        <InlineField
                          value={term}
                          onChange={(v) => handleUpdateTerm(index, v)}
                          placeholder="Payment terms…"
                        />
                      ) : (
                        term || defaultTerms
                      )}
                    </p>
                  ))}
                  {editable && showTermsEditor ? (
                    <button type="button" className="ti-add-line ti-add-term" onClick={handleAddTerm}>
                      + Add term
                    </button>
                  ) : null}
                </div>
                {declarationText ? <p className="ti-declaration">{declarationText}</p> : null}
              </div>
              <div className="ti-signature ti-signature--in-card">
                <span className="ti-signature-company">For {signature?.companyLabel || legal}</span>
                {signature?.imageDataUrl ? (
                  <img src={signature.imageDataUrl} alt="Signature" className="ti-signature-img" />
                ) : (
                  <div className="ti-signature-line" />
                )}
                {signature?.signatoryName ? (
                  <span className="ti-signature-name">{signature.signatoryName}</span>
                ) : null}
                <span className="ti-signature-label">Authorised Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
