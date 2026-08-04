import {
  amountInWordsIndian,
  formatDisplayDate,
  formatGstRateDisplay,
  formatInr,
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';
import { InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import '../invoiceGenerator/tylo-invoice-template.css';
import { MAX_PO_LINE_ITEMS } from './purchaseOrderStorage.js';
import './purchase-order.css';

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

export default function PurchaseOrderPreview({
  form,
  totals,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
  onUpdateTerm,
  onAddTerm,
}) {
  const taxMode = usesIgst(form.vendor?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const taxLabels = resolveTaxColumnLabels(form);
  const { company, vendor, po, terms, signature } = form;
  const displayTerms = (terms || []).length ? terms : editable ? ['', ''] : [];
  const hasLogo = Boolean(company?.logoDataUrl);
  const showTagline = Boolean(company?.brandLine) && !hasLogo;
  const companyAddress = company?.address || company?.registeredOffice || '';
  const lineTotals = totals?.lines || [];

  return (
    <div ref={previewRef} className="invoice-print-root">
      <article className="tylo-invoice tylo-invoice--purchase-order" aria-label="Purchase order">
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
            {companyAddress ? <p className="ti-company-address">{companyAddress}</p> : null}
            <div className="ti-company-meta">
              {company?.cin ? <span>CIN {company.cin}</span> : null}
              {company?.phone ? <span>{company.phone}</span> : null}
              {company?.email ? <span>{company.email}</span> : null}
              {company?.website ? <span>{company.website}</span> : null}
            </div>
          </div>

          <div className="ti-header-doc">
            <span className="ti-doc-badge">PURCHASE ORDER</span>
            <div className="ti-doc-meta">
              <div className="ti-doc-meta-row">
                <span className="ti-doc-meta-label">PO No</span>
                {editable ? (
                  <span className="ti-doc-meta-value ti-doc-meta-value--mono">
                    {po?.documentNumber || 'Assigned on approval'}
                  </span>
                ) : (
                  <span className="ti-doc-meta-value ti-doc-meta-value--mono">{po?.documentNumber || 'Draft'}</span>
                )}
              </div>
              <div className="ti-doc-meta-row">
                <span className="ti-doc-meta-label">PO Date</span>
                <span className="ti-doc-meta-value">
                  {editable ? (
                    <InlineField type="date" value={po?.documentDate} onChange={(v) => onUpdate?.('po.documentDate', v)} />
                  ) : (
                    formatDisplayDate(po?.documentDate)
                  )}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="ti-cards">
          <Card title="Vendor Details">
            <Field label="Vendor" full>
              {editable ? (
                <InlineField value={vendor?.name} onChange={(v) => onUpdate?.('vendor.name', v)} placeholder="Vendor name" />
              ) : (
                vendor?.name || '—'
              )}
            </Field>
            <Field label="Address" full>
              {editable ? (
                <InlineTextarea value={vendor?.address} onChange={(v) => onUpdate?.('vendor.address', v)} placeholder="Vendor address" rows={2} />
              ) : (
                vendor?.address || '—'
              )}
            </Field>
            <FieldRow>
              <Field label="State">
                {editable ? (
                  <InlineField value={vendor?.stateName} onChange={(v) => onUpdate?.('vendor.stateName', v)} placeholder="State" />
                ) : (
                  vendor?.stateName || '—'
                )}
              </Field>
              <Field label="Code">
                {editable ? (
                  <InlineField value={vendor?.stateCode} onChange={(v) => onUpdate?.('vendor.stateCode', v)} placeholder="27" />
                ) : (
                  vendor?.stateCode || '—'
                )}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="GSTIN">
                {editable ? (
                  <InlineField value={vendor?.gstin} onChange={(v) => onUpdate?.('vendor.gstin', v)} placeholder="GSTIN" />
                ) : (
                  vendor?.gstin || '—'
                )}
              </Field>
              <Field label="PAN">
                {editable ? (
                  <InlineField value={vendor?.pan} onChange={(v) => onUpdate?.('vendor.pan', v)} placeholder="PAN" />
                ) : (
                  vendor?.pan || '—'
                )}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Contact">
                {editable ? (
                  <InlineField value={vendor?.contactPerson} onChange={(v) => onUpdate?.('vendor.contactPerson', v)} placeholder="Contact person" />
                ) : (
                  vendor?.contactPerson || '—'
                )}
              </Field>
              <Field label="Email">
                {editable ? (
                  <InlineField value={vendor?.email} onChange={(v) => onUpdate?.('vendor.email', v)} placeholder="Email" />
                ) : (
                  vendor?.email || '—'
                )}
              </Field>
            </FieldRow>
          </Card>

          <Card title="PO Details">
            <Field label="Reference" full>
              {editable ? (
                <InlineField value={po?.reference} onChange={(v) => onUpdate?.('po.reference', v)} placeholder="RFQ / quote ref." />
              ) : (
                po?.reference || '—'
              )}
            </Field>
            <Field label="Delivery Address" full>
              {editable ? (
                <InlineTextarea
                  value={form.deliveryAddress}
                  onChange={(v) => onUpdate?.('deliveryAddress', v)}
                  placeholder="Ship-to / delivery location"
                  rows={2}
                />
              ) : (
                form.deliveryAddress || '—'
              )}
            </Field>
            <FieldRow>
              <Field label="PO Date">
                {editable ? (
                  <InlineField type="date" value={po?.documentDate} onChange={(v) => onUpdate?.('po.documentDate', v)} />
                ) : (
                  formatDisplayDate(po?.documentDate) || '—'
                )}
              </Field>
              <Field label="Delivery Date">
                {editable ? (
                  <InlineField type="date" value={po?.deliveryDate} onChange={(v) => onUpdate?.('po.deliveryDate', v)} />
                ) : (
                  formatDisplayDate(po?.deliveryDate) || '—'
                )}
              </Field>
            </FieldRow>
            <Field label="Payment Terms" full>
              {editable ? (
                <InlineTextarea value={po?.paymentTerms} onChange={(v) => onUpdate?.('po.paymentTerms', v)} placeholder="Net 30 days" rows={2} />
              ) : (
                po?.paymentTerms || '—'
              )}
            </Field>
            <FieldRow>
              <Field label="Buyer PAN">
                <Prefill>{company?.pan}</Prefill>
              </Field>
              <Field label="Buyer GSTIN">
                <Prefill>{company?.gstin}</Prefill>
              </Field>
            </FieldRow>
          </Card>
        </div>

        <div className="ti-lines-section">
          <table className="ti-lines po-lines">
            <colgroup>
              <col className="ti-col-num" />
              <col className="ti-col-sac" />
              <col className="ti-col-desc" />
              <col className="ti-col-qty" />
              <col className="po-col-uom" />
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
                <th className="ti-th-sac">Item Code</th>
                <th className="ti-th-desc">Description</th>
                <th className="ti-th-qty">Qty</th>
                <th className="po-th-uom">Unit</th>
                <th className="ti-th-r">Unit Price</th>
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
              {lineTotals.map((line, idx) => {
                const amount = (Number(line.qty) || 0) * (Number(line.rate) || 0);
                const itemCode = form.lineItems[idx]?.itemCode || form.lineItems[idx]?.hsnSac || '';
                return (
                  <tr key={line.id || idx}>
                    <td className="ti-num">{idx + 1}</td>
                    <td className="ti-sac">
                      {editable ? (
                        <InlineTableInput
                          value={itemCode}
                          onChange={(v) => onUpdateLine?.(idx, { itemCode: v, hsnSac: v })}
                          placeholder="Code"
                          align="center"
                        />
                      ) : (
                        itemCode || '—'
                      )}
                    </td>
                    <td className="ti-desc">
                      {editable ? (
                        <InlineTableInput
                          value={line.description}
                          onChange={(v) => onUpdateLine?.(idx, { description: v })}
                          placeholder="Item description"
                        />
                      ) : (
                        <>
                          {line.description || '—'}
                          {form.lineItems[idx]?.isFoc ? <span className="po-foc-tag"> (FOC)</span> : null}
                        </>
                      )}
                    </td>
                    <td className="ti-qty">
                      {editable ? (
                        <InlineTableInput value={line.qty} onChange={(v) => onUpdateLine?.(idx, { qty: v })} align="center" />
                      ) : (
                        line.qty
                      )}
                    </td>
                    <td className="po-uom">
                      {editable ? (
                        <InlineTableInput
                          value={form.lineItems[idx]?.uom || 'Nos'}
                          onChange={(v) => onUpdateLine?.(idx, { uom: v })}
                          align="center"
                        />
                      ) : (
                        form.lineItems[idx]?.uom || 'Nos'
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
          {editable && form.lineItems.length < MAX_PO_LINE_ITEMS ? (
            <button type="button" className="ti-add-line" onClick={onAddLine}>
              + Add line item
            </button>
          ) : null}
        </div>

        <footer className="ti-footer">
          <div className="ti-footer-notes">
            <div className="ti-words">
              <span className="ti-words-label">Amount in words</span>
              <p className="ti-words-text">Indian Rupees {amountInWordsIndian(totals?.grandTotal)}</p>
            </div>

            <div className="po-shipping">
              <h4 className="ti-terms-title">Shipping Instructions</h4>
              {editable ? (
                <InlineTextarea
                  value={form.shippingInstructions}
                  onChange={(v) => onUpdate?.('shippingInstructions', v)}
                  placeholder="Delivery location, contact on site, packaging requirements…"
                  rows={2}
                />
              ) : (
                <p>{form.shippingInstructions || '—'}</p>
              )}
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

            <div className="po-notes">
              <h4 className="ti-terms-title">Notes</h4>
              {editable ? (
                <InlineTextarea value={form.notes} onChange={(v) => onUpdate?.('notes', v)} placeholder="Additional notes" rows={2} />
              ) : (
                <p>{form.notes || '—'}</p>
              )}
            </div>
          </div>

          <div className="ti-totals">
            <div className="ti-totals-rows">
              <div className="ti-totals-row">
                <span>Subtotal</span>
                <span>{formatInr(totals?.subtotal)}</span>
              </div>
              <div className="ti-totals-row">
                <span>{taxLabels.amountLabel}</span>
                <span>{formatInr(totals?.taxAmount)}</span>
              </div>
              <div className="ti-totals-row">
                <span>Round off</span>
                <span>{formatInr(totals?.roundOff || 0)}</span>
              </div>
            </div>
            <div className="ti-totals-grand">
              <span className="ti-totals-grand-label">Total Amount</span>
              <span className="ti-totals-grand-value">₹ {formatInr(totals?.grandTotal)}</span>
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
