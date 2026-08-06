import { formatDisplayDate } from '../invoiceGenerator/invoiceCalculations.js';
import { InlineAddChip, InlineField, InlineTableInput, InlineTextarea } from '../documentGenerator/inlineEdit.jsx';
import '../documentGenerator/inline-edit.css';
import {
  defaultDeliveryChallanLine,
  DELIVERY_CHALLAN_DECLARATION,
  MAX_DELIVERY_CHALLAN_LINE_ITEMS,
} from './deliveryChallanStorage.js';
import './delivery-challan.css';

function MetaCell({ label, children }) {
  return (
    <td>
      <span className="dc-meta-label">{label}</span>
      <span className="dc-meta-value">{children}</span>
    </td>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="dc-field-row">
      <span className="dc-field-label">{label}</span>
      <div className="dc-field-value">{children}</div>
    </div>
  );
}

function Val({ editable, value, onChange, type = 'text', placeholder = '—' }) {
  if (editable) {
    return <InlineField type={type} value={value || ''} onChange={onChange} placeholder={placeholder} />;
  }
  if (type === 'date') return formatDisplayDate(value) || placeholder;
  return value || placeholder;
}

export default function DeliveryChallanPreview({
  form,
  previewRef,
  editable = false,
  onUpdate,
  onUpdateLine,
  onAddLine,
}) {
  const { company, invoice, from, deliverTo, courier, dispatch, acknowledgement } = form;
  const hasLogo = Boolean(company?.logoDataUrl);
  const legal = company?.legalName || 'Tylo Care Private Limited';
  const lines = Array.from({ length: MAX_DELIVERY_CHALLAN_LINE_ITEMS }, (_, i) =>
    form.lineItems?.[i] ? form.lineItems[i] : defaultDeliveryChallanLine()
  );
  const filledCount = (form.lineItems || []).filter(
    (row) => row.assetId || row.description || row.manufacturerSerialNo || row.qty
  ).length;

  return (
    <div ref={previewRef} className="dc-print-root">
      <article className="dc-doc" aria-label="Delivery Challan">
        <header className="dc-header">
          <div>
            {hasLogo ? (
              <img src={company.logoDataUrl} alt={legal} className="dc-logo" />
            ) : (
              <div className="dc-logo-fallback">
                <span className="dc-logo-text">TYLO</span>
                <span className="dc-tagline">{company?.brandLine || '— Bringing Healthcare Closer —'}</span>
              </div>
            )}
          </div>
          <h1 className="dc-title">DELIVERY CHALLAN</h1>
        </header>

        <table className="dc-grid">
          <tbody>
            <tr>
              <MetaCell label="Delivery Challan No.">
                {invoice?.documentNumber || (editable ? 'Assigned on approval' : '—')}
              </MetaCell>
              <MetaCell label="Delivery Challan Date">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.issueDate}
                  onChange={(v) => onUpdate?.('invoice.issueDate', v)}
                />
              </MetaCell>
            </tr>
            <tr>
              <MetaCell label="Dispatch Date">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.dispatchDate}
                  onChange={(v) => onUpdate?.('invoice.dispatchDate', v)}
                />
              </MetaCell>
              <MetaCell label="Expected Delivery Date">
                <Val
                  editable={editable}
                  type="date"
                  value={invoice?.expectedDeliveryDate}
                  onChange={(v) => onUpdate?.('invoice.expectedDeliveryDate', v)}
                />
              </MetaCell>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>FROM</th>
              <th style={{ width: '50%' }}>DELIVER TO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dc-party-body">
                <FieldRow label="Company Name">
                  <Val
                    editable={editable}
                    value={from?.companyName || legal}
                    onChange={(v) => onUpdate?.('from.companyName', v)}
                  />
                </FieldRow>
                <FieldRow label="Registered Office">
                  {editable ? (
                    <InlineTextarea
                      value={from?.address || ''}
                      onChange={(v) => onUpdate?.('from.address', v)}
                      rows={2}
                    />
                  ) : (
                    from?.address || '—'
                  )}
                </FieldRow>
                <FieldRow label="GSTIN">
                  <Val editable={editable} value={from?.gstin} onChange={(v) => onUpdate?.('from.gstin', v)} />
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Val
                    editable={editable}
                    value={from?.contactPerson}
                    onChange={(v) => onUpdate?.('from.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val editable={editable} value={from?.mobile} onChange={(v) => onUpdate?.('from.mobile', v)} />
                </FieldRow>
                <FieldRow label="Email">
                  <Val editable={editable} value={from?.email} onChange={(v) => onUpdate?.('from.email', v)} />
                </FieldRow>
              </td>
              <td className="dc-party-body">
                <FieldRow label="Recipient Type">
                  <Val
                    editable={editable}
                    value={deliverTo?.recipientType}
                    onChange={(v) => onUpdate?.('deliverTo.recipientType', v)}
                  />
                </FieldRow>
                <FieldRow label="Name">
                  <Val
                    editable={editable}
                    value={deliverTo?.name}
                    onChange={(v) => onUpdate?.('deliverTo.name', v)}
                  />
                </FieldRow>
                <FieldRow label="Company (if applicable)">
                  <Val
                    editable={editable}
                    value={deliverTo?.company}
                    onChange={(v) => onUpdate?.('deliverTo.company', v)}
                  />
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Val
                    editable={editable}
                    value={deliverTo?.contactPerson}
                    onChange={(v) => onUpdate?.('deliverTo.contactPerson', v)}
                  />
                </FieldRow>
                <FieldRow label="Mobile">
                  <Val
                    editable={editable}
                    value={deliverTo?.mobile}
                    onChange={(v) => onUpdate?.('deliverTo.mobile', v)}
                  />
                </FieldRow>
                <FieldRow label="Address">
                  {editable ? (
                    <InlineTextarea
                      value={deliverTo?.address || ''}
                      onChange={(v) => onUpdate?.('deliverTo.address', v)}
                      rows={2}
                    />
                  ) : (
                    deliverTo?.address || '—'
                  )}
                </FieldRow>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>COURIER DETAILS</th>
              <th style={{ width: '50%' }}>PURPOSE OF MOVEMENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <FieldRow label="Courier Name">
                  <Val
                    editable={editable}
                    value={courier?.name}
                    onChange={(v) => onUpdate?.('courier.name', v)}
                  />
                </FieldRow>
                <FieldRow label="AWB / Consignment No.">
                  <Val
                    editable={editable}
                    value={courier?.awbNo}
                    onChange={(v) => onUpdate?.('courier.awbNo', v)}
                  />
                </FieldRow>
                <FieldRow label="Mode (Air / Surface)">
                  <Val
                    editable={editable}
                    value={courier?.mode}
                    onChange={(v) => onUpdate?.('courier.mode', v)}
                  />
                </FieldRow>
                <FieldRow label="No. of Packages">
                  <Val
                    editable={editable}
                    value={courier?.packageCount}
                    onChange={(v) => onUpdate?.('courier.packageCount', v)}
                  />
                </FieldRow>
                <FieldRow label="Origin / Dispatch City">
                  <Val
                    editable={editable}
                    value={courier?.originCity}
                    onChange={(v) => onUpdate?.('courier.originCity', v)}
                  />
                </FieldRow>
                <FieldRow label="Destination City">
                  <Val
                    editable={editable}
                    value={courier?.destinationCity}
                    onChange={(v) => onUpdate?.('courier.destinationCity', v)}
                  />
                </FieldRow>
              </td>
              <td className="dc-purpose-cell">
                {editable ? (
                  <InlineTextarea
                    value={form.purposeOfMovement || ''}
                    onChange={(v) => onUpdate?.('purposeOfMovement', v)}
                    rows={6}
                    placeholder="Purpose of movement…"
                  />
                ) : (
                  form.purposeOfMovement || '—'
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid dc-items">
          <thead>
            <tr>
              <th colSpan={10}>ITEM DETAILS</th>
            </tr>
            <tr>
              <th style={{ width: '4%' }}>Sr</th>
              <th style={{ width: '9%' }}>Asset ID</th>
              <th style={{ width: '16%' }}>Description</th>
              <th style={{ width: '8%' }}>Make</th>
              <th style={{ width: '8%' }}>Model</th>
              <th style={{ width: '12%' }}>Manufacturer Serial No.</th>
              <th style={{ width: '5%' }}>Qty</th>
              <th style={{ width: '12%' }}>Accessories Supplied</th>
              <th style={{ width: '10%' }}>Condition</th>
              <th style={{ width: '10%' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="dc-center">{index + 1}</td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.assetId || ''}
                      onChange={(v) => onUpdateLine?.(index, { assetId: v })}
                    />
                  ) : (
                    line.assetId
                  )}
                </td>
                <td className="dc-desc">
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
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.manufacturerSerialNo || ''}
                      onChange={(v) => onUpdateLine?.(index, { manufacturerSerialNo: v })}
                    />
                  ) : (
                    line.manufacturerSerialNo
                  )}
                </td>
                <td className="dc-center">
                  {editable ? (
                    <InlineTableInput
                      value={line.qty ?? ''}
                      onChange={(v) => onUpdateLine?.(index, { qty: v })}
                      align="center"
                    />
                  ) : (
                    line.qty
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.accessories || ''}
                      onChange={(v) => onUpdateLine?.(index, { accessories: v })}
                    />
                  ) : (
                    line.accessories
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.condition || ''}
                      onChange={(v) => onUpdateLine?.(index, { condition: v })}
                    />
                  ) : (
                    line.condition
                  )}
                </td>
                <td>
                  {editable ? (
                    <InlineTableInput
                      value={line.remarks || ''}
                      onChange={(v) => onUpdateLine?.(index, { remarks: v })}
                    />
                  ) : (
                    line.remarks
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && filledCount < MAX_DELIVERY_CHALLAN_LINE_ITEMS ? (
          <div className="dc-add-row">
            <InlineAddChip label="Add item row" onClick={() => onAddLine?.()} />
          </div>
        ) : null}

        <table className="dc-grid">
          <thead>
            <tr>
              <th>DECLARATION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dc-declaration">{form.declaration || DELIVERY_CHALLAN_DECLARATION}</td>
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th colSpan={3}>DISPATCH DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {[
                ['Packed By', 'dispatch.packedBy', dispatch?.packedBy],
                ['Checked By', 'dispatch.checkedBy', dispatch?.checkedBy],
                ['Dispatched By', 'dispatch.dispatchedBy', dispatch?.dispatchedBy],
              ].map(([label, path, value]) => (
                <td key={path} style={{ width: '33.33%' }}>
                  <div className="dc-sig-label">{label}</div>
                  <div className="dc-sig-value">
                    <Val editable={editable} value={value} onChange={(v) => onUpdate?.(path, v)} />
                  </div>
                  <div className="dc-sig-label">Signature</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <table className="dc-grid">
          <thead>
            <tr>
              <th colSpan={3}>RECEIVER ACKNOWLEDGEMENT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ width: '36%' }}>
                <div className="dc-sig-label">Received By</div>
                <div className="dc-sig-value">
                  <Val
                    editable={editable}
                    value={acknowledgement?.receivedBy}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedBy', v)}
                  />
                </div>
              </td>
              <td style={{ width: '36%' }}>
                <div className="dc-sig-label">Mobile</div>
                <div className="dc-sig-value">
                  <Val
                    editable={editable}
                    value={acknowledgement?.receivedMobile}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedMobile', v)}
                  />
                </div>
              </td>
              <td rowSpan={2} className="dc-qr" style={{ width: '28%' }}>
                QR CODE
                <br />
                (Future Use)
              </td>
            </tr>
            <tr>
              <td>
                <div className="dc-sig-label">Condition on Receipt</div>
                <div className="dc-sig-value">
                  <Val
                    editable={editable}
                    value={acknowledgement?.conditionOnReceipt}
                    onChange={(v) => onUpdate?.('acknowledgement.conditionOnReceipt', v)}
                  />
                </div>
              </td>
              <td>
                <div className="dc-sig-label">Date</div>
                <div className="dc-sig-value">
                  <Val
                    editable={editable}
                    type="date"
                    value={acknowledgement?.receivedDate}
                    onChange={(v) => onUpdate?.('acknowledgement.receivedDate', v)}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}
