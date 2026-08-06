import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiFetch } from '../../shared/api.js';
import { CONTACT_CATEGORIES, HCW_RESOURCE_TYPES, RESOURCE_TYPES, SUPPLY_CATEGORIES, professionsForCategory, professionPicklistKey, resourceTypesForCategory, isHcwStaffResourceType } from './contactPicklists.js';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { MODULE } from '../../shared/labels.js';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import AssetRegistrySearchInput, {
  AssetRegistryPickerSummary,
} from './AssetRegistrySearchInput.jsx';
import {
  applyAssetSnapshotToPlaceholders,
  isAssetRegistryPlaceholder,
  placeholderAssetField,
} from './assetPlaceholderFields.js';

const emptyContact = {
  name: '',
  email: '',
  contactCategory: '',
  resourceType: '',
  serviceProviderContactId: '',
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
  const [searchParams] = useSearchParams();
  const linkAssetId = String(searchParams.get('assetId') || '').trim();
  const [linkAsset, setLinkAsset] = useState(null);
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
  const { options: hcwResourceTypeOptions } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES
  );
  const isHcwContact = newContact.contactCategory === 'Healthcare Worker';
  const categoryResourceTypes = resourceTypesForCategory(newContact.contactCategory);
  const resourceTypeChoices = (isHcwContact ? hcwResourceTypeOptions : resourceTypeOptions).filter(
    (o) => categoryResourceTypes.includes(o)
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
  const [lineRowsByTable, setLineRowsByTable] = useState({});
  const [selectedLinkAssetId, setSelectedLinkAssetId] = useState('');
  const [selectedAssetSnapshot, setSelectedAssetSnapshot] = useState(null);
  const [assetPickerQuery, setAssetPickerQuery] = useState('');
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

  useEffect(() => {
    if (!linkAssetId) return;
    api(`/assets/${linkAssetId}`)
      .then((r) => {
        const asset = r.data;
        if (!asset) return;
        setLinkAsset(asset);
        setSelectedLinkAssetId(linkAssetId);
        const contactId = asset.contactId?._id || asset.contactId;
        if (contactId) {
          setRecipientMode('directory');
          setSelectedContactId(String(contactId));
        }
        if (asset.deviceNameSnapshot) {
          setTitle((prev) => prev || `Agreement: ${asset.deviceNameSnapshot}`);
        }
      })
      .catch(() => {});
  }, [linkAssetId]);

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
  const repeatableTables = selectedTemplate?.repeatableTables || [];
  const hasLineTables = docMode === 'template' && repeatableTables.length > 0;
  const hasPlaceholders =
    docMode === 'template' && (placeholders.length > 0 || repeatableTables.length > 0);
  const assetPlaceholders = useMemo(
    () => placeholders.filter((p) => isAssetRegistryPlaceholder(p)),
    [placeholders]
  );

  useEffect(() => {
    if (selectedTemplate && docMode === 'template') {
      setTitle(selectedTemplate.name);
      setType(selectedTemplate.agreementType || 'LEASE');
      const next = {};
      (selectedTemplate.placeholders || []).forEach((p) => {
        next[p.key] = '';
      });
      setPlaceholderValues(next);
      const nextLines = {};
      (selectedTemplate.repeatableTables || []).forEach((table) => {
        const empty = {};
        (table.columns || []).forEach((col) => {
          empty[col.key] = '';
        });
        nextLines[table.id] = [empty];
      });
      setLineRowsByTable(nextLines);
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
    if (newContact.contactCategory === 'Healthcare Worker' && !newContact.resourceType) return false;
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

  const seedPlaceholdersFromAsset = async () => {
    const assetId = selectedLinkAssetId || linkAssetId;
    if (!assetId || !hasPlaceholders) return;
    try {
      const { data: snap } = await api(`/assets/${assetId}/placeholder-snapshot`);
      setSelectedAssetSnapshot(snap);
      setSelectedLinkAssetId(snap?.assetId || assetId);
      setPlaceholderValues((prev) => applyAssetSnapshotToPlaceholders(placeholders, snap, prev));
    } catch {
      /* optional prefill */
    }
  };

  const handleAssetSelected = (snapshot) => {
    if (!snapshot?.assetId) return;
    setSelectedAssetSnapshot(snapshot);
    setSelectedLinkAssetId(snapshot.assetId);
    setPlaceholderValues((prev) => applyAssetSnapshotToPlaceholders(placeholders, snapshot, prev));
  };

  const resolveLinkAssetId = async () => {
    const known = selectedLinkAssetId || linkAssetId;
    if (known) return known;
    const serialPh = placeholders.find((p) => placeholderAssetField(p) === 'serialNumber');
    const serial = serialPh ? String(placeholderValues[serialPh.key] || '').trim() : '';
    if (!serial) return '';
    try {
      const { data } = await api(`/assets?q=${encodeURIComponent(serial)}&limit=10`);
      const exact = (data || []).find((a) => String(a.serialNumber || '').trim() === serial);
      return exact?._id || '';
    } catch {
      return '';
    }
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

  const goNext = async () => {
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
      if (docMode === 'template' && selectedTemplateId) {
        seedPlaceholdersFromRecipient();
        seedPlaceholdersFromAsset();
        setBusy(true);
        try {
          const { data: fresh } = await api(`/templates/${selectedTemplateId}`);
          if (fresh) {
            setTemplates((prev) =>
              prev.map((t) => (t._id === fresh._id ? { ...t, ...fresh } : t))
            );
            const tables = fresh.repeatableTables || [];
            const docFields = fresh.placeholders || [];
            if (tables.length) {
              setLineRowsByTable((prev) => {
                const next = { ...prev };
                tables.forEach((table) => {
                  if (next[table.id]?.length) return;
                  const empty = {};
                  (table.columns || []).forEach((col) => {
                    empty[col.key] = '';
                  });
                  next[table.id] = [empty];
                });
                return next;
              });
            }
            if (!docFields.length && !tables.length) {
              await submit();
              return;
            }
          }
          setStep(3);
        } catch (err) {
          setError(err.message);
          if (hasPlaceholders) setStep(3);
          else await submit();
        } finally {
          setBusy(false);
        }
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
    for (const table of repeatableTables) {
      const rows = lineRowsByTable[table.id] || [];
      const minRows = Number(table.minRows) > 0 ? Number(table.minRows) : 1;
      if (rows.length < minRows) {
        setError(`Add at least ${minRows} line item${minRows === 1 ? '' : 's'}`);
        return;
      }
      for (let i = 0; i < rows.length; i += 1) {
        for (const col of table.columns || []) {
          if (!String(rows[i]?.[col.key] || '').trim()) {
            setError(`Fill Row ${i + 1} · ${col.label}`);
            return;
          }
        }
      }
    }
    setBusy(true);
    try {
      const { data } = await api(`/templates/${selectedTemplateId}/fill-preview`, {
        method: 'POST',
        body: { values: placeholderValues, lineRows: lineRowsByTable, title },
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

  const updateLineCell = (tableId, rowIndex, key, value) => {
    setLineRowsByTable((prev) => {
      const rows = [...(prev[tableId] || [])];
      rows[rowIndex] = { ...rows[rowIndex], [key]: value };
      return { ...prev, [tableId]: rows };
    });
  };

  const addLineRow = (table) => {
    const maxRows = Number(table.maxRows) > 0 ? Number(table.maxRows) : 20;
    setLineRowsByTable((prev) => {
      const rows = [...(prev[table.id] || [])];
      if (rows.length >= maxRows) return prev;
      const empty = {};
      (table.columns || []).forEach((col) => {
        empty[col.key] = '';
      });
      return { ...prev, [table.id]: [...rows, empty] };
    });
  };

  const removeLineRow = (table, rowIndex) => {
    const minRows = Number(table.minRows) > 0 ? Number(table.minRows) : 1;
    setLineRowsByTable((prev) => {
      const rows = [...(prev[table.id] || [])];
      if (rows.length <= minRows) return prev;
      rows.splice(rowIndex, 1);
      return { ...prev, [table.id]: rows };
    });
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
      const assetToLink = (await resolveLinkAssetId()) || linkAssetId || selectedLinkAssetId;
      if (assetToLink) {
        try {
          await api(`/agreements/${data._id}/assets`, {
            method: 'POST',
            body: { assetIds: [assetToLink] },
          });
        } catch {
          /* agreement created; asset link can be added from envelope detail */
        }
      }
      navigate(`/document-one/${data._id}`);
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
            <Link to="/document-one">{MODULE.DOCUMENT_HUB}</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>New document</span>
          </p>
          <h1>Send a document</h1>
          {linkAsset ? (
            <p className="muted esign-sub">
              Creating an agreement for{' '}
              <strong>{linkAsset.deviceNameSnapshot || linkAsset.serialNumber || 'asset'}</strong>
              {linkAsset.serialNumber ? ` · ${linkAsset.serialNumber}` : ''}. The asset will be
              linked when you finish.
            </p>
          ) : (
            <p className="muted esign-sub">
              Select the recipient, then choose a template or document from {MODULE.DOCUMENT_MASTER}.{' '}
              <Link to="/master-one?scope=document&entity=contacts">{MODULE.CONTACT_DIRECTORY}</Link>
              {' · '}
              <Link to="/master-one?scope=document&entity=templates">{MODULE.DOCUMENT_MASTER}</Link>
            </p>
          )}
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
                        resourceType:
                          contactCategory === 'Resource' &&
                          RESOURCE_TYPES.includes(newContact.resourceType)
                            ? newContact.resourceType
                            : contactCategory === 'Healthcare Worker' &&
                                HCW_RESOURCE_TYPES.includes(newContact.resourceType)
                              ? newContact.resourceType
                              : '',
                        serviceProviderContactId:
                          contactCategory === 'Healthcare Worker' &&
                          isHcwStaffResourceType(newContact.resourceType)
                            ? newContact.serviceProviderContactId
                            : '',
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
                {(newContact.contactCategory === 'Resource' ||
                  newContact.contactCategory === 'Healthcare Worker') && (
                  <div className="field">
                    <label>Resource Type *</label>
                    <OtherAwareSelect
                      required
                      picklistKey={
                        newContact.contactCategory === 'Healthcare Worker'
                          ? 'contact.hcwResourceType'
                          : 'contact.resourceType'
                      }
                      source="agreement-create"
                      options={resourceTypeChoices}
                      value={newContact.resourceType}
                      onChange={(e) =>
                        setNewContact({
                          ...newContact,
                          resourceType: e.target.value,
                          serviceProviderContactId: isHcwStaffResourceType(e.target.value)
                            ? newContact.serviceProviderContactId
                            : '',
                        })
                      }
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
              <Link className="btn secondary" to="/document-one">Cancel</Link>
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
                    {(t.repeatableTables || []).length > 0 && (
                      <span className="badge tone-ok">
                        {(t.repeatableTables || []).reduce(
                          (n, tbl) => n + (tbl.columns?.length || 0),
                          0
                        )}{' '}
                        line cols
                      </span>
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
            <div className="agr-start-date-field">
              <DateInput
                id="agr-start-date"
                label="Start date"
                value={startDate}
                onChange={setStartDate}
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
              <DateInput
                id="agr-end-date"
                label="End date *"
                required
                value={endDate}
                min={startDate || undefined}
                onChange={setEndDate}
              />
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
        <div className={`card ph-step-card${hasLineTables ? ' ph-step-card--wide' : ''}`}>
          <div className="ph-step-head">
            <h3 style={{ margin: 0 }}>Fill placeholders</h3>
            {assetPlaceholders.length > 0 && (
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Asset Name, Model, and Serial Number fields search the Asset Registry and auto-fill
                when you pick a match.
              </p>
            )}
            {hasLineTables ? (
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Line items use the template table row as a prototype. Add rows as needed; each is
                included in the PDF.
              </p>
            ) : null}
          </div>

          {assetPlaceholders.length > 0 && (
            <div className="field ph-field ph-asset-picker">
              <label htmlFor="ph-asset-picker">Link from Asset Registry</label>
              <AssetRegistrySearchInput
                id="ph-asset-picker"
                value={assetPickerQuery}
                onChange={setAssetPickerQuery}
                onSelectAsset={(snapshot) => {
                  handleAssetSelected(snapshot);
                  setAssetPickerQuery(snapshot.assetName || snapshot.serialNumber || '');
                }}
                placeholder="Search by asset name, model, or serial number…"
              />
              <AssetRegistryPickerSummary
                snapshot={selectedAssetSnapshot}
                onClear={() => {
                  setSelectedAssetSnapshot(null);
                  setSelectedLinkAssetId(linkAssetId || '');
                  setAssetPickerQuery('');
                }}
              />
            </div>
          )}

          <div className="ph-step-fields">
            {placeholders.map((p) => (
              <div className="field ph-field" key={`${p.key}-${p.occurrence || 0}`}>
                <label htmlFor={`ph-${p.key}`}>{p.label}</label>
                {isAssetRegistryPlaceholder(p) ? (
                  <AssetRegistrySearchInput
                    id={`ph-${p.key}`}
                    required
                    value={placeholderValues[p.key] || ''}
                    onChange={(v) =>
                      setPlaceholderValues({ ...placeholderValues, [p.key]: v })
                    }
                    onSelectAsset={handleAssetSelected}
                    placeholder={`Search ${p.label} in Asset Registry…`}
                  />
                ) : (
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
                )}
              </div>
            ))}
            {!placeholders.length && !hasLineTables && (
              <p className="muted">No placeholders on this template.</p>
            )}
          </div>

          {repeatableTables.map((table) => {
            const rows = lineRowsByTable[table.id] || [];
            const maxRows = Number(table.maxRows) > 0 ? Number(table.maxRows) : 20;
            const minRows = Number(table.minRows) > 0 ? Number(table.minRows) : 1;
            return (
              <div className="ph-line-table" key={table.id}>
                <div className="ph-line-table-head">
                  <h4>Line items</h4>
                  <span className="muted">
                    {rows.length} / {maxRows} rows
                  </span>
                </div>
                <div className="ph-line-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="ph-line-sr">#</th>
                        {(table.columns || []).map((col) => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                        <th className="ph-line-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={`${table.id}-${rowIndex}`}>
                          <td className="ph-line-sr">{rowIndex + 1}</td>
                          {(table.columns || []).map((col) => (
                            <td key={col.key}>
                              <input
                                required
                                inputMode={col.type === 'number' ? 'decimal' : 'text'}
                                value={row[col.key] || ''}
                                onChange={(e) =>
                                  updateLineCell(table.id, rowIndex, col.key, e.target.value)
                                }
                                aria-label={`Row ${rowIndex + 1} ${col.label}`}
                              />
                            </td>
                          ))}
                          <td className="ph-line-actions">
                            {rows.length > minRows ? (
                              <button
                                type="button"
                                className="btn secondary btn-sm"
                                onClick={() => removeLineRow(table, rowIndex)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length < maxRows ? (
                  <button type="button" className="btn secondary ph-line-add" onClick={() => addLineRow(table)}>
                    + Add row
                  </button>
                ) : null}
              </div>
            );
          })}

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
