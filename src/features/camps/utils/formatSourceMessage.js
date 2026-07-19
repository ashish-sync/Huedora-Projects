import { formatDateTimeDDMMYYYY } from './dateFormat.js';

const EMAIL_FORWARD_SPLIT_PATTERNS = [
  /(?:^|\n)-{3,}\s*Forwarded message\s*-{3,}/gi,
  /(?:^|\n)-{3,}\s*Original Message\s*-{3,}/gi,
  /(?:^|\n)Begin forwarded message:?/gi,
  /(?:^|\n)_{5,}/g,
  /(?:^|\n)On .{10,160} wrote:\s*\n/gi,
];

const WHATSAPP_TIMESTAMP_LOOKAHEAD = /(?:^|\n)(?=\[\d{1,2}:\d{2}\s*(?:am|pm),\s*\d{1,2}\/\d{1,2}\/\d{4}\]\s*\+?[\d\s]+:\s*)/gi;

const WHATSAPP_CAMP_SPLIT_PATTERNS = [
  /(?:^|\n)(?=Client:\s*\S)/gi,
  /(?:^|\n)(?=BMD Camp Request)/gi,
  /(?:^|\n)(?=Dietician Camps Booking Template)/gi,
];

const WHATSAPP_TIMESTAMP_PATTERN = /^\[(\d{1,2}:\d{2}\s*(?:am|pm),\s*\d{1,2}\/\d{1,2}\/\d{4})\]\s*\+?([\d\s]+):\s*/i;

const METADATA_LINE_PATTERNS = [
  /^from:\s*.+$/i,
  /^to:\s*.+$/i,
  /^cc:\s*.+$/i,
  /^bcc:\s*.+$/i,
  /^sent:\s*.+$/i,
  /^subject:\s*.+$/i,
  /^date:\s*.+$/i,
  /^reply-to:\s*.+$/i,
  /^importance:\s*.+$/i,
  /^priority:\s*.+$/i,
  /^-{3,}\s*forwarded message\s*-{3,}$/i,
  /^begin forwarded message:?$/i,
  /^original message$/i,
  /^on .+ wrote:?\s*$/i,
  /^>{1,}\s*from:\s*.+$/i,
  /^>{1,}\s*sent:\s*.+$/i,
  /^>{1,}\s*to:\s*.+$/i,
  /^>{1,}\s*subject:\s*.+$/i,
  /^>{1,}\s*date:\s*.+$/i,
  /^google form uploaded\.?$/i,
  /^get outlook for.*$/i,
  /^sent from my iphone$/i,
  /^sent from my samsung/i,
  /^\[\d{1,2}:\d{2}\s*(?:am|pm),\s*\d{1,2}\/\d{1,2}\/\d{4}\]\s*\+?[\d\s]+:\s*$/i,
];

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ');
}

function isMetadataLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  return METADATA_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractSegmentMeta(segment) {
  const meta = { subject: '', sender: '', dateTime: '' };
  const text = normalizeText(segment);

  const whatsappHeader = WHATSAPP_TIMESTAMP_PATTERN.exec(text);
  if (whatsappHeader) {
    meta.dateTime = whatsappHeader[1].trim();
    const phone = whatsappHeader[2].replace(/\s+/g, '');
    meta.sender = phone ? `+${phone.replace(/^\+/, '')}` : '';
  }

  text.split('\n').forEach((line) => {
    const trimmed = line.trim().replace(/^>\s*/, '');
    if (/^subject:\s*/i.test(trimmed)) {
      meta.subject = trimmed.replace(/^subject:\s*/i, '').trim();
    }
    if (/^from:\s*/i.test(trimmed)) {
      meta.sender = trimmed.replace(/^from:\s*/i, '').trim();
    }
    if (/^sent:\s*/i.test(trimmed)) {
      meta.dateTime = trimmed.replace(/^sent:\s*/i, '').trim();
    }
    if (/^date:\s*/i.test(trimmed) && !meta.dateTime) {
      meta.dateTime = trimmed.replace(/^date:\s*/i, '').trim();
    }
  });

  return meta;
}

function compactBodyText(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim().replace(/^>\s*/, '').replace(/ {2,}/g, ' '))
    .filter((line) => line && !isMetadataLine(line))
    .join(' ')
    .trim();
}

function hasWhatsappTimestamp(segment) {
  return WHATSAPP_TIMESTAMP_PATTERN.test(normalizeText(segment).trim());
}

function applySplitPatterns(segments, patterns) {
  let result = segments.filter(Boolean);

  patterns.forEach((pattern) => {
    const next = [];
    result.forEach((segment) => {
      segment.split(pattern).forEach((part) => {
        const cleaned = part.trim();
        if (cleaned) next.push(cleaned);
      });
    });
    result = next.length ? next : result;
  });

  return result;
}

function splitRawSegments(text, source = 'email') {
  const normalized = normalizeText(text).trim();
  if (!normalized) return [];

  if (source !== 'whatsapp') {
    return applySplitPatterns([normalized], EMAIL_FORWARD_SPLIT_PATTERNS);
  }

  let segments = applySplitPatterns(
    [normalized],
    [...EMAIL_FORWARD_SPLIT_PATTERNS, WHATSAPP_TIMESTAMP_LOOKAHEAD],
  );

  segments = segments.flatMap((segment) => {
    if (hasWhatsappTimestamp(segment)) return [segment];
    return applySplitPatterns([segment], WHATSAPP_CAMP_SPLIT_PATTERNS);
  });

  return segments.filter(Boolean);
}

function formatSectionHeader(meta, defaults) {
  const subject = meta.subject || defaults.subject || 'Message';
  const dateTime = meta.dateTime || defaults.dateTime || '';
  return dateTime ? `${subject} (${dateTime})` : subject;
}

function formatSection(meta, body, defaults) {
  const compactBody = compactBodyText(body);
  if (!compactBody) return null;

  const header = formatSectionHeader(meta, defaults);
  const sender = meta.sender || defaults.sender || '';

  return [header, sender, compactBody].filter(Boolean).join('\n');
}

function buildDefaults({ source, emailSubject, emailSender, submittedAt, whatsappSenderPhone }) {
  const dateTime = submittedAt ? formatDateTimeDDMMYYYY(submittedAt) : '';

  if (source === 'whatsapp') {
    return {
      subject: 'WhatsApp message',
      sender: whatsappSenderPhone ? `+${whatsappSenderPhone}` : '',
      dateTime,
    };
  }

  return {
    subject: emailSubject || 'Email',
    sender: emailSender || '',
    dateTime,
  };
}

export function formatSourceMessage(text, defaults = {}, source = 'email') {
  const segments = splitRawSegments(text, source);
  if (!segments.length) return '';

  const formatted = segments
    .map((segment, index) => {
      const meta = extractSegmentMeta(segment);
      const sectionDefaults = index === 0
        ? defaults
        : {
          subject: meta.subject || (source === 'whatsapp' ? 'WhatsApp message' : 'Message'),
          sender: '',
          dateTime: meta.dateTime || '',
        };
      return formatSection(meta, segment, sectionDefaults);
    })
    .filter(Boolean);

  return formatted.join('\n\n');
}

export function buildSourcePreview({
  source,
  emailSubject,
  emailSender,
  emailRawBody,
  whatsappSenderPhone,
  whatsappRawMessage,
  submittedAt,
}) {
  const defaults = buildDefaults({
    source,
    emailSubject,
    emailSender,
    submittedAt,
    whatsappSenderPhone,
  });

  const raw = source === 'whatsapp' ? whatsappRawMessage : emailRawBody;
  return formatSourceMessage(raw || '', defaults, source);
}
