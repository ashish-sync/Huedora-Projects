import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiFetch, apiUrl } from '../../shared/api.js';
import { CONTACT_CATEGORIES, HCW_RESOURCE_TYPES, RESOURCE_TYPES, SUPPLY_CATEGORIES, professionsForCategory, professionPicklistKey, resourceTypesForCategory, isHcwStaffResourceType } from './contactPicklists.js';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { MODULE } from '../../shared/labels.js';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import DocxNativePreview from '../../components/DocxNativePreview.jsx';
import AssetRegistrySearchInput from './AssetRegistrySearchInput.jsx';
import {
  applyAssetSnapshotToLineRows,
  applyAssetSnapshotToPlaceholders,
  isAssetRegistryPlaceholder,
  isDisplayNamePlaceholder,
  placeholderAssetField,
} from './assetPlaceholderFields.js';
import { isDatePlaceholder, defaultsToTodayPlaceholder, isTodayDatePlaceholder } from './datePlaceholderFields.js';
import { applyContactSnapshotToPlaceholders } from './contactPlaceholderFields.js';
import {
  collectLineSerialValues,
  collectUsedLineSerials,
  displayLineColumnLabel,
  findDuplicateLineSerial,
  isDeviceNameLineColumn,
  isHiddenLineValuePlaceholder,
  isSerialNumberLineColumn,
  lineColumnClass,
  mergeLineValuesIntoPlaceholders,
} from './serviceAgreementLineColumns.js';
import { LineDeviceNameCombobox, LineSerialCombobox } from './LineAssetCombobox.jsx';
import { agreementTitleToFileBase, buildAgreementDocumentTitle, downloadBlobWithName } from './documentFileName.js';

function isHiddenPlaceholderField(placeholder) {
  return (
    isTodayDatePlaceholder(placeholder) ||
    isDisplayNamePlaceholder(placeholder) ||
    isHiddenLineValuePlaceholder(placeholder)
  );
}

function namedFileFromBlob(blob, fileName, mimeType) {
  const type = mimeType || blob?.type || 'application/octet-stream';
  return new File([blob], fileName, { type });
}

async function fetchDocxFile(previewPath, fileName = 'document.docx') {
  const res = await apiFetch(previewPath);
  if (!res.ok) throw new Error('Could not load Word preview');
  const blob = await res.blob();
  return namedFileFromBlob(
    blob,
    fileName,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

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
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('LEASE');
  const [startDate, setStartDate] = useState(() => todayISODate());
  const [hasExpiry, setHasExpiry] = useState(false);
  const [endDate, setEndDate] = useState('');

  const [placeholderValues, setPlaceholderValues] = useState({});
  const [placeholderTouched, setPlaceholderTouched] = useState({});
  const [lineRowsByTable, setLineRowsByTable] = useState({});
  const [selectedLinkAssetId, setSelectedLinkAssetId] = useState('');
  const [selectedAssetSnapshot, setSelectedAssetSnapshot] = useState(null);
  const [previewToken, setPreviewToken] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [filledDocxBlob, setFilledDocxBlob] = useState(null);
  const [pdfEngine, setPdfEngine] = useState('');
  const [previewMode, setPreviewMode] = useState('word'); // word | pdf
  const lastPlaceholderTemplateId = useRef('');

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
  const visiblePlaceholders = useMemo(
    () => placeholders.filter((p) => !isHiddenPlaceholderField(p)),
    [placeholders]
  );
  const repeatableTables = selectedTemplate?.repeatableTables || [];
  const hasLineTables = repeatableTables.length > 0;
  const hasPlaceholders = visiblePlaceholders.length > 0 || repeatableTables.length > 0;

  useEffect(() => {
    if (!selectedTemplate) return;
    const templateId = selectedTemplate._id;
    const switched = lastPlaceholderTemplateId.current !== templateId;
    lastPlaceholderTemplateId.current = templateId;

    if (switched) {
      setTitle(selectedTemplate.name);
      setType(selectedTemplate.agreementType || 'LEASE');
      const next = {};
      (selectedTemplate.placeholders || []).forEach((p) => {
        next[p.key] = defaultsToTodayPlaceholder(p) ? todayISODate() : '';
      });
      setPlaceholderValues(next);
      setPlaceholderTouched({});
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
      setFilledDocxBlob(null);
      setPdfEngine('');
      setPreviewMode('word');
      return;
    }

    setPlaceholderValues((prev) => {
      const next = { ...prev };
      (selectedTemplate.placeholders || []).forEach((p) => {
        if (next[p.key] == null) {
          next[p.key] = defaultsToTodayPlaceholder(p) ? todayISODate() : '';
        }
      });
      return next;
    });
    setLineRowsByTable((prev) => {
      const next = { ...prev };
      (selectedTemplate.repeatableTables || []).forEach((table) => {
        if (next[table.id]?.length) return;
        const empty = {};
        (table.columns || []).forEach((col) => {
          empty[col.key] = '';
        });
        next[table.id] = [empty];
      });
      return next;
    });
  }, [selectedTemplate]);

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

  const documentReady = () => Boolean(selectedTemplateId && title);

  const datesReady = () => {
    if (!startDate) return false;
    if (hasExpiry && !endDate) return false;
    if (hasExpiry && endDate && startDate && endDate < startDate) return false;
    return true;
  };

  const touchedPlaceholderKeys = () =>
    new Set(Object.keys(placeholderTouched).filter((key) => placeholderTouched[key]));

  const updatePlaceholderValue = (key, value) => {
    setPlaceholderTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    setPlaceholderValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAssetSelected = (snapshot) => {
    if (!snapshot?.assetId) return;
    setSelectedAssetSnapshot(snapshot);
    setSelectedLinkAssetId(snapshot.assetId);
    setPlaceholderValues((prev) => applyAssetSnapshotToPlaceholders(placeholders, snapshot, prev));
    setLineRowsByTable((prev) => applyAssetSnapshotToLineRows(repeatableTables, snapshot, prev));
  };

  const resolveLinkAssetId = async () => {
    const known = selectedLinkAssetId || linkAssetId;
    if (known) return known;
    const serialPh = placeholders.find((p) => placeholderAssetField(p) === 'serialNumber');
    const serial = serialPh ? String(placeholderValues[serialPh.key] || '').trim() : '';
    if (!serial) return '';
    try {
      const { data } = await api(
        `/assets?q=${encodeURIComponent(serial)}&limit=10&availableForAgreement=1`
      );
      const exact = (data || []).find((a) => String(a.serialNumber || '').trim() === serial);
      return exact?._id || '';
    } catch {
      return '';
    }
  };

  const resolveLineAssetIds = async () => {
    const serials = collectLineSerialValues(lineRowsByTable, repeatableTables);
    const ids = [];
    const seen = new Set();
    for (const serial of serials) {
      try {
        const { data } = await api(
          `/assets?q=${encodeURIComponent(serial)}&limit=10&availableForAgreement=1`
        );
        const exact = (data || []).find(
          (a) => String(a.serialNumber || '').trim().toLowerCase() === serial.toLowerCase()
        );
        if (exact?._id && !seen.has(String(exact._id))) {
          seen.add(String(exact._id));
          ids.push(exact._id);
        }
      } catch {
        /* skip unresolved serial */
      }
    }
    return ids;
  };

  const assertUniqueLineSerials = () => {
    const dup = findDuplicateLineSerial(lineRowsByTable, repeatableTables);
    if (!dup) return true;
    setError(
      `Serial number “${dup.serial}” is already used on another line in this agreement. Each serial can only appear once.`
    );
    return false;
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
        setError('Choose a template and provide a title.');
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
      if (selectedTemplateId) {
        setBusy(true);
        try {
          let person = recipientPerson;
          if (recipientMode === 'directory' && selectedContactId) {
            try {
              const { data } = await api(`/contacts/${selectedContactId}`);
              if (data) person = data;
            } catch {
              /* use the directory row already in memory */
            }
          }

          const { data: fresh } = await api(`/templates/${selectedTemplateId}`);
          const tpl = fresh || selectedTemplate;
          if (fresh) {
            setTemplates((prev) =>
              prev.map((t) => (t._id === fresh._id ? { ...t, ...fresh } : t))
            );
            const tables = fresh.repeatableTables || [];
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
          }

          const docFields = tpl?.placeholders || [];
          const tables = tpl?.repeatableTables || [];
          const visibleDocFields = docFields.filter((p) => !isHiddenPlaceholderField(p));
          if (!visibleDocFields.length && !tables.length) {
            await submit();
            return;
          }

          let nextValues = { ...placeholderValues };
          docFields.forEach((p) => {
            if (nextValues[p.key] == null || nextValues[p.key] === '') {
              nextValues[p.key] = defaultsToTodayPlaceholder(p) ? todayISODate() : '';
            }
          });
          nextValues = applyContactSnapshotToPlaceholders(docFields, person, nextValues, {
            skipKeys: touchedPlaceholderKeys(),
          });

          let nextLineRows = lineRowsByTable;
          const assetId = selectedLinkAssetId || linkAssetId;
          if (assetId) {
            try {
              const { data: snap } = await api(`/assets/${assetId}/placeholder-snapshot`);
              setSelectedAssetSnapshot(snap);
              setSelectedLinkAssetId(snap?.assetId || assetId);
              nextValues = applyAssetSnapshotToPlaceholders(docFields, snap, nextValues);
              nextLineRows = applyAssetSnapshotToLineRows(tables, snap, nextLineRows);
            } catch {
              if (selectedAssetSnapshot) {
                nextValues = applyAssetSnapshotToPlaceholders(
                  docFields,
                  selectedAssetSnapshot,
                  nextValues
                );
                nextLineRows = applyAssetSnapshotToLineRows(
                  tables,
                  selectedAssetSnapshot,
                  nextLineRows
                );
              }
            }
          } else if (selectedAssetSnapshot) {
            nextValues = applyAssetSnapshotToPlaceholders(
              docFields,
              selectedAssetSnapshot,
              nextValues
            );
            nextLineRows = applyAssetSnapshotToLineRows(
              tables,
              selectedAssetSnapshot,
              nextLineRows
            );
          }

          setPlaceholderValues(nextValues);
          setLineRowsByTable(nextLineRows);
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
    const missing = visiblePlaceholders.filter((p) => !String(placeholderValues[p.key] || '').trim());
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
            setError(`Fill Row ${i + 1} · ${displayLineColumnLabel(col)}`);
            return;
          }
        }
      }
    }
    if (!assertUniqueLineSerials()) return;
    const partyName =
      recipientMode === 'directory'
        ? selectedContact?.name
        : newContact.name;
    const documentDetails = selectedTemplate?.name || title;
    const builtTitle = buildAgreementDocumentTitle({
      partyName,
      documentDetails,
      dateValue: startDate || todayISODate(),
    });
    setTitle(builtTitle);
    setBusy(true);
    try {
      const mergedValues = mergeLineValuesIntoPlaceholders(
        placeholderValues,
        placeholders,
        repeatableTables,
        lineRowsByTable
      );
      setPlaceholderValues(mergedValues);
      const fileBase = agreementTitleToFileBase(builtTitle);
      const { data } = await api(`/templates/${selectedTemplateId}/fill-preview`, {
        method: 'POST',
        body: { values: mergedValues, lineRows: lineRowsByTable, title: builtTitle },
      });
      setPreviewToken(data.previewToken);
      // Use the real preview URL (not a blob:) so Save/Download keeps the nomenclature name.
      if (pdfUrl && String(pdfUrl).startsWith('blob:')) URL.revokeObjectURL(pdfUrl);
      const namedPdfPath =
        data.previewUrl ||
        `/api/v1/templates/preview/${data.previewToken}/${encodeURIComponent(fileBase)}.pdf`;
      setPdfUrl(apiUrl(namedPdfPath));
      setPdfEngine(data.pdfEngine || '');
      if (data.filledDocxUrl) {
        const docxFile = await fetchDocxFile(data.filledDocxUrl, `${fileBase}.docx`);
        setFilledDocxBlob(docxFile);
        setPreviewMode(data.pdfEngine === 'pdfkit' ? 'word' : 'pdf');
      } else {
        setFilledDocxBlob(null);
        setPreviewMode('pdf');
      }
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

  const patchLineRow = (tableId, rowIndex, patch) => {
    setLineRowsByTable((prev) => {
      const rows = [...(prev[tableId] || [])];
      rows[rowIndex] = { ...rows[rowIndex], ...patch };
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
      setError('Choose a template and provide a title.');
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
    if (!assertUniqueLineSerials()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      appendRecipientFields(fd);
      fd.append('documentSource', 'TEMPLATE');
      fd.append('templateId', selectedTemplateId);
      if (previewToken) {
        fd.append('previewToken', previewToken);
      } else if (selectedTemplate?.bodyHtml) {
        fd.append('bodyHtml', selectedTemplate.bodyHtml);
      }

      const { data } = await api('/agreements', { method: 'POST', body: fd });
      const assetIds = new Set();
      const primary = (await resolveLinkAssetId()) || linkAssetId || selectedLinkAssetId;
      if (primary) assetIds.add(String(primary));
      for (const id of await resolveLineAssetIds()) {
        assetIds.add(String(id));
      }
      if (assetIds.size) {
        try {
          await api(`/agreements/${data._id}/assets`, {
            method: 'POST',
            body: { assetIds: [...assetIds] },
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

  const downloadPreviewFile = async (kind) => {
    const fileBase = agreementTitleToFileBase(title) || 'document';
    try {
      if (kind === 'pdf') {
        if (!previewToken && !pdfUrl) return;
        const path = previewToken
          ? `/templates/preview/${previewToken}/${encodeURIComponent(fileBase)}.pdf?download=1`
          : null;
        if (path) {
          const res = await apiFetch(path);
          if (!res.ok) throw new Error('Download failed');
          const blob = await res.blob();
          downloadBlobWithName(blob, `${fileBase}.pdf`, 'application/pdf');
          return;
        }
        // Fallback: open named public URL
        window.open(`${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}download=1`, '_blank', 'noopener');
        return;
      }
      if (kind === 'docx') {
        if (previewToken) {
          const res = await apiFetch(
            `/templates/preview/${previewToken}/${encodeURIComponent(fileBase)}.docx?download=1`
          );
          if (!res.ok) throw new Error('Download failed');
          const blob = await res.blob();
          downloadBlobWithName(
            blob,
            `${fileBase}.docx`,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          return;
        }
        if (filledDocxBlob) {
          downloadBlobWithName(
            filledDocxBlob,
            filledDocxBlob.name || `${fileBase}.docx`,
            filledDocxBlob.type
          );
        }
      }
    } catch (err) {
      setError(err.message || 'Download failed');
    }
  };

  return (
    <div className="page-shell esign-shell">
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
              Select the recipient, then choose a template from {MODULE.DOCUMENT_MASTER}.{' '}
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
            <small>Template library</small>
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
                <p className="muted" style={{ marginBottom: 0, marginTop: 'var(--space-2)' }}>
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
            <h3 style={{ marginTop: 0 }}>Template library</h3>
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
              {!templates.length && (
                <p className="muted">
                  No templates available. Upload templates in{' '}
                  <Link to="/master-one?scope=document&entity=templates">{MODULE.DOCUMENT_MASTER}</Link>.
                </p>
              )}
              {selectedTemplate && (
                <pre className="template-preview">{(selectedTemplate.bodyHtml || '').slice(0, 900)}{(selectedTemplate.bodyHtml || '').length > 900 ? '…' : ''}</pre>
              )}
            </div>
          </section>

          <aside className="card">
            <h3>Document details</h3>
            <div className="field">
              <label>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              <span className="muted" style={{ fontSize: 'var(--text-body-sm-size)' }}>
                On Continue, the file is named as Recipient–Document–Date (e.g. Ashish-Service
                Agreement-27/09/2026).
              </span>
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
              <span className="muted" style={{ fontSize: 'var(--text-body-sm-size)' }}>
                Defaults to today. Change only if the agreement starts on another day.
              </span>
            </div>

            <div className="field">
              <label htmlFor="agr-expiry-no">Document expiry</label>
              <div className="esign-sign-modes" style={{ marginTop: 'var(--space-2)' }} role="group" aria-label="Document expiry">
                <button
                  id="agr-expiry-no"
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
              <div className="muted" style={{ marginTop: 'var(--space-2)' }}>
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
          </div>

          <div className="ph-step-fields">
            {visiblePlaceholders.map((p) => (
              <div className="field ph-field" key={`${p.key}-${p.occurrence || 0}`}>
                <label htmlFor={`ph-${p.key}`}>{p.label}</label>
                {isAssetRegistryPlaceholder(p) ? (
                  <AssetRegistrySearchInput
                    id={`ph-${p.key}`}
                    required
                    value={placeholderValues[p.key] || ''}
                    onChange={(v) => updatePlaceholderValue(p.key, v)}
                    onSelectAsset={handleAssetSelected}
                    placeholder={`Search ${p.label} in Asset Registry…`}
                  />
                ) : isDatePlaceholder(p) ? (
                  <DateInput
                    id={`ph-${p.key}`}
                    hideLabel
                    required
                    aria-label={p.label}
                    value={placeholderValues[p.key] || ''}
                    onChange={(v) => updatePlaceholderValue(p.key, v)}
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
                    onChange={(e) => updatePlaceholderValue(p.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            {!visiblePlaceholders.length && !hasLineTables && (
              <p className="muted">No placeholders on this template.</p>
            )}
          </div>

          {repeatableTables.map((table) => {
            const rows = lineRowsByTable[table.id] || [];
            const maxRows = Number(table.maxRows) > 0 ? Number(table.maxRows) : 20;
            const minRows = Number(table.minRows) > 0 ? Number(table.minRows) : 1;
            const canRemoveRows = rows.length > minRows;
            const columns = table.columns || [];
            const deviceNameCol = columns.find((col) => isDeviceNameLineColumn(col));
            const serialCol = columns.find((col) => isSerialNumberLineColumn(col));
            return (
              <div className="ph-line-table" key={table.id}>
                <div className="ph-line-table-head">
                  <h4>Line items</h4>
                  <span className="ph-line-row-count">
                    {rows.length} / {maxRows} rows
                  </span>
                </div>
                <div className={`ph-line-table-scroll${canRemoveRows ? ' has-actions' : ''}`}>
                  <table>
                    <colgroup>
                      <col className="ph-line-colgroup-sr" />
                      {columns.map((col) => (
                        <col key={col.key} className={lineColumnClass(col)} />
                      ))}
                      {canRemoveRows ? <col className="ph-line-colgroup-actions" /> : null}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="ph-line-sr" scope="col">#</th>
                        {columns.map((col) => (
                          <th key={col.key} className={lineColumnClass(col)} scope="col">
                            {displayLineColumnLabel(col)}
                          </th>
                        ))}
                        {canRemoveRows ? (
                          <th className="ph-line-actions" scope="col" aria-label="Actions" />
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={`${table.id}-${rowIndex}`}>
                          <td className="ph-line-sr">{rowIndex + 1}</td>
                          {columns.map((col) => {
                            const label = displayLineColumnLabel(col);
                            const cellId = `line-${table.id}-${rowIndex}-${col.key}`;
                            if (isDeviceNameLineColumn(col)) {
                              return (
                                <td key={col.key} className={lineColumnClass(col)}>
                                  <LineDeviceNameCombobox
                                    id={cellId}
                                    required
                                    value={row[col.key] || ''}
                                    aria-label={`Row ${rowIndex + 1} ${label}`}
                                    onChange={(nextName) => {
                                      const patch = { [col.key]: nextName };
                                      if (
                                        serialCol &&
                                        String(row[serialCol.key] || '').trim() &&
                                        String(nextName || '').trim().toLowerCase() !==
                                          String(row[col.key] || '').trim().toLowerCase()
                                      ) {
                                        patch[serialCol.key] = '';
                                      }
                                      patchLineRow(table.id, rowIndex, patch);
                                    }}
                                    onSelectName={(name) => {
                                      const patch = { [col.key]: name };
                                      if (serialCol) patch[serialCol.key] = '';
                                      patchLineRow(table.id, rowIndex, patch);
                                    }}
                                  />
                                </td>
                              );
                            }
                            if (isSerialNumberLineColumn(col)) {
                              const deviceName = deviceNameCol
                                ? row[deviceNameCol.key] || ''
                                : '';
                              const usedElsewhere = [
                                ...collectUsedLineSerials(lineRowsByTable, repeatableTables, {
                                  excludeTableId: table.id,
                                  excludeRowIndex: rowIndex,
                                }),
                              ];
                              return (
                                <td key={col.key} className={lineColumnClass(col)}>
                                  <LineSerialCombobox
                                    id={cellId}
                                    required
                                    value={row[col.key] || ''}
                                    deviceName={deviceName}
                                    excludeSerials={usedElsewhere}
                                    aria-label={`Row ${rowIndex + 1} ${label}`}
                                    onChange={(serial) => {
                                      const next = String(serial || '').trim();
                                      if (
                                        next &&
                                        usedElsewhere.includes(next.toLowerCase())
                                      ) {
                                        setError(
                                          `Serial “${next}” is already used on another line in this agreement.`
                                        );
                                        return;
                                      }
                                      setError('');
                                      updateLineCell(table.id, rowIndex, col.key, serial);
                                    }}
                                  />
                                </td>
                              );
                            }
                            return (
                              <td key={col.key} className={lineColumnClass(col)}>
                                <input
                                  required
                                  inputMode={col.type === 'number' ? 'decimal' : 'text'}
                                  value={row[col.key] || ''}
                                  onChange={(e) =>
                                    updateLineCell(table.id, rowIndex, col.key, e.target.value)
                                  }
                                  aria-label={`Row ${rowIndex + 1} ${label}`}
                                  placeholder={label}
                                />
                              </td>
                            );
                          })}
                          {canRemoveRows ? (
                            <td className="ph-line-actions">
                              <button
                                type="button"
                                className="ph-line-remove"
                                onClick={() => removeLineRow(table, rowIndex)}
                              >
                                Remove
                              </button>
                            </td>
                          ) : null}
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
                <strong>{title || 'Document preview'}</strong>
                <p className="muted" style={{ margin: '2px 0 0' }}>
                  {filledDocxBlob
                    ? 'Word layout matches your template. Switch to PDF to review the file used for signing (signature footer on every page).'
                    : 'Review the filled PDF. Sender (left) and Receiver (right) slots appear on every page.'}
                  {pdfEngine === 'msword'
                    ? ' PDF was created with Microsoft Word (same as Save as PDF).'
                    : pdfEngine === 'libreoffice'
                    ? ' PDF was converted from Word for layout fidelity.'
                    : pdfEngine === 'pdfkit'
                      ? ' PDF is a fallback rebuild. Install Microsoft Word or LibreOffice on this computer for a matching layout.'
                      : ''}
                </p>
              </div>
              <div className="row">
                {filledDocxBlob && pdfEngine === 'pdfkit' ? (
                  <div className="btn-group" role="group" aria-label="Preview mode">
                    <button
                      type="button"
                      className={`btn secondary btn-compact${previewMode === 'word' ? ' is-active' : ''}`}
                      onClick={() => setPreviewMode('word')}
                    >
                      Approximate layout
                    </button>
                    <button
                      type="button"
                      className={`btn secondary btn-compact${previewMode === 'pdf' ? ' is-active' : ''}`}
                      onClick={() => setPreviewMode('pdf')}
                    >
                      PDF (rebuilt)
                    </button>
                  </div>
                ) : null}
                <button className="btn secondary" type="button" onClick={() => setStep(3)}>
                  ← Edit fields
                </button>
                {pdfUrl ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => downloadPreviewFile('pdf')}
                  >
                    Download PDF
                  </button>
                ) : null}
                {filledDocxBlob ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => downloadPreviewFile('docx')}
                  >
                    Download Word
                  </button>
                ) : null}
                <button className="btn" type="button" disabled={busy || !previewToken} onClick={submit}>
                  {busy ? 'Creating…' : 'Create draft'}
                </button>
              </div>
            </div>
            {previewMode === 'word' && filledDocxBlob && pdfEngine === 'pdfkit' ? (
              <div className="esign-docx-frame">
                <DocxNativePreview file={filledDocxBlob} />
              </div>
            ) : pdfUrl ? (
              <iframe
                title={title || 'PDF preview'}
                className="pdf-preview-frame esign-pdf-frame"
                src={pdfUrl}
              />
            ) : (
              <p className="muted">Preview not loaded.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
