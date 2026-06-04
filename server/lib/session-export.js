'use strict';

const fs = require('fs');
const { getPlaceholderMatchers } = require('../../public/app/placeholders.js');

const BUILTIN_TYPE_ORDER = ['recon', 'network-enumeration', 'exploit', 'privesc', 'loot', 'credentials', 'general', 'scratch'];
const BUILTIN_TYPE_LABELS = {
  general: 'General',
  credentials: 'Credentials',
  privesc: 'PrivEsc',
  recon: 'Recon',
  'network-enumeration': 'Network Enumeration',
  loot: 'Loot',
  exploit: 'Exploit',
  scratch: 'Blank',
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function formatDay(ts) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(firstTs, lastTs) {
  if (!firstTs || !lastTs || lastTs <= firstTs) return '—';
  const ms = lastTs - firstTs;
  const hrs = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${min}m`;
  return `${min}m`;
}

function escapeTableCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function escapeFenceContent(value) {
  return String(value || '').replace(/```/g, '\\`\\`\\`').trim();
}

function stripEvidenceMarkers(text) {
  return String(text || '')
    .replace(/<!--\s*pragma:evidence:[^>]+:(?:start|end)\s*-->\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function rewriteAttachmentUrls(text, attachmentUrlMap = null) {
  if (!attachmentUrlMap || typeof attachmentUrlMap !== 'object') return String(text || '');
  let output = String(text || '');
  Object.entries(attachmentUrlMap).forEach(([from, to]) => {
    if (!from || !to) return;
    output = output.split(from).join(to);
  });
  return output;
}

function loadTemplateMeta(templatesFile) {
  const byType = {};
  BUILTIN_TYPE_ORDER.forEach((type) => {
    byType[type] = { id: type, label: BUILTIN_TYPE_LABELS[type], builtin: true };
  });

  try {
    const raw = fs.readFileSync(templatesFile, 'utf8');
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    templates.forEach((template) => {
      if (!template || !template.id) return;
      byType[template.id] = {
        id: template.id,
        label: String(template.label || template.id).trim() || template.id,
        builtin: !!byType[template.id]?.builtin,
      };
    });
  } catch (_) {}

  return {
    byType,
    builtinOrder: [...BUILTIN_TYPE_ORDER],
  };
}

function resolveNoteType(type, templateMeta) {
  const raw = String(type || 'general').trim() || 'general';
  const known = templateMeta?.byType?.[raw];
  if (known) return { ...known, id: raw };
  return {
    id: raw,
    label: raw.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || raw,
    builtin: false,
    unknown: true,
  };
}

function noteTimestamp(note) {
  return note.updated || note.created || 0;
}

function noteTitle(note, storage) {
  return note.title || storage.noteFilename(note).replace(/\.md$/i, '');
}

function targetLabel(target) {
  if (!target) return '';
  return [target.ip, target.domain, target.label].filter(Boolean).join(' · ');
}

function replaceAllPatterns(input, patterns, replacement) {
  let output = String(input || '');
  patterns.forEach((pattern) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

function injectTargetPlaceholders(text, target) {
  if (!target || !text) return text || '';

  const ip = String(target.ip || '').trim();
  const domain = String(target.domain || '').trim();
  const label = String(target.label || target.ip || target.domain || '').trim();
  const attackerIp = String(target.attacker_ip || '').trim();
  let output = String(text);
  const {
    ipPatterns,
    domainPatterns,
    labelPatterns,
    attackerPatterns,
  } = getPlaceholderMatchers({ includeBare: false });

  if (ip) {
    output = replaceAllPatterns(output, ipPatterns, ip);
  }

  if (domain) {
    output = replaceAllPatterns(output, domainPatterns, domain);
  }

  if (label) {
    output = replaceAllPatterns(output, labelPatterns, label);
  }

  if (attackerIp) {
    output = replaceAllPatterns(output, attackerPatterns, attackerIp);
  }

  return output;
}

function normalizeHeadingText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getLeadingMarkdownHeading(body) {
  const lines = String(body || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return null;
    return { index: i, level: match[1].length, text: match[2].trim() };
  }
  return null;
}

function shiftMarkdownHeadings(body, shift) {
  if (!shift) return String(body || '');
  return String(body || '').replace(/^(#{1,6})(\s+.+)$/gm, (_, hashes, rest) => `${'#'.repeat(Math.min(6, hashes.length + shift))}${rest}`);
}

function buildTypeBuckets(notes, templateMeta) {
  const grouped = new Map();
  notes.forEach((note) => {
    const typeMeta = resolveNoteType(note.type, templateMeta);
    if (!grouped.has(typeMeta.id)) grouped.set(typeMeta.id, { type: typeMeta.id, label: typeMeta.label, notes: [] });
    grouped.get(typeMeta.id).notes.push(note);
  });

  grouped.forEach((bucket) => {
    bucket.notes.sort((a, b) => noteTimestamp(a) - noteTimestamp(b));
  });

  const builtinOrder = templateMeta?.builtinOrder || BUILTIN_TYPE_ORDER;
  const builtin = [];
  const custom = [];
  const unknown = [];

  grouped.forEach((bucket, type) => {
    if (builtinOrder.includes(type)) builtin.push(bucket);
    else if (templateMeta?.byType?.[type]) custom.push(bucket);
    else unknown.push(bucket);
  });

  builtin.sort((a, b) => builtinOrder.indexOf(a.type) - builtinOrder.indexOf(b.type));
  custom.sort((a, b) => a.label.localeCompare(b.label));
  unknown.sort((a, b) => a.label.localeCompare(b.label));

  return [...builtin, ...custom, ...unknown];
}

function buildSessionExportModel({ session, notes, storage, templateMeta, author = '' }) {
  const exportedAt = Date.now();
  const sessionContext = { attacker_ip: session.attacker_ip || '', domain: session.domain || '' };
  const targets = Array.isArray(session.targets)
    ? session.targets.map((target) => ({ ...target, attacker_ip: session.attacker_ip || '', session_domain: session.domain || '' }))
    : [];
  const targetById = Object.fromEntries(targets.map((target) => [target.id, target]));

  const allNotes = [...notes].sort((a, b) => noteTimestamp(a) - noteTimestamp(b));
  const assigned = [];
  const unassigned = [];

  allNotes.forEach((note) => {
    if (note.target_id && targetById[note.target_id]) assigned.push(note);
    else unassigned.push(note);
  });

  const notesForMainSection = targets.length ? assigned : allNotes;
  const services = Array.isArray(session.services) ? [...session.services] : [];
  const paths = Array.isArray(session.paths) ? [...session.paths] : [];
  const loot = Array.isArray(session.loot) ? [...session.loot] : [];
  const evidence = Array.isArray(session.evidence) ? [...session.evidence] : [];
  const sessionEvents = Array.isArray(session.events) ? [...session.events] : [];

  const noteEvents = allNotes.map((note) => ({
    ts: note.created || note.updated || 0,
    kind: 'note',
    note,
  }));
  const lifecycleEvents = sessionEvents.map((event) => ({
    ts: event.ts || 0,
    kind: 'event',
    event,
  }));
  const events = [...noteEvents, ...lifecycleEvents]
    .filter((item) => item.ts)
    .sort((a, b) => a.ts - b.ts);

  const eventTimestamps = events.map((item) => item.ts).filter(Boolean);
  const firstTs = eventTimestamps.length ? eventTimestamps[0] : 0;
  const lastTs = eventTimestamps.length ? eventTimestamps[eventTimestamps.length - 1] : 0;
  const hasCredentialsNote = allNotes.some((note) => String(note.type || '').trim() === 'credentials');
  const hasNetworkEnumerationNote = allNotes.some((note) => String(note.type || '').trim() === 'network-enumeration');

  return {
    author: String(author || '').trim(),
    session,
    sessionContext,
    storage,
    sessionSlug: storage.slugify(session.codename),
    exportedAt,
    templateMeta,
    targets,
    targetById,
    services,
    paths,
    loot,
    evidence,
    events,
    notes: {
      all: allNotes,
      assigned,
      unassigned,
      main: notesForMainSection,
      typeBuckets: buildTypeBuckets(notesForMainSection, templateMeta),
      appendixBuckets: buildTypeBuckets(unassigned, templateMeta),
    },
    stats: {
      noteCount: allNotes.length,
      targetCount: targets.length,
      firstTs,
      lastTs,
      durationLabel: formatDuration(firstTs, lastTs),
    },
    canonicalSources: {
      credentials: hasCredentialsNote,
      networkEnumeration: hasNetworkEnumerationNote,
    },
  };
}

function renderTargetNoteFile({ note, session, target, typeMeta, storage, attachmentUrlMap = null }) {
  const placeholderContext = { attacker_ip: session.attacker_ip || '', domain: session.domain || '', ...target };
  const title = injectTargetPlaceholders(noteTitle(note, storage), placeholderContext);
  const label = targetLabel(target);
  const body = rewriteAttachmentUrls(
    stripEvidenceMarkers(injectTargetPlaceholders(note.body || '', placeholderContext)),
    attachmentUrlMap
  );
  return [
    `# ${title}`,
    '',
    `> **Type:** \`${typeMeta.label}\``,
    `> **Target:** \`${label}\``,
    `> **Session:** ${session.codename}`,
    `> **Created:** ${formatTimestamp(noteTimestamp(note))}`,
    '',
    '---',
    '',
    body,
  ].join('\n');
}

function renderSessionNoteFile({ note, session, typeMeta, storage, attachmentUrlMap = null }) {
  const placeholderContext = { attacker_ip: session.attacker_ip || '', domain: session.domain || '' };
  const title = injectTargetPlaceholders(noteTitle(note, storage), placeholderContext);
  const body = rewriteAttachmentUrls(
    stripEvidenceMarkers(injectTargetPlaceholders(note.body || '', placeholderContext)),
    attachmentUrlMap
  );
  return [
    `# ${title}`,
    '',
    `> **Type:** \`${typeMeta.label}\``,
    `> **Session:** ${session.codename}`,
    `> **Created:** ${formatTimestamp(noteTimestamp(note))}`,
    '',
    '---',
    '',
    body,
  ].join('\n');
}

function renderTimelineSummary(model) {
  const typeCount = {};
  model.notes.all.forEach((note) => {
    const typeMeta = resolveNoteType(note.type, model.templateMeta);
    typeCount[typeMeta.label] = (typeCount[typeMeta.label] || 0) + 1;
  });

  const byDay = {};
  model.events.forEach((item) => {
    const dayKey = formatDay(item.ts);
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(item);
  });

  const lines = [
    `# ${model.session.codename} - Timeline Summary`,
    '',
    `**Exported:** ${formatTimestamp(model.exportedAt)}`,
    `**Total events:** ${model.events.length}`,
    `**Duration:** ${model.stats.durationLabel}`,
    '',
    '**Activity breakdown:**',
    ...Object.entries(typeCount).map(([label, count]) => `- ${label}: ${count}`),
    '',
    '---',
    '',
  ];

  Object.entries(byDay).forEach(([day, notes]) => {
    lines.push(`## ${day}`);
    lines.push('');
    notes
      .sort((a, b) => a.ts - b.ts)
      .forEach((item) => {
        const time = formatTime(item.ts);
        if (item.kind === 'note') {
          const note = item.note;
          const typeMeta = resolveNoteType(note.type, model.templateMeta);
          const target = note.target_id ? model.targetById[note.target_id] : null;
          const targetPart = target ? ` \`${targetLabel(target)}\`` : '';
          const placeholderContext = target ? { ...model.sessionContext, ...target } : model.sessionContext;
          const title = injectTargetPlaceholders(noteTitle(note, model.storage), placeholderContext);
          const preview = stripEvidenceMarkers(note.body || '')
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith('#') && !line.startsWith('---') && line.length > 3);
          const previewPart = preview ? `\n  > ${preview.slice(0, 120)}${preview.length > 120 ? '...' : ''}` : '';
          lines.push(`**${time}** ${typeMeta.label} **${title}**${targetPart}${previewPart}`);
          lines.push('');
          return;
        }

        const event = item.event || {};
        if (event.type === 'status') {
          lines.push(`**${time}** Status changed: \`${event.from || 'unknown'}\` -> \`${event.to || 'unknown'}\``);
        } else if (event.type === 'session_created') {
          lines.push(`**${time}** Session created: **${event.name || model.session.codename}**`);
        } else {
          lines.push(`**${time}** Event: **${event.type || 'unknown'}**`);
        }
        lines.push('');
      });
  });

  return lines.join('\n');
}

function renderExportIndex(model) {
  const lines = [
    `# ${model.session.codename}`,
    '',
    `**Exported:** ${formatTimestamp(model.exportedAt)}`,
    `**Total notes:** ${model.stats.noteCount}`,
    '',
    '## Targets',
    '',
    ...model.targets
      .filter((target) => model.notes.assigned.some((note) => note.target_id === target.id))
      .map((target) => {
        const dir = model.storage.slugify(target.ip || target.domain || target.label || target.id);
        return `- [${targetLabel(target)}](./${dir}/) — ${model.notes.assigned.filter((note) => note.target_id === target.id).length} notes`;
      }),
    model.notes.unassigned.length ? `- [Session-wide notes](./session/) — ${model.notes.unassigned.length} notes` : null,
  ];

  return lines.filter((line) => line !== null).join('\n');
}

function renderTargetSection(target, model) {
  const lines = [`### ${targetLabel(target) || target.id}`, ''];
  if (target.ip) lines.push(`- IP: ${target.ip}`);
  if (target.domain) lines.push(`- Domain: ${target.domain}`);
  if (target.label) lines.push(`- Label: ${target.label}`);
  if (lines[lines.length - 1] !== '') lines.push('');

  if (!model.canonicalSources.networkEnumeration) {
    const targetServices = model.services
      .filter((entry) => entry.target_id === target.id)
      .sort((a, b) => (parseInt(a.port, 10) || 0) - (parseInt(b.port, 10) || 0));
    if (targetServices.length) {
      lines.push('Ports');
      lines.push('');
      lines.push('| Port | Service | Version | Notes |');
      lines.push('|------|---------|---------|-------|');
      targetServices.forEach((entry) => {
        const port = entry.proto && entry.proto !== 'tcp' ? `${entry.port}/${entry.proto}` : entry.port;
        lines.push(`| ${escapeTableCell(port)} | ${escapeTableCell(entry.service)} | ${escapeTableCell(entry.version)} | ${escapeTableCell(entry.notes)} |`);
      });
      lines.push('');
    }
  }

  const targetPaths = model.paths
    .filter((entry) => entry.target_id === target.id)
    .sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')));
  if (targetPaths.length) {
    lines.push('Paths');
    lines.push('');
    lines.push('| Status | Path | Notes |');
    lines.push('|--------|------|-------|');
    targetPaths.forEach((entry) => {
      lines.push(`| ${escapeTableCell(entry.status)} | ${escapeTableCell(entry.path)} | ${escapeTableCell(entry.notes)} |`);
    });
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function renderNoteEntries(bucket, model, includeTarget) {
  const lines = [`### ${bucket.label}`, ''];
  bucket.notes.forEach((note) => {
    const target = note.target_id ? model.targetById[note.target_id] : null;
    const placeholderContext = target ? { ...model.sessionContext, ...target } : model.sessionContext;
    const resolvedTitle = injectTargetPlaceholders(noteTitle(note, model.storage), placeholderContext);
    const resolvedBody = rewriteAttachmentUrls(
      stripEvidenceMarkers(injectTargetPlaceholders(note.body || '', placeholderContext)),
      model.attachmentUrlMapByNoteId?.[note.id] || null
    );
    const leadingHeading = getLeadingMarkdownHeading(resolvedBody);
    const headingText = leadingHeading?.text || resolvedTitle;
    const bodyLines = resolvedBody.split('\n');

    if (leadingHeading) bodyLines.splice(leadingHeading.index, 1);

    const candidates = [headingText, resolvedTitle].filter(Boolean);
    const normalizedBucket = normalizeHeadingText(bucket.label);
    const headerText = candidates.find((text) => normalizeHeadingText(text) !== normalizedBucket) || '';
    const renderTitleHeading = !!headerText;
    const shiftedBody = shiftMarkdownHeadings(
      bodyLines.join('\n').replace(/^\n+/, '').trimEnd(),
      renderTitleHeading ? 3 : 2
    );

    if (headerText) lines.push(`#### ${headerText}`);
    lines.push('');
    lines.push(`- Type: ${bucket.label}`);
    lines.push(`- Created: ${formatTimestamp(noteTimestamp(note))}`);
    if (includeTarget && target) lines.push(`- Target: ${targetLabel(target)}`);
    lines.push('');
    if (shiftedBody && shiftedBody.trim()) {
      lines.push(shiftedBody);
      lines.push('');
    }
  });
  return lines;
}

function renderTimelineSection(model) {
  const lines = ['## Timeline', ''];
  model.events.forEach((item) => {
    if (item.kind === 'note') {
      const target = item.note.target_id ? model.targetById[item.note.target_id] : null;
      const typeMeta = resolveNoteType(item.note.type, model.templateMeta);
      const targetPart = target ? ` - ${targetLabel(target)}` : '';
      lines.push(`- \`${formatTimestamp(item.ts)}\` [${typeMeta.label}] ${noteTitle(item.note, model.storage)}${targetPart}`);
      return;
    }

    const event = item.event || {};
    if (event.type === 'status') {
      lines.push(`- \`${formatTimestamp(item.ts)}\` Status: ${event.from || 'unknown'} -> ${event.to || 'unknown'}`);
    } else if (event.type === 'session_created') {
      lines.push(`- \`${formatTimestamp(item.ts)}\` Session created: ${event.name || model.session.codename}`);
    } else {
      lines.push(`- \`${formatTimestamp(item.ts)}\` Event: ${event.type || 'unknown'}`);
    }
  });
  return lines.join('\n');
}

function renderEvidenceSection(model) {
  const evidence = model.evidence
    .filter((entry) => ['export_only', 'both'].includes(String(entry.sync_mode || 'export_only').trim()))
    .sort((a, b) => (a.created || a.updated || 0) - (b.created || b.updated || 0));
  if (!evidence.length) return '';

  const lines = ['## Evidence', ''];
  evidence.forEach((entry) => {
    const target = entry.target_id ? model.targetById[entry.target_id] : null;
    lines.push(`### ${entry.title || 'Untitled'}`);
    lines.push('');
    lines.push(`- Type: ${evidenceType(entry.type)}`);
    lines.push(`- Target: ${target ? targetLabel(target) : 'Session-wide'}`);
    if (entry.impact) lines.push(`- Impact: ${entry.impact}`);
    if (entry.details) lines.push(`- Details: ${entry.details}`);
    if (entry.source_command) {
      lines.push('', '```text', escapeFenceContent(entry.source_command), '```');
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

function evidenceType(type) {
  const labels = {
    enumeration: 'Enumeration',
    initial_access: 'Initial Access',
    execution: 'Execution',
    persistence: 'Persistence',
    privilege_escalation: 'Privilege Escalation',
    credential_access: 'Credential Access',
    discovery: 'Discovery',
    lateral_movement: 'Lateral Movement',
    pivoting: 'Pivoting',
    collection: 'Collection',
    exfiltration: 'Exfiltration',
    finding: 'Finding',
    proof: 'Proof',
    cred: 'Credential',
    artifact: 'Artifact',
    privesc: 'PrivEsc',
    cleanup: 'Cleanup',
    note: 'Note',
  };
  return labels[String(type || '').trim()] || (type ? String(type) : 'Evidence');
}

function renderConsolidatedSession(model) {
  const lines = [
    `# ${model.session.codename}`,
    '',
    `**Exported:** ${formatTimestamp(model.exportedAt)} - `,
    `**Author:** ${model.author || '—'} - `,
    `**Duration:** ${model.stats.durationLabel} - `,
    `**Targets:** ${model.stats.targetCount}`,
  ];

  if (model.targets.length) {
    lines.push('', '---', '', '## Targets', '');
    model.targets.forEach((target) => {
      const section = renderTargetSection(target, model);
      if (section) {
        lines.push(section);
        lines.push('');
      }
    });
  }

  if (model.notes.main.length) {
    lines.push('---', '', '## Notes', '');
    model.notes.typeBuckets.forEach((bucket) => {
      lines.push(...renderNoteEntries(bucket, model, true));
    });
  }

  const summaryLoot = model.loot.filter((entry) => {
    if (!model.canonicalSources.credentials) return true;
    return !['cleartext', 'hash'].includes(String(entry.type || '').trim());
  });

  if (summaryLoot.length) {
    lines.push('---', '', '## Loot Summary', '');
    lines.push('| Type | Credential | Host | Context |');
    lines.push('|------|------------|------|---------|');
    summaryLoot
      .sort((a, b) => (a.added || 0) - (b.added || 0))
      .forEach((entry) => {
        lines.push(`| ${escapeTableCell(entry.type)} | \`${escapeTableCell(entry.credential)}\` | ${escapeTableCell(entry.host || '—')} | ${escapeTableCell(entry.note)} |`);
      });
    lines.push('');
  }

  const evidenceSection = renderEvidenceSection(model);
  if (evidenceSection) {
    lines.push('---', '', evidenceSection, '');
  }

  if (model.events.length) {
    lines.push('---', '', renderTimelineSection(model), '');
  }

  if (model.targets.length && model.notes.unassigned.length) {
    lines.push('---', '', '## Appendix - Unassigned Notes', '');
    model.notes.appendixBuckets.forEach((bucket) => {
      lines.push(...renderNoteEntries(bucket, model, false));
    });
  }

  return lines.join('\n').trimEnd() + '\n';
}

module.exports = {
  loadTemplateMeta,
  resolveNoteType,
  buildSessionExportModel,
  renderTargetNoteFile,
  renderSessionNoteFile,
  renderExportIndex,
  renderTimelineSummary,
  renderConsolidatedSession,
};
