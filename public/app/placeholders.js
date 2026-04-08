(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PRAGMA_PLACEHOLDERS = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const GROUP_ALIASES = {
    ip: ['IP', 'TARGET', 'TARGET_IP', 'RHOST', 'HOST', 'TARGET_IP_ADDRESS', 'MACHINE_IP'],
    domain: ['DOMAIN', 'TARGET_DOMAIN', 'FQDN', 'DC', 'WORKGROUP'],
    label: ['LABEL', 'TARGET_LABEL'],
    attacker: ['ATTACKER', 'ATTACKER_IP', 'ATTACKER-IP'],
  };

  const GROUP_BARE_ALIASES = {
    ip: ['IP', 'TARGET', 'TARGET_IP', 'RHOST', 'HOST', 'TARGET_IP_ADDRESS', 'MACHINE_IP'],
    domain: ['DOMAIN', 'TARGET_DOMAIN', 'WORKGROUP'],
    label: ['LABEL', 'TARGET_LABEL'],
    attacker: ['ATTACKER', 'ATTACKER_IP', 'ATTACKER-IP'],
  };

  const GROUP_EXTRAS = {
    ip: ['10.10.10.X', '10.10.X.X'],
    domain: [],
    label: [],
    attacker: [],
  };

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildDelimitedPatterns(alias, { htmlEscapedAngles = false } = {}) {
    const token = escapeRegExp(alias);
    const patterns = [
      new RegExp(`<${token}>`, 'gi'),
      new RegExp(`\\{${token}\\}`, 'gi'),
      new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'gi'),
      new RegExp(`\\$${token}\\b`, 'gi'),
    ];
    if (htmlEscapedAngles) patterns.push(new RegExp(`&lt;${token}&gt;`, 'gi'));
    return patterns;
  }

  function buildBarePattern(alias) {
    return new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g');
  }

  function uniquePatterns(patterns) {
    const seen = new Set();
    return patterns.filter((pattern) => {
      const key = `${pattern.source}/${pattern.flags}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildGroupPatterns(group, options = {}) {
    const aliases = GROUP_ALIASES[group] || [];
    const bareAliases = GROUP_BARE_ALIASES[group] || aliases;
    const extras = GROUP_EXTRAS[group] || [];
    const patterns = [];

    aliases.forEach((alias) => {
      patterns.push(...buildDelimitedPatterns(alias, options));
    });
    bareAliases.forEach((alias) => patterns.push(buildBarePattern(alias)));
    extras.forEach((token) => patterns.push(buildBarePattern(token)));

    return uniquePatterns(patterns);
  }

  function getPlaceholderMatchers(options = {}) {
    return {
      ipPatterns: buildGroupPatterns('ip', options),
      domainPatterns: buildGroupPatterns('domain', options),
      labelPatterns: buildGroupPatterns('label', options),
      attackerPatterns: buildGroupPatterns('attacker', options),
    };
  }

  return {
    getPlaceholderMatchers,
  };
}));
