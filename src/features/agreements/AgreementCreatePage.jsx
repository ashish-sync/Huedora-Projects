import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiFetch } from '../../shared/api.js';
import { CONTACT_CATEGORIES, RESOURCE_TYPES, SUPPLY_CATEGORIES, professionsForCategory, professionPicklistKey } from './contactPicklists.js';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { MODULE } from '../../shared/labels.js';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';

const emptyContact = {
  name: '',
  email: '',
  contactCategory: '',
  resourceType: '',
  profession: '',
  organization: '',
  supplyCategory: '',
  contact: '',
  state: '',
  city: '',
  district: '',
  stateId: '',
  districtId: '',
  cityId: '',
};

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchPdfBlobUrl(previewPath) {
  const res = await apiFetch(previewPath);
  if (!res.ok) throw new Error('Could not load PDF preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function typeLabelBadge(t) {
  const map = {
    LEASE: 'Lease',
    TEMPORARY_OWNERSHIP: 'Temporary ownership',
    LETTER: 'Letter',
    OTHER: 'Other',
  };
  return map[t.documentType || t.agreementType] || 'Template';
}

export default function AgreementCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [contactQ, setContactQ] = useState('');
  const [recipientMode, setRecipientMode] = useState('directory');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [newContact, setNewContact] = useState(emptyContact);
  const [deliverEmail, setDeliverEmail] = useState(true);
  const [deliverSms, setDeliverSms] = useState(false);

  const professionPicklistKeyValue = professionPicklistKey(newContact.contactCategory);
  const professionFallback = professionsForCategory(newContact.contactCategory);
  const { options: resourceTypeOptions } = usePicklistOptions(
    'contact.resourceType',
    RESOURCE_TYPES
  );
  const { options: supplyCategoryOptions } = usePicklistOptions(
    'contact.supplyCategory',
    SUPPLY_CATEGORIES
  );
  const { options: professionOptions } = usePicklistOptions(
    professionPicklistKeyValue,
    professionFallback
  );

  const [templates, setTemplates] = useState([]);
  const [docMode, setDocMode] = useState('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('LEASE');
  const [startDate, setStartDate] = useState(() => todayISODate());
  const [hasExpiry, setHasExpiry] = useState(false);
  const [endDate, setEndDate] = useState('');

  const [placeholderValues, setPlaceholderValues] = useState({});
  const [previewToken, setPreviewToken] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const loadContacts = (q = '') => {
    const params = q ? `?q=${encodeURIComponent(q)}&limit=100` : '?limit=100';
    return api(`/contacts${params}`).then((r) => setContacts(r.data));
  };

  useEffect(() => {
    loadContacts().catch((e) => setError(e.message));
    api('/templates?limit=50')
      .then((r) => {
        setTemplates(r.data);
        if (r.data[0]) setSelectedTemplateId(r.data[0]._id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c._id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t._id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const placeholders = selectedTemplate?.placeholders || [];
  const hasPlaceholders = docMode === 'template' && placeholders.length > 0;

  useEffect(() => {
    if (selectedTemplate && docMode === 'template') {
      setTitle(selectedTemplate.name);
      setType(selectedTemplate.agreementType || 'LEASE');
      const next = {};
      (selectedTemplate.placeholders || []).forEach((p) => {
        next[p.key] = '';
      });
      setPlaceholderValues(next);
      setPreviewToken('');
      setPdfUrl('');
    }
  }, [selectedTemplate, docMode]);

  const recipientPerson = useMemo(() => {
    if (recipientMode === 'directory') return selectedContact;
    return newContact.name ? newContact : null;
  }, [recipientMode, selectedContact, newContact]);

  const recipientReady = () => {
    if (recipientMode === 'directory') return Boolean(selectedContactId);
    if (!newContact.name || !(newContact.email || newContact.contact)) return false;
    if (!newContact.contactCategory) return false;
    if (newContact.contactCategory === 'Resource' && !newContact.resourceType) return false;
    if (newContact.contactCategory === 'Client' && !String(newContact.organization || '').trim()) {
      return false;
    }
    if (newContact.contactCategory === 'Vendor' && !newContact.supplyCategory) return false;
    return true;
  };

  const documentReady = () => {
    if (docMode === 'template') return Boolean(selectedTemplateId && title);
    return Boolean(uploadFile && title);
  };

  const datesReady = () => {
    if (!startDate) return false;
    if (hasExpiry && !endDate) return false;
    if (hasExpiry && endDate && startDate && endDate < startDate) return false;
    return true;
  };

  const seedPlaceholdersFromRecipient = () => {
    if (!hasPlaceholders) return;
    const person = recipientMode === 'directory' ? selectedContact : newContact;
    if (!person?.name) return;
    setPlaceholderValues((prev) => {
      const next = { ...prev };
      (selectedTemplate?.placeholders || []).forEach((p) => {
        const key = String(p.key || p.label || '').toLowerCase();
        const label = String(p.label || '').toLowerCase();
        const isNameField =
          key === 'name' ||
          label === 'name' ||
          key.includes('signer') ||
          key.includes('recipient') ||
          key.includes('party') ||
          label.includes('signer') ||
          label.includes('recipient');
        if (isNameField && !String(next[p.key] || '').trim()) {
          next[p.key] = person.name;
        }
        if (
          (key === 'email' || label === 'email') &&
          person.email &&
          !String(next[p.key] || '').trim()
        ) {
          next[p.key] = person.email;
        }
      });
      return next;
    });
  };

  const appendRecipientFields = (fd) => {
    if (recipientMode === 'directory') {
      fd.append('contactId', selectedContactId);
    } else {
      fd.append('contactName', newContact.name);
      fd.append('contactEmail', newContact.email);
      fd.append('contactMobile', newContact.contact);
      fd.append('contactCategory', newContact.contactCategory);
      fd.append('resourceType', newContact.resourceType);
      fd.append('profession', newContact.profession);
      fd.append('organization', newContact.organization || '');
      fd.append('supplyCategory', newContact.supplyCategory || '');
      fd.append('contactState', newContact.state);
      fd.append('contactCity', newContact.city);
      fd.append('contactDistrict', newContact.district || '');
      fd.append('saveContact', 'true');
    }
    fd.append('deliverEmail', String(deliverEmail));
    fd.append('deliverSms', String(deliverSms));
    fd.append('title', title);
    fd.append('type', type);
    if (startDate) fd.append('startDate', startDate);
    if (hasExpiry && endDate) fd.append('endDate', endDate);
  };

  const goNext = () => {
    setError('');
    if (step === 1 && !recipientReady()) {
      setError('Select a contact from the directory or create a new one with name and email/contact.');
      return;
    }
    if (step === 1) {
      const email = recipientMode === 'directory' ? selectedContact?.email : newContact.email;
      const mobile =
        recipientMode === 'directory'
          ? selectedContact?.contact || selectedContact?.mobile
          : newContact.contact;
      setDeliverEmail(Boolean(email));
      setDeliverSms(Boolean(mobile) && !email ? true : deliverSms);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!documentReady()) {
        setError('Choose a template or upload a file, and provide a title.');
        return;
      }
      if (!datesReady()) {
        setError(
          hasExpiry && endDate && endDate < startDate
            ? 'End date must be on or after the start date.'
            : 'Set a start date. If the document expires, also choose an end date.'
        );
        return;
      }
      if (hasPlaceholders) {
        seedPlaceholdersFromRecipient();
        setStep(3);
        return;
      }
      submit();
    }
  };

  const generatePreview = async () => {
    setError('');
    if (!selectedTemplateId) return;
    const missing = placeholders.filter((p) => !String(placeholderValues[p.key] || '').trim());
    if (missing.length) {
      setError(`Fill all fields: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api(`/templates/${selectedTemplateId}/fill-preview`, {
        method: 'POST',
        body: { values: placeholderValues, title },
      });
      setPreviewToken(data.previewToken);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = await fetchPdfBlobUrl(data.previewUrl);
      setPdfUrl(url);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    if (!documentReady()) {
      setError('Choose a template or upload a PDF/Word file, and provide a title.');
      return;
    }
    if (!datesReady()) {
      setError(
        hasExpiry && endDate && endDate < startDate
          ? 'End date must be on or after the start date.'
          : 'Set a start date. If the document expires, also choose an end date.'
      );
      return;
    }
    if (hasPlaceholders && !previewToken) {
      setError('Fill placeholders and preview the PDF before creating.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      appendRecipientFields(fd);
      fd.append('documentSource', docMode === 'template' ? 'TEMPLATE' : 'UPLOAD');

      if (docMode === 'template') {
        fd.append('templateId', selectedTemplateId);
        if (previewToken) {
          fd.append('previewToken', previewToken);
        } else if (selectedTemplate?.bodyHtml) {
          fd.append('bodyHtml', selectedTemplate.bodyHtml);
        }
      } else if (uploadFile) {
        fd.append('file', uploadFile);
      }

      const { data } = await api('/agreements', { method: 'POST', body: fd });
      navigate(`/agreements/${data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="esign-shell">
      <div className="esign-top">
        <div>
          <p className="eyebrow">
            <Link to="/agreements">{MODULE.DOCUMENT_HUB}</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>New document</span>
          </p>
          <h1>Send a document</h1>
          <p className="muted esign-sub">
            Select the recipient, then choose a template or document from {MODULE.DOCUMENT_MASTER}.{' '}
            <Link to="/agreements/contacts">{MODULE.CONTACT_DIRECTORY}</Link>
            {' · '}
            <Link to="/agreements/document-master">{MODULE.DOCUMENT_MASTER}</Link>
          </p>
        </div>
      </div>

      <div className="wizard-steps" aria-label="Progress">
        <div className={`wizard-step ${step === 1 ? 'is-active' : ''} ${step > 1 ? 'is-done' : ''}`}>
          <span className="wizard-num">1</span>
          <div>
            <strong>Signer / recipient</strong>
            <small>Who receives and signs</small>
          </div>
        </div>
        <div className="wizard-rail" />
        <div className={`wizard-step ${step === 2 ? 'is-active' : ''} ${step > 2 ? 'is-done' : ''}`}>
          <span className="wizard-num">2</span>
          <div>
            <strong>Document</strong>
            <small>Upload or template library</small>
          </div>
        </div>
        {(hasPlaceholders || step >= 3) && (
          <>
            <div className="wizard-rail" />
            <div className={`wizard-step ${step === 3 ? 'is-active' : ''} ${step > 3 ? 'is-done' : ''}`}>
              <span className="wizard-num">3</span>
              <div>
                <strong>Placeholders</strong>
                <small>Fill merge fields</small>
              </div>
            </div>
            <div className="wizard-rail" />
            <div className={`wizard-step ${step === 4 ? 'is-active' : ''}`}>
              <span className="wizard-num">4</span>
              <div>
                <strong>PDF preview</strong>
                <small>Non-editable before send</small>
              </div>
            </div>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {step === 1 && (
        <div className="wizard-grid">
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Who receives and signs?</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              The name you select is the person the document is sent to. They are the signer (or
              acknowledger) for this envelope.
            </p>
            <div className="esign-sign-modes" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn secondary ${recipientMode === 'directory' ? 'is-selected' : ''}`}
                onClick={() => setRecipientMode('directory')}
              >
                Contact directory
              </button>
              <button
                type="button"
                className={`btn secondary ${recipientMode === 'new' ? 'is-selected' : ''}`}
                onClick={() => setRecipientMode('new')}
              >
                Create new signer
              </button>
            </div>

            {recipientMode === 'directory' ? (
              <>
                <div className="row" style={{ marginBottom: '0.75rem' }}>
                  <input
                    className="esign-search"
                    placeholder="Search name, email, contact, profession, city…"
                    value={contactQ}
                    onChange={(e) => setContactQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadContacts(contactQ)}
                  />
                  <button className="btn secondary" type="button" onClick={() => loadContacts(contactQ)}>
                    Search
                  </button>
                </div>
                <div className="contact-list">
                  {contacts.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      className={`contact-item ${selectedContactId === c._id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedContactId(c._id)}
                    >
                      <strong>{c.name}</strong>
                      <span>{[c.email, c.contact || c.mobile].filter(Boolean).join(' · ') || 'No delivery details'}</span>
                      <span className="muted">
                        {[
                          c.contactCategory,
                          c.profession,
                          c.organization || c.supplyCategory || c.resourceType,
                          c.city,
                          c.state,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                      </span>
                    </button>
                  ))}
                  {!contacts.length && <p className="muted">No contacts yet. Create a new contact.</p>}
                </div>
              </>
            ) : (
              <div>
                <p className="muted" style={{ marginTop: 0 }}>
                  New contacts are saved to the directory for future use.
                </p>
                <div className="field">
                  <label>Contact Category *</label>
                  <AdaptiveSelect
                    required
                    value={newContact.contactCategory}
                    onChange={(e) => {
                      const contactCategory = e.target.value;
                      const nextProfessions = professionsForCategory(contactCategory);
                      setNewContact({
                        ...newContact,
                        contactCategory,
                        resourceType: contactCategory === 'Resource' ? newContact.resourceType : '',
                        organization: contactCategory === 'Client' ? newContact.organization : '',
                        supplyCategory:
                          contactCategory === 'Vendor' &&
                          SUPPLY_CATEGORIES.includes(newContact.supplyCategory)
                            ? newContact.supplyCategory
                            : '',
                        profession: nextProfessions.includes(newContact.profession)
                          ? newContact.profession
                          : '',
                      });
                    }}
                  >
                    <option value="">Select…</option>
                    {CONTACT_CATEGORIES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                {newContact.contactCategory === 'Resource' && (
                  <div className="field">
                    <label>Resource Type *</label>
                    <OtherAwareSelect
                      required
                      picklistKey="contact.resourceType"
                      source="agreement-create"
                      options={resourceTypeOptions}
                      value={newContact.resourceType}
                      onChange={(e) => setNewContact({ ...newContact, resourceType: e.target.value })}
                    />
                  </div>
                )}
                {newContact.contactCategory === 'Client' && (
                  <div className="field">
                    <label>Organization Name *</label>
                    <input
                      required
                      value={newContact.organization}
                      onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                    />
                  </div>
                )}
                {newContact.contactCategory === 'Vendor' && (
                  <div className="field">
                    <label>Supply Category *</label>
                    <OtherAwareSelect
                      required
                      picklistKey="contact.supplyCategory"
                      source="agreement-create"
                      options={supplyCategoryOptions}
                      value={newContact.supplyCategory}
                      onChange={(e) =>
                        setNewContact({ ...newContact, supplyCategory: e.target.value })
                      }
                    />
                  </div>
                )}
                <div className="field">
                  <label>Profession / Role</label>
                  <OtherAwareSelect
                    picklistKey={professionPicklistKeyValue}
                    source="agreement-create"
                    options={professionOptions}
                    value={newContact.profession}
                    onChange={(e) => setNewContact({ ...newContact, profession: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Name *</label>
                  <input
                    required
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Contact</label>
                  <input
                    value={newContact.contact}
                    onChange={(e) => setNewContact({ ...newContact, contact: e.target.value })}
                    placeholder="10-digit mobile"
                  />
                </div>
                <LocationCascade
                  showPin={false}
                  showDistrict={false}
                  value={newContact}
                  onChange={(loc) => setNewContact({ ...newContact, ...loc })}
                />
              </div>
            )}
          </section>

          <aside className="card">
            <h3>Selected signer</h3>
            {recipientPerson?.name ? (
              <div className="recipient-summary" style={{ marginBottom: '1rem' }}>
                <strong>{recipientPerson.name}</strong>
                <div className="muted">{recipientPerson.email || 'No email'}</div>
                <div className="muted">
                  {recipientPerson.contact || recipientPerson.mobile || 'No mobile'}
                </div>
                <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                  This person will receive the document and complete Sign / I acknowledge.
                </p>
              </div>
            ) : (
              <p className="muted">Select a name from the directory or create a new signer.</p>
            )}
            <h3>Delivery</h3>
            <p className="muted">Send the document to this person by:</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={deliverEmail}
                onChange={(e) => setDeliverEmail(e.target.checked)}
              />
              Email
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={deliverSms}
                onChange={(e) => setDeliverSms(e.target.checked)}
              />
              SMS
            </label>
            <div className="wizard-actions">
              <Link className="btn secondary" to="/agreements">Cancel</Link>
              <button className="btn" type="button" onClick={goNext}>
                Continue to document →
              </button>
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-grid">
          <section className="card">
            <div className="esign-sign-modes" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn secondary ${docMode === 'template' ? 'is-selected' : ''}`}
                onClick={() => setDocMode('template')}
              >
                Template library
              </button>
              <button
                type="button"
                className={`btn secondary ${docMode === 'upload' ? 'is-selected' : ''}`}
                onClick={() => setDocMode('upload')}
              >
                Upload document
              </button>
            </div>

            {docMode === 'template' ? (
              <div className="template-list">
                {templates.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    className={`template-item ${selectedTemplateId === t._id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedTemplateId(t._id)}
                  >
                    <strong>{t.name}</strong>
                    <span className="muted">{t.description}</span>
                    <span className="badge">{typeLabelBadge(t)}</span>
                    <span className="badge">{t.signingType === 'NON_SIGNING' ? 'Non-signing' : 'Signing'}</span>
                    {(t.placeholders || []).length > 0 && (
                      <span className="badge tone-ok">{(t.placeholders || []).length} fields</span>
                    )}
                  </button>
                ))}
                {!templates.length && <p className="muted">No templates available.</p>}
                {selectedTemplate && (
                  <pre className="template-preview">{(selectedTemplate.bodyHtml || '').slice(0, 900)}{(selectedTemplate.bodyHtml || '').length > 900 ? '…' : ''}</pre>
                )}
              </div>
            ) : (
              <div>
                <p className="muted">Upload an existing PDF or Word document (no merge fields).</p>
                <FilePicker
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
                  }}
                />
              </div>
            )}
          </section>

          <aside className="card">
            <h3>Document details</h3>
            <div className="field">
              <label>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label>Agreement type</label>
              <AdaptiveSelect value={type} onChange={(e) => setType(e.target.value)}>
                <option value="LEASE">Lease</option>
                <option value="TEMPORARY_OWNERSHIP">Temporary ownership</option>
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label htmlFor="agr-start-date">Start date</label>
              <input
                id="agr-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                Defaults to today. Change only if the agreement starts on another day.
              </span>
            </div>

            <div className="field">
              <label>Should this document expire?</label>
              <div className="esign-sign-modes" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className={`btn secondary ${!hasExpiry ? 'is-selected' : ''}`}
                  onClick={() => {
                    setHasExpiry(false);
                    setEndDate('');
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  className={`btn secondary ${hasExpiry ? 'is-selected' : ''}`}
                  onClick={() => setHasExpiry(true)}
                >
                  Yes
                </button>
              </div>
            </div>

            {hasExpiry && (
              <div className="field">
                <label htmlFor="agr-end-date">End date *</label>
                <input
                  id="agr-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="recipient-summary">
              <h4>Receives &amp; signs</h4>
              {recipientMode === 'directory' && selectedContact ? (
                <>
                  <strong>{selectedContact.name}</strong>
                  <div className="muted">{selectedContact.email || '-'}</div>
                  <div className="muted">{selectedContact.contact || selectedContact.mobile || '-'}</div>
                </>
              ) : (
                <>
                  <strong>{newContact.name}</strong>
                  <div className="muted">{newContact.email || '-'}</div>
                  <div className="muted">{newContact.contact || '-'}</div>
                </>
              )}
              <div className="muted" style={{ marginTop: 6 }}>
                Deliver via {[deliverEmail && 'Email', deliverSms && 'SMS'].filter(Boolean).join(' + ') || 'none'}
              </div>
            </div>

            <div className="wizard-actions">
              <button className="btn secondary" type="button" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn" type="button" disabled={busy} onClick={goNext}>
                {busy
                  ? 'Working…'
                  : hasPlaceholders
                    ? 'Continue to placeholders →'
                    : 'Create draft'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="card ph-step-card">
          <div className="ph-step-head">
            <h3 style={{ margin: 0 }}>Fill placeholders</h3>
          </div>

          <div className="ph-step-fields">
            {placeholders.map((p) => (
              <div className="field ph-field" key={`${p.key}-${p.occurrence || 0}`}>
                <label htmlFor={`ph-${p.key}`}>{p.label}</label>
                <input
                  id={`ph-${p.key}`}
                  required
                  inputMode={p.type === 'number' ? 'decimal' : 'text'}
                  pattern={
                    p.type === 'name'
                      ? "[A-Za-z][A-Za-z .'-]*"
                      : p.type === 'number'
                        ? '[0-9]+([.,][0-9]+)?'
                        : p.type === 'alphanumeric'
                          ? '[A-Za-z0-9][A-Za-z0-9 ._-]*'
                          : undefined
                  }
                  title={
                    p.type === 'name'
                      ? 'Letters only'
                      : p.type === 'number'
                        ? 'Numbers only'
                        : p.type === 'alphanumeric'
                          ? 'Letters and numbers'
                          : undefined
                  }
                  value={placeholderValues[p.key] || ''}
                  onChange={(e) =>
                    setPlaceholderValues({ ...placeholderValues, [p.key]: e.target.value })
                  }
                />
              </div>
            ))}
            {!placeholders.length && <p className="muted">No placeholders on this template.</p>}
          </div>

          <div className="wizard-actions ph-step-actions">
            <button className="btn secondary" type="button" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button className="btn" type="button" disabled={busy} onClick={generatePreview}>
              {busy ? 'Building…' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="esign-doc-view">
          <section className="card esign-pdf-panel">
            <div className="esign-pdf-toolbar">
              <div>
                <strong>Document preview</strong>
                <p className="muted" style={{ margin: '2px 0 0' }}>
                  Review the filled PDF. Sender (left) and Receiver (right) slots appear on every page.
                </p>
              </div>
              <div className="row">
                <button className="btn secondary" type="button" onClick={() => setStep(3)}>
                  ← Edit fields
                </button>
                <button className="btn" type="button" disabled={busy || !previewToken} onClick={submit}>
                  {busy ? 'Creating…' : 'Create draft'}
                </button>
              </div>
            </div>
            {pdfUrl ? (
              <iframe title="PDF preview" className="pdf-preview-frame esign-pdf-frame" src={pdfUrl} />
            ) : (
              <p className="muted">Preview not loaded.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
