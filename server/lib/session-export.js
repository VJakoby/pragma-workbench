'use strict';

const fs = require('fs');

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
  let output = String(text);

  if (ip) {
    const ipPatterns = [
      /<IP>/g, /<ip>/g, /<TARGET_IP>/g,
      /<target_ip>/g, /<TARGET>/g, /<RHOST>/g,
      /<rhost>/g, /<HOST>/g, /<host>/g,
      /\bTARGET_IP\b/g, /\bRHOST\b/g, /\bTARGET\b/g,
      /\$IP\b/g, /\$RHOST\b/g, /\$TARGET\b/g, /\$TARGET_IP\b/g,
      /\$HOST\b/g,
      /\{IP\}/g, /\{ip\}/g, /\{RHOST\}/g, /\{rhost\}/g, /\{TARGET\}/g,
      /\{\{ip\}\}/g, /\{\{IP\}\}/g, /\{\{target\}\}/g, /\{\{rhost\}\}/g,
      /\{HOST\}/g, /\{host\}/g, /\{\{host\}\}/g, /\{\{HOST\}\}/g,
      /\bTARGET_IP_ADDRESS\b/g, /<MACHINE_IP>/g, /\bMACHINE_IP\b/g,
      /\b10\.10\.10\.X\b/g, /\b10\.10\.X\.X\b/g,
    ];
    output = replaceAllPatterns(output, ipPatterns, ip);
    output = output.replace(/\bIP\b/g, ip).replace(/\bHOST\b/g, ip);
  }

  if (domain) {
    const domainPatterns = [
      /<DOMAIN>/g, /<domain>/g, /<TARGET_DOMAIN>/g,
      /<FQDN>/g, /<fqdn>/g, /<DC>/g, /<dc>/g,
      /\bTARGET_DOMAIN\b/g, /\bDOMAIN\b/g,
      /\$DOMAIN\b/g, /\$FQDN\b/g, /\$DC\b/g,
      /\{DOMAIN\}/g, /\{domain\}/g, /\{FQDN\}/g, /\{\{domain\}\}/g,
      /<WORKGROUP>/g, /\bWORKGROUP\b/g,
    ];
    output = replaceAllPatterns(output, domainPatterns, domain);
  }

  if (label) {
    const labelPatterns = [
      /<LABEL>/g, /<label>/g, /<TARGET_LABEL>/g,
      /\{LABEL\}/g, /\{label\}/g, /\{\{label\}\}/g, /\{\{LABEL\}\}/g,
    ];
    output = replaceAllPatterns(output, labelPatterns, label);
  }

  return output;
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

function buildSessionExportModel({ session, notes, storage, templateMeta }) {
  const exportedAt = Date.now();
  const targets = Array.isArray(session.targets) ? [...session.targets] : [];
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
    session,
    storage,
    sessionSlug: storage.slugify(session.codename),
    exportedAt,
    templateMeta,
    targets,
    targetById,
    services,
    paths,
    loot,
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

function renderTargetNoteFile({ note, session, target, typeMeta, storage }) {
  const title = injectTargetPlaceholders(noteTitle(note, storage), target);
  const label = targetLabel(target);
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
    injectTargetPlaceholders(note.body || '', target),
  ].join('\n');
}

function renderSessionNoteFile({ note, session, typeMeta, storage }) {
  const title = noteTitle(note, storage);
  return [
    `# ${title}`,
    '',
    `> **Type:** \`${typeMeta.label}\``,
    `> **Session:** ${session.codename}`,
    `> **Created:** ${formatTimestamp(noteTimestamp(note))}`,
    '',
    '---',
    '',
    note.body || '',
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
          const title = noteTitle(note, model.storage);
          const preview = (note.body || '')
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
    const resolvedTitle = target ? injectTargetPlaceholders(noteTitle(note, model.storage), target) : noteTitle(note, model.storage);
    const resolvedBody = target ? injectTargetPlaceholders(note.body || '', target) : (note.body || '');
    lines.push(`#### ${resolvedTitle}`);
    lines.push('');
    lines.push(`- Type: ${bucket.label}`);
    lines.push(`- Created: ${formatTimestamp(noteTimestamp(note))}`);
    if (includeTarget && target) lines.push(`- Target: ${targetLabel(target)}`);
    lines.push('');
    if (resolvedBody && resolvedBody.trim()) {
      lines.push(resolvedBody.trimEnd());
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

function renderConsolidatedSession(model) {
  const lines = [
    `# ${model.session.codename}`,
    '',
    `**Exported:** ${formatTimestamp(model.exportedAt)} - `,
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
