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
import { InlineAddChip, InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import { defaultPoLineItem, MAX_PO_LINE_ITEMS } from './purchaseOrderStorage.js';
import './purchase-order.css';

function money(n) {
  return formatInr(n);
}

function MetaCell({ label, children }) {
  return (
    <td>
      <span className="po-meta-label">{label}</span>
      <span className="po-meta-value">{children}</span>
    </td>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="po-field-row">
      <span className="po-field-label">{label}</span>
      <div className="po-field-value">{children}</div>
    </div>
  );
}

function Val({ editable, value, onChange, type = 'text', placeholder = '—' }) {
  if (editable) {
    return <InlineField type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} />;
  }
  if (type === 'date') return formatDisplayDate(value) || placeholder;
  return value || placeholder;
}

export default function PurchaseOrderPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  // Seller (vendor) vs buyer/company state → IGST or CGST+SGST
  const taxMode = resolveTaxMode(form.vendor?.stateCode, form.company?.stateCode);
  const normalizedLines = (form.lineItems || []).map((line) => ({
    ...line,
    ...resolveLineGstRates(line, taxMode),
  }));
  const totals = computeInvoiceTotals(normalizedLines, taxMode, {});
  const { company, buyer, vendor, delivery, billing, commercial, po, signature } = form;
  const hasLogo = Boolean(company?.logoDataUrl);
  const legal = company?.legalName || 'Tylo Care Private Limited';
  const lines = Array.from({ length: MAX_PO_LINE_ITEMS }, (_, i) =>
    form.lineItems?.[i] ? form.lineItems[i] : defaultPoLineItem()
  );
  const words = amountInWordsIndian(totals.grandTotal);
  const filledCount = (form.lineItems || []).filter((r) => r.description || Number(r.qty) || Number(r.rate)).length;

  const lineTaxable = (line) =>
    Math.round(((Number(line.qty) || 0) * (Number(line.rate) || 0) - (Number(line.discount) || 0)) * 100) / 100;

  return (
    <div ref={previewRef} className="po-print-root">
      <article className="po-doc" aria-label="Purchase Order">
        <header className="po-header">
          <div>
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={legal} className="po-logo" />
            ) : (
              <div className="po-logo-fallback">
                <span className="po-logo-text">TYLO</span>
                <span className="po-tagline">{company?.brandLine || '— Bringing Healthcare Closer. —'}</span>
              </div>
            )}
          </div>
          <div className="po-company">
            <p>
              <strong>Registered Office:</strong> {company?.registeredOffice || company?.address || '—'}
            </p>
            <p>
              {[
                company?.gstin ? `GSTIN: ${company.gstin}` : null,
                company?.cin ? `CIN: ${company.cin}` : null,
                company?.udyam
                  ? `Udyam: ${company.udyam}${company.udyamLabel ? ` (${company.udyamLabel})` : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join('  |  ')}
            </p>
            <p>
              {[
                company?.email ? `Email: ${company.email}` : null,
                company?.website ? `Website: ${company.website}` : null,
              ]
                .filter(Boolean)
                .join('  |  ')}
            </p>
          </div>
          <h1 className="po-title">PURCHASE ORDER</h1>
        </header>

        <table className="po-grid">
          <tbody>
            <tr>
              <MetaCell label="Purchase Order No.">
                {po?.documentNumber || (editable ? 'Assigned on approval' : '—')}
              </MetaCell>
              <MetaCell label="Purchase Order Date">
                <Val
                  editable={editable}
                  type="date"
                  value={po?.documentDate}
                  onChange={(v) => onUpdate?.('po.documentDate', v)}
                />
              </MetaCell>
              <MetaCell label="Revision No.">
                <Val
                  editable={editable}
                  value={po?.revisionNo ?? 0}
                  onChange={(v) => onUpdate?.('po.revisionNo', v)}
                />
              </MetaCell>
            </tr>
            <tr>
              <MetaCell label="Vendor Quote Ref.">
                <Val
                  editable={editable}
                  value={po?.vendorQuoteRef}
                  onChange={(v) => onUpdate?.('po.vendorQuoteRef', v)}
                />
              </MetaCell>
              <MetaCell label="Vendor Quote Date">
                <Val
                  editable={editable}
                  type="date"
                  value={po?.vendorQuoteDate}
                  onChange={(v) => onUpdate?.('po.vendorQuoteDate', v)}
                />
              </MetaCell>
              <MetaCell label="Project / Cost Centre / Dept.">
                <Val
                  editable={editable}
                  value={po?.projectCostCentre}
                  onChange={(v) => onUpdate?.('po.projectCostCentre', v)}
                />
              </MetaCell>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>BUYER DETAILS</th>
              <th style={{ width: '50%' }}>VENDOR DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="po-party-body">
                <FieldRow label="Company Name">
                  <Val
                    editable={editable}
                    value={buyer?.companyName || legal}
                    onChange={(v) => onUpdate?.('buyer.companyName', v)}
                  />
                </FieldRow>
                <FieldRow label="Registered Office">
                  {editable ? (
                    <InlineTextarea
                      value={buyer?.address || ''}
                      onChange={(v) => onUpdate?.('buyer.address', v)}
                      rows={2}
                    />
                  ) : (
                    buyer?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="GSTIN">
                  <Val editable={editable} value={buyer?.gstin} onChange={(v) => onUpdate?.('buyer.gstin', v)} />
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Val
                    editable={editable}
                    value={buyer?.contactPerson}
                    onChange={(v) => onUpdate?.('buyer.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val editable={editable} value={buyer?.mobile} onChange={(v) => onUpdate?.('buyer.mobile', v)} />
                </FieldRow>
                <FieldRow label="Email">
                  <Val editable={editable} value={buyer?.email} onChange={(v) => onUpdate?.('buyer.email', v)} />
                </FieldRow>
              </td>
              <td className="po-party-body">
                <FieldRow label="Vendor Name">
                  <Val editable={editable} value={vendor?.name} onChange={(v) => onUpdate?.('vendor.name', v)} />
                </FieldRow>
                <FieldRow label="Vendor Code">
                  <Val editable={editable} value={vendor?.code} onChange={(v) => onUpdate?.('vendor.code', v)} />
                </FieldRow>
                <FieldRow label="Vendor Address">
                  {editable ? (
                    <InlineTextarea
                      value={vendor?.address || ''}
                      onChange={(v) => onUpdate?.('vendor.address', v)}
                      rows={2}
                    />
                  ) : (
                    vendor?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="GSTIN">
                  <Val editable={editable} value={vendor?.gstin} onChange={(v) => onUpdate?.('vendor.gstin', v)} />
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Val
                    editable={editable}
                    value={vendor?.contactPerson}
                    onChange={(v) => onUpdate?.('vendor.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val editable={editable} value={vendor?.mobile} onChange={(v) => onUpdate?.('vendor.mobile', v)} />
                </FieldRow>
                <FieldRow label="Email">
                  <Val editable={editable} value={vendor?.email} onChange={(v) => onUpdate?.('vendor.email', v)} />
                </FieldRow>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>DELIVERY DETAILS</th>
              <th style={{ width: '50%' }}>BILLING DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="po-party-body">
                <FieldRow label="Delivery Address">
                  {editable ? (
                    <InlineTextarea
                      value={delivery?.address || ''}
                      onChange={(v) => onUpdate?.('delivery.address', v)}
                      rows={2}
                    />
                  ) : (
                    delivery?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="Delivery Contact">
                  <Val
                    editable={editable}
                    value={delivery?.contact}
                    onChange={(v) => onUpdate?.('delivery.contact', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val
                    editable={editable}
                    value={delivery?.mobile}
                    onChange={(v) => onUpdate?.('delivery.mobile', v)}
                  />
                </FieldRow>
                <FieldRow label="Expected Delivery Date">
                  <Val
                    editable={editable}
                    type="date"
                    value={delivery?.expectedDate}
                    onChange={(v) => onUpdate?.('delivery.expectedDate', v)}
                  />
                </FieldRow>
                <FieldRow label="Delivery Instructions">
                  <Val
                    editable={editable}
                    value={delivery?.instructions}
                    onChange={(v) => onUpdate?.('delivery.instructions', v)}
                  />
                </FieldRow>
              </td>
              <td className="po-party-body">
                <FieldRow label="Billing Address">
                  {editable ? (
                    <InlineTextarea
                      value={billing?.address || ''}
                      onChange={(v) => onUpdate?.('billing.address', v)}
                      rows={2}
                    />
                  ) : (
                    billing?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="GSTIN">
                  <Val
                    editable={editable}
                    value={billing?.gstin}
                    onChange={(v) => onUpdate?.('billing.gstin', v)}
                  />
                </FieldRow>
                <FieldRow label="State">
                  <Val
                    editable={editable}
                    value={billing?.state}
                    onChange={(v) => onUpdate?.('billing.state', v)}
                  />
                </FieldRow>
                <FieldRow label="State Code">
                  <Val
                    editable={editable}
                    value={billing?.stateCode}
                    onChange={(v) => onUpdate?.('billing.stateCode', v)}
                  />
                </FieldRow>
                <FieldRow label="Place of Supply">
                  <Val
                    editable={editable}
                    value={billing?.placeOfSupply}
                    onChange={(v) => onUpdate?.('billing.placeOfSupply', v)}
                  />
                </FieldRow>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="po-grid">
          <thead>
            <tr>
              <th colSpan={3}>COMMERCIAL DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <MetaCell label="Payment Terms">
                <Val
                  editable={editable}
                  value={commercial?.paymentTerms}
                  onChange={(v) => onUpdate?.('commercial.paymentTerms', v)}
                />
              </MetaCell>
              <MetaCell label="Freight">
                <Val
                  editable={editable}
                  value={commercial?.freight}
                  onChange={(v) => onUpdate?.('commercial.freight', v)}
                />
              </MetaCell>
              <MetaCell label="Insurance">
                <Val
                  editable={editable}
                  value={commercial?.insurance}
                  onChange={(v) => onUpdate?.('commercial.insurance', v)}
                />
              </MetaCell>
            </tr>
            <tr>
              <MetaCell label="Delivery Terms">
                <Val
                  editable={editable}
                  value={commercial?.deliveryTerms}
                  onChange={(v) => onUpdate?.('commercial.deliveryTerms', v)}
                />
              </MetaCell>
              <MetaCell label="Warranty">
                <Val
                  editable={editable}
                  value={commercial?.warranty}
                  onChange={(v) => onUpdate?.('commercial.warranty', v)}
                />
              </MetaCell>
              <MetaCell label="Validity">
                <Val
                  editable={editable}
                  value={commercial?.validity}
                  onChange={(v) => onUpdate?.('commercial.validity', v)}
                />
              </MetaCell>
            </tr>
          </tbody>
        </table>

        <table className="po-grid po-items">
          <thead>
            <tr>
              <th colSpan={12}>ITEM DETAILS</th>
            </tr>
            <tr>
              <th style={{ width: '4%' }}>Sr</th>
              <th style={{ width: '16%' }}>Item Description</th>
              <th style={{ width: '7%' }}>Make</th>
              <th style={{ width: '7%' }}>Model</th>
              <th style={{ width: '5%' }}>Qty</th>
              <th style={{ width: '5%' }}>Unit</th>
              <th style={{ width: '9%' }}>Unit Rate (₹)</th>
              <th style={{ width: '8%' }}>Discount (₹)</th>
              <th style={{ width: '10%' }}>Taxable Value (₹)</th>
              <th style={{ width: '6%' }}>GST %</th>
              <th style={{ width: '10%' }}>GST Amount (₹)</th>
              <th style={{ width: '10%' }}>Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const taxable = lineTaxable(line);
              const computed = totals.lines[index] || {};
              const gstAmt = computed.taxAmount || 0;
              const total = computed.totalAmount || 0;
              const hasContent = Boolean(line.description || Number(line.qty) || Number(line.rate));
              return (
                <tr key={line.id || index}>
                  <td className="po-center">{index + 1}</td>
                  <td className="po-desc">
                    {editable ? (
                      <InlineTextarea
                        rows={2}
                        value={line.description || ''}
                        onChange={(v) => onUpdateLine?.(index, { description: v })}
                        placeholder="Item description"
                      />
                    ) : (
                      line.description
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <InlineTableInput value={line.make || ''} onChange={(v) => onUpdateLine?.(index, { make: v })} />
                    ) : (
                      line.make
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <InlineTableInput
                        value={line.model || ''}
                        onChange={(v) => onUpdateLine?.(index, { model: v })}
                      />
                    ) : (
                      line.model
                    )}
                  </td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={line.qty ?? ''}
                        onChange={(v) => onUpdateLine?.(index, { qty: Number(v) })}
                        align="center"
                      />
                    ) : (
                      line.qty
                    )}
                  </td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={line.unit || line.uom || ''}
                        onChange={(v) => onUpdateLine?.(index, { unit: v, uom: v })}
                        align="center"
                      />
                    ) : (
                      line.unit || line.uom
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.rate ?? ''}
                        onChange={(v) => onUpdateLine?.(index, { rate: Number(v) })}
                        align="right"
                      />
                    ) : hasContent ? (
                      money(line.rate)
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="po-num">
                    {editable ? (
                      <InlineTableInput
                        value={line.discount ?? ''}
                        onChange={(v) => onUpdateLine?.(index, { discount: Number(v) })}
                        align="right"
                      />
                    ) : hasContent ? (
                      money(line.discount)
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="po-num">{hasContent ? money(taxable) : ''}</td>
                  <td className="po-center">
                    {editable ? (
                      <InlineTableInput
                        value={getLineGstRateDisplay(line, taxMode)}
                        onChange={(v) => onUpdateLine?.(index, patchLineGstRate(v, taxMode))}
                        align="center"
                      />
                    ) : hasContent ? (
                      getLineGstRateDisplay(line, taxMode) || '0'
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="po-num">{hasContent ? money(gstAmt) : ''}</td>
                  <td className="po-num">{hasContent ? money(total) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {editable && filledCount < MAX_PO_LINE_ITEMS ? (
          <div className="po-add-row">
            <InlineAddChip label="Add item row" onClick={() => onAddLine?.()} />
          </div>
        ) : null}

        <div className="po-words-total">
          <div className="po-words-total__left">
            <div className="po-amount-words">
              <strong>Amount In Words:</strong> Rupees {words || '____________________ Only.'}
            </div>
          </div>
          <div className="po-card po-card--totals">
            <div className="po-card-body po-card-body--totals">
              <div className="po-totals-row">
                <span className="po-totals-row__label">Taxable Value</span>
                <span className="po-totals-row__value">{money(totals.subtotal)}</span>
              </div>
              <div className="po-totals-row">
                <span className="po-totals-row__label">Total GST</span>
                <span className="po-totals-row__value">{money(totals.taxAmount)}</span>
              </div>
              <div className="po-totals-row">
                <span className="po-totals-row__label">Round Off</span>
                <span className="po-totals-row__value">{money(totals.roundOff)}</span>
              </div>
            </div>
            <div className="po-totals-grand">
              <span className="po-totals-grand__label">GRAND TOTAL</span>
              <span className="po-totals-grand__value">{money(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="po-sign">
          <div className="po-sign-box">
            <p className="po-sign-for">For {signature?.companyLabel || legal}</p>
            <div className="po-sign-line" />
            <p className="po-sign-label">Authorised Signatory</p>
          </div>
        </div>
      </article>
    </div>
  );
}
