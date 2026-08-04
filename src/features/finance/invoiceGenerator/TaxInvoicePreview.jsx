import {
  amountInWordsIndian,
  computeInvoiceTotals,
  formatDisplayDate,
  formatGstRateDisplay,
  formatInr,
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  usesIgst,
} from './invoiceCalculations.js';
import { InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import { MAX_INVOICE_LINE_ITEMS } from './invoiceStorage.js';
import './tylo-invoice-template.css';

function Prefill({ children }) {
  return <span className="ti-prefill">{children || '—'}</span>;
}

function Card({ title, children, className = '' }) {
  return (
    <section className={`ti-card ${className}`.trim()}>
      <h3 className="ti-card-title">{title}</h3>
      <div className="ti-card-body">{children}</div>
    </section>
  );
}

function Field({ label, children, full = false }) {
  return (
    <div className={`ti-field${full ? ' ti-field--full' : ''}`}>
      <span className="ti-field-label">{label}</span>
      <div className="ti-field-value">{children}</div>
    </div>
  );
}

function FieldRow({ children }) {
  return <div className="ti-field-row">{children}</div>;
}

const DEFAULT_LABELS = {
  docNo: 'Invoice No',
  docDate: 'Invoice Date',
  project: 'Project',
  originalInvoice: '',
};

export default function TaxInvoicePreview({
  form,
  previewRef,
  editable = false,
  documentTitle = 'TAX INVOICE',
  totalAmountLabel = 'Total Invoice Amount',
  detailsCardTitle = 'Invoice Details',
  fieldLabels = {},
  showPaymentDetails = true,
  showReverseCharge = true,
  onUpdate,
  onUpdateLine,
  onAddLine,
  onUpdateTerm,
  onAddTerm,
}) {
  const labels = { ...DEFAULT_LABELS, ...fieldLabels };
  const taxMode = usesIgst(form.billTo?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const totals = computeInvoiceTotals(form.lineItems || [], taxMode, form.adjustments || {});
  const taxLabels = resolveTaxColumnLabels(form);
  const { company, bank, billTo, invoice, terms, adjustments, payment, signature } = form;

  const bankDisplay = [bank?.bankName, bank?.branchName].filter(Boolean).join(' · ');
  const displayTerms = (terms || []).length ? terms : editable ? ['', ''] : [];
  const hasLogo = Boolean(company?.logoDataUrl);
  const showTagline = Boolean(company?.brandLine) && !hasLogo;

  return (
    <div ref={previewRef} className="invoice-print-root">
      <article className="tylo-invoice" aria-label="Tax invoice">
        {/* ─── Header: logo · company · invoice badge ─── */}
        <header className="ti-header">
          <div className="ti-header-brand">
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={company?.legalName || 'Company logo'} className="ti-logo" />
            ) : (
              <>
                <span className="ti-logo-text">TYLO</span>
                {showTagline ? <span className="ti-tagline">{company.brandLine}</span> : null}
              </>
            )}
          </div>

          <div className="ti-header-company">
            <h1 className="ti-company-name">{company?.legalName || 'Company name'}</h1>
            {company?.address ? <p className="ti-company-address">{company.address}</p> : null}
            <div className="ti-company-meta">
              {company?.cin ? <span>CIN {company.cin}</span> : null}
              {company?.phone ? <span>{company.phone}</span> : null}
              {company?.email ? <span>{company.email}</span> : null}
              {company?.website ? <span>{company.website}</span> : null}
            </div>
          </div>

          <div className="ti-header-doc">
            <span className="ti-doc-badge">{documentTitle}</span>
            <div className="ti-doc-meta">
              <div className="ti-doc-meta-row">
                <span className="ti-doc-meta-label">{labels.docNo}</span>
                {editable ? (
                  <span className="ti-doc-meta-value ti-doc-meta-value--mono">
                    {invoice?.documentNumber || 'Assigned on approval'}
                  </span>
                ) : (
                  <span className="ti-doc-meta-value ti-doc-meta-value--mono">
                    {invoice?.documentNumber || 'Draft'}
                  </span>
                )}
              </div>
              {invoice?.issueDate ? (
                <div className="ti-doc-meta-row">
                  <span className="ti-doc-meta-label">Date</span>
                  <span className="ti-doc-meta-value">
                    {editable ? (
                      <InlineField
                        type="date"
                        value={invoice.issueDate}
                        onChange={(v) => onUpdate?.('invoice.issueDate', v)}
                      />
                    ) : (
                      formatDisplayDate(invoice.issueDate)
                    )}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* ─── Info cards ─── */}
        <div className="ti-cards">
          <Card title="Bill To">
            <Field label="Recipient" full>
              {editable ? (
                <InlineField value={billTo?.name} onChange={(v) => onUpdate?.('billTo.name', v)} placeholder="Recipient name" />
              ) : (
                billTo?.name || '—'
              )}
            </Field>
            <Field label="Address" full>
              {editable ? (
                <InlineTextarea
                  value={billTo?.address || invoice?.placeOfSupply}
                  onChange={(v) => {
                    onUpdate?.('billTo.address', v);
                    onUpdate?.('invoice.placeOfSupply', v);
                  }}
                  placeholder="Place of supply"
                  rows={2}
                />
              ) : (
                billTo?.address || invoice?.placeOfSupply || '—'
              )}
            </Field>
            <FieldRow>
              <Field label="State">
                {editable ? (
                  <InlineField value={billTo?.stateName} onChange={(v) => onUpdate?.('billTo.stateName', v)} placeholder="State" />
                ) : (
                  billTo?.stateName || '—'
                )}
              </Field>
              <Field label="Code">
                {editable ? (
                  <InlineField value={billTo?.stateCode} onChange={(v) => onUpdate?.('billTo.stateCode', v)} placeholder="27" />
                ) : (
                  billTo?.stateCode || '—'
                )}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="GSTIN">
                {editable ? (
                  <InlineField value={billTo?.gstin} onChange={(v) => onUpdate?.('billTo.gstin', v)} placeholder="GSTIN" />
                ) : (
                  billTo?.gstin || '—'
                )}
              </Field>
              <Field label="PAN">
                {editable ? (
                  <InlineField value={billTo?.pan} onChange={(v) => onUpdate?.('billTo.pan', v)} placeholder="PAN" />
                ) : (
                  billTo?.pan || '—'
                )}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Contact">
                {editable ? (
                  <InlineField value={billTo?.contactPerson} onChange={(v) => onUpdate?.('billTo.contactPerson', v)} placeholder="Name" />
                ) : (
                  billTo?.contactPerson || '—'
                )}
              </Field>
              <Field label="Email">
                {editable ? (
                  <InlineField value={billTo?.email} onChange={(v) => onUpdate?.('billTo.email', v)} placeholder="Email" />
                ) : (
                  billTo?.email || '—'
                )}
              </Field>
            </FieldRow>
          </Card>

          <Card title={detailsCardTitle}>
            <Field label={labels.project}>
              {editable ? (
                <InlineField value={invoice?.projectName} onChange={(v) => onUpdate?.('invoice.projectName', v)} placeholder="Project" />
              ) : (
                invoice?.projectName || '—'
              )}
            </Field>
            {labels.originalInvoice ? (
              <Field label={labels.originalInvoice}>
                {editable ? (
                  <InlineField value={invoice?.cnReference} onChange={(v) => onUpdate?.('invoice.cnReference', v)} placeholder="Original invoice no." />
                ) : (
                  invoice?.cnReference || '—'
                )}
              </Field>
            ) : null}
            <FieldRow>
              <Field label={labels.docDate}>
                {editable ? (
                  <InlineField type="date" value={invoice?.issueDate} onChange={(v) => onUpdate?.('invoice.issueDate', v)} />
                ) : (
                  formatDisplayDate(invoice?.issueDate) || '—'
                )}
              </Field>
              <Field label="Due Date">
                {editable ? (
                  <InlineField type="date" value={invoice?.dueDate} onChange={(v) => onUpdate?.('invoice.dueDate', v)} />
                ) : (
                  formatDisplayDate(invoice?.dueDate) || '—'
                )}
              </Field>
            </FieldRow>
            {showReverseCharge ? (
            <FieldRow>
              <Field label="Reverse Charge">
                {editable ? (
                  <InlineField
                    value={invoice?.reverseCharge === 'Y' ? 'Yes' : 'No'}
                    onChange={(v) => onUpdate?.('invoice.reverseCharge', v.toLowerCase().startsWith('y') ? 'Y' : 'N')}
                  />
                ) : (
                  invoice?.reverseCharge === 'Y' ? 'Yes' : 'No'
                )}
              </Field>
              <Field label="Receipt Voucher">
                {editable ? (
                  <InlineField value={invoice?.receiptVoucherNo} onChange={(v) => onUpdate?.('invoice.receiptVoucherNo', v)} placeholder="RV no. & date" />
                ) : (
                  invoice?.receiptVoucherNo || '—'
                )}
              </Field>
            </FieldRow>
            ) : null}
            <FieldRow>
              <Field label="Supplier PAN">
                <Prefill>{company?.pan}</Prefill>
              </Field>
              <Field label="Supplier GSTIN">
                <Prefill>{company?.gstin}</Prefill>
              </Field>
            </FieldRow>
          </Card>

          {showPaymentDetails ? (
          <Card title="Payment Details" className="ti-card--payment">
            <div className="ti-payment-layout">
              <div className="ti-payment-fields">
                <Field label="Payable to" full>
                  <Prefill>{bank?.accountHolder || company?.legalName}</Prefill>
                </Field>
                <Field label="Bank" full>
                  <Prefill>{bankDisplay || bank?.bankName}</Prefill>
                </Field>
                <FieldRow>
                  <Field label="IFSC">
                    <Prefill>{bank?.ifscCode}</Prefill>
                  </Field>
                  <Field label="Account">
                    <Prefill>{bank?.accountNumber}</Prefill>
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="CN Ref">
                    {editable ? (
                      <InlineField value={invoice?.cnReference} onChange={(v) => onUpdate?.('invoice.cnReference', v)} placeholder="—" />
                    ) : (
                      invoice?.cnReference || '—'
                    )}
                  </Field>
                  <Field label="DN Ref">
                    {editable ? (
                      <InlineField value={invoice?.dnReference} onChange={(v) => onUpdate?.('invoice.dnReference', v)} placeholder="—" />
                    ) : (
                      invoice?.dnReference || '—'
                    )}
                  </Field>
                </FieldRow>
              </div>
              <aside className="ti-payment-qr" aria-label="Payment QR code">
                {payment?.paymentQrDataUrl ? (
                  <img src={payment.paymentQrDataUrl} alt="Scan to pay" className="ti-payment-qr-img" />
                ) : (
                  <div className="ti-payment-qr-placeholder">
                    <span>QR</span>
                  </div>
                )}
                {payment?.upiId ? (
                  <span className="ti-payment-upi">{payment.upiId}</span>
                ) : null}
              </aside>
            </div>
          </Card>
          ) : null}
        </div>

        {/* ─── Line items ─── */}
        <div className="ti-lines-section">
          <table className="ti-lines">
            <colgroup>
              <col className="ti-col-num" />
              <col className="ti-col-desc" />
              <col className="ti-col-sac" />
              <col className="ti-col-qty" />
              <col className="ti-col-rate" />
              <col className="ti-col-amt" />
              <col className="ti-col-disc" />
              <col className="ti-col-taxable" />
              <col className="ti-col-taxpct" />
              <col className="ti-col-tax" />
              <col className="ti-col-total" />
            </colgroup>
            <thead>
              <tr>
                <th className="ti-th-num">#</th>
                <th className="ti-th-desc">Description</th>
                <th className="ti-th-sac">SAC</th>
                <th className="ti-th-qty">Qty</th>
                <th className="ti-th-r">Rate</th>
                <th className="ti-th-r">Amount</th>
                <th className="ti-th-r">Disc.</th>
                <th className="ti-th-r">Taxable</th>
                <th className="ti-th-r ti-th-tax">
                  {editable ? (
                    <InlineTableInput
                      value={form.taxColumnLabels?.rateLabel ?? taxLabels.rateLabel}
                      onChange={(v) => onUpdate?.('taxColumnLabels.rateLabel', v)}
                      placeholder="GST %"
                      align="right"
                    />
                  ) : (
                    taxLabels.rateLabel
                  )}
                </th>
                <th className="ti-th-r ti-th-tax">
                  {editable ? (
                    <InlineTableInput
                      value={form.taxColumnLabels?.amountLabel ?? taxLabels.amountLabel}
                      onChange={(v) => onUpdate?.('taxColumnLabels.amountLabel', v)}
                      placeholder="GST"
                      align="right"
                    />
                  ) : (
                    taxLabels.amountLabel
                  )}
                </th>
                <th className="ti-th-r ti-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line, idx) => {
                const amount = (Number(line.qty) || 0) * (Number(line.rate) || 0);
                return (
                  <tr key={line.id || idx}>
                    <td className="ti-num">{idx + 1}</td>
                    <td className="ti-desc">
                      {editable ? (
                        <InlineTableInput value={line.description} onChange={(v) => onUpdateLine?.(idx, { description: v })} placeholder="Service description" />
                      ) : (
                        line.description || '—'
                      )}
                    </td>
                    <td className="ti-sac">
                      {editable ? (
                        <InlineTableInput value={line.hsnSac} onChange={(v) => onUpdateLine?.(idx, { hsnSac: v })} placeholder="SAC" align="center" />
                      ) : (
                        line.hsnSac || '—'
                      )}
                    </td>
                    <td className="ti-qty">
                      {editable ? (
                        <InlineTableInput value={line.qty} onChange={(v) => onUpdateLine?.(idx, { qty: v })} align="center" />
                      ) : (
                        line.qty
                      )}
                    </td>
                    <td className="ti-r">
                      {editable ? (
                        <InlineTableInput value={line.rate} onChange={(v) => onUpdateLine?.(idx, { rate: v })} align="right" />
                      ) : (
                        formatInr(line.rate)
                      )}
                    </td>
                    <td className="ti-r">{formatInr(amount)}</td>
                    <td className="ti-r">
                      {editable ? (
                        <InlineTableInput value={line.discount} onChange={(v) => onUpdateLine?.(idx, { discount: v })} align="right" />
                      ) : line.discount ? (
                        formatInr(line.discount)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="ti-r">{formatInr(line.taxableAmount)}</td>
                    <td className="ti-r ti-tax-rate">
                      {editable ? (
                        <InlineTableInput
                          value={getLineGstRateDisplay(line, taxMode)}
                          onChange={(v) => onUpdateLine?.(idx, patchLineGstRate(v, taxMode))}
                          align="right"
                          placeholder="0"
                        />
                      ) : (
                        formatGstRateDisplay(line, taxMode)
                      )}
                    </td>
                    <td className="ti-r">{formatInr(line.taxAmount)}</td>
                    <td className="ti-r ti-r--strong">{formatInr(line.totalAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editable && form.lineItems.length < MAX_INVOICE_LINE_ITEMS ? (
            <button type="button" className="ti-add-line" onClick={onAddLine}>
              + Add line item
            </button>
          ) : null}
        </div>

        {/* ─── Footer: notes · totals · signature ─── */}
        <footer className="ti-footer">
          <div className="ti-footer-notes">
            <div className="ti-words">
              <span className="ti-words-label">Amount in words</span>
              <p className="ti-words-text">Indian Rupees {amountInWordsIndian(totals.grandTotal)}</p>
            </div>

            {(displayTerms.length > 0 || editable) && (
              <div className="ti-terms ti-terms--footer">
                <h4 className="ti-terms-title">Terms &amp; Conditions</h4>
                <ol>
                  {displayTerms.map((t, i) => (
                    <li key={i}>
                      {editable ? (
                        <InlineField value={t} onChange={(v) => onUpdateTerm?.(i, v)} placeholder={`Term ${i + 1}`} />
                      ) : (
                        t || '—'
                      )}
                    </li>
                  ))}
                </ol>
                {editable ? (
                  <button type="button" className="ti-add-line ti-add-term" onClick={onAddTerm}>
                    + Add term
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="ti-totals">
            <div className="ti-totals-rows">
              <div className="ti-totals-row">
                <span>{totalAmountLabel}</span>
                <span>{formatInr(totals.subtotal + totals.taxAmount)}</span>
              </div>
              <div className="ti-totals-row">
                <span>CN Amount</span>
                <span>
                  {editable ? (
                    <InlineField value={adjustments?.cnAmount || ''} onChange={(v) => onUpdate?.('adjustments.cnAmount', v)} placeholder="0" />
                  ) : (
                    formatInr(adjustments?.cnAmount || 0)
                  )}
                </span>
              </div>
              <div className="ti-totals-row">
                <span>Advance</span>
                <span>
                  {editable ? (
                    <InlineField value={adjustments?.advanceReceived || ''} onChange={(v) => onUpdate?.('adjustments.advanceReceived', v)} placeholder="0" />
                  ) : (
                    formatInr(adjustments?.advanceReceived || 0)
                  )}
                </span>
              </div>
              <div className="ti-totals-row">
                <span>DN Amount</span>
                <span>
                  {editable ? (
                    <InlineField value={adjustments?.dnAmount || ''} onChange={(v) => onUpdate?.('adjustments.dnAmount', v)} placeholder="0" />
                  ) : (
                    formatInr(adjustments?.dnAmount || 0)
                  )}
                </span>
              </div>
              <div className="ti-totals-row">
                <span>Round off</span>
                <span>{formatInr(totals.roundOff || 0)}</span>
              </div>
            </div>
            <div className="ti-totals-grand">
              <span className="ti-totals-grand-label">Grand Total</span>
              <span className="ti-totals-grand-value">₹ {formatInr(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="ti-signature">
            {signature?.imageDataUrl ? (
              <img src={signature.imageDataUrl} alt="" className="ti-signature-img" />
            ) : (
              <div className="ti-signature-line" aria-hidden="true" />
            )}
            <span className="ti-signature-label">Authorized Signatory</span>
            {editable ? (
              <>
                <InlineField
                  value={signature?.signatoryName || ''}
                  onChange={(v) => onUpdate?.('signature.signatoryName', v)}
                  placeholder="Signatory name"
                  className="ti-signature-name-input"
                />
                <InlineField
                  value={signature?.companyLabel || company?.legalName || ''}
                  onChange={(v) => onUpdate?.('signature.companyLabel', v)}
                  placeholder="For company"
                  className="ti-signature-company-input"
                />
              </>
            ) : (
              <>
                {signature?.signatoryName ? <span className="ti-signature-name">{signature.signatoryName}</span> : null}
                <span className="ti-signature-company">{signature?.companyLabel || company?.legalName || ''}</span>
              </>
            )}
          </div>
        </footer>
      </article>
    </div>
  );
}

export { formatDisplayDate };
