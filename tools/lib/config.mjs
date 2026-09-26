// Loads site.config.json, applies a --mode override and checks every value the build relies on.
import { join } from 'node:path';
import { SiteError, fillTokens, readJson } from './util.mjs';

export const MODES = ['quiet', 'prelaunch', 'live'];

// Used for canonical URLs in quiet mode until site.url is set. ".invalid" can never resolve.
export const PLACEHOLDER_ORIGIN = 'https://site-url-not-set.invalid';

/**
 * @param {string} root
 * @param {{ mode?: string, liveGuard?: boolean }} [options]
 *   liveGuard: false lets the check script load a live config that's missing licence details,
 *   so it can report the problem instead of crashing.
 */
export function loadConfig(root, options = {}) {
  const config = readJson(join(root, 'site.config.json'));
  if (options.mode) config.mode = options.mode;

  const problems = validateConfig(config);
  if (config.mode === 'live' && options.liveGuard !== false) problems.push(...liveProblems(config));
  if (problems.length) throw new SiteError(problems, 'site.config.json needs fixing');

  config.site.url = config.site.url ? config.site.url.replace(/\/+$/, '') : null;
  config.origin = config.site.url ?? PLACEHOLDER_ORIGIN;
  return config;
}

/** Rule 9: live mode needs the licensee or business name, the contractor licence number and a phone number. */
export function liveProblems(config) {
  const licence = config.licence ?? {};
  const problems = [];
  if (!filled(licence.holderName) && !filled(licence.businessName)) {
    problems.push('Live mode needs licence.holderName or licence.businessName (rule 9).');
  }
  if (!filled(licence.number)) problems.push('Live mode needs licence.number, the contractor licence number (rule 9).');
  if (!filled(licence.phone)) problems.push('Live mode needs licence.phone, the business phone (rule 9).');
  return problems;
}

export function statusNoticeText(config) {
  if (config.mode === 'live') {
    const licence = config.licence;
    const name = filled(licence.businessName) ? licence.businessName : licence.holderName;
    return `${name}. Electrical contractor licence number ${licence.number}. Phone ${licence.phone}.`;
  }
  return fillTokens(config.notices.status, { name: config.person.name, statusPhrase: config.person.statusPhrase });
}

/** The exact text each data-compliance="allow" zone may contain. Build and check both use this. */
export function allowedZoneTexts(config) {
  return {
    'status-notice': statusNoticeText(config),
    'safety-note': config.notices.safetyNote,
    'contact-disclaimer': `${config.notices.contactDisclaimer} ${config.notices.licenceCheckLinkText}`,
  };
}

function filled(value) {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('[[');
}

function validateConfig(config) {
  const problems = [];
  const need = (condition, message) => {
    if (!condition) problems.push(message);
  };
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const isUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  };
  const isList = (value) => Array.isArray(value) && value.every(isText);

  need(MODES.includes(config.mode), `mode must be one of ${MODES.join(', ')} (it's "${config.mode}").`);

  const site = config.site ?? {};
  need(isText(site.name), 'site.name is missing.');
  need(site.url === null || isUrl(site.url), 'site.url must be a full https address, like https://example.com.au, or null.');
  if (config.mode !== 'quiet') need(site.url, `site.url must be set before ${config.mode} mode.`);
  need(Number.isInteger(site.launchYear) && site.launchYear >= 2026 && site.launchYear <= 2100, 'site.launchYear must be a year, like 2032.');
  need(site.ogImage === null || (isText(site.ogImage) && site.ogImage.startsWith('/')), 'site.ogImage must start with / or be null.');

  const person = config.person ?? {};
  need(isText(person.name), 'person.name is missing.');
  need(isText(person.firstName), 'person.firstName is missing.');
  need(isText(person.drawnBy), 'person.drawnBy is missing.');
  need(isText(person.statusPhrase), 'person.statusPhrase is missing. It completes "Jamil Flores is ..." in the status notice.');
  need(person.jobTitle === null || isText(person.jobTitle), 'person.jobTitle must be text or null.');
  need(person.email === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email ?? ''), 'person.email must be an email address or null.');
  need(person.linkedin === null || isUrl(person.linkedin), 'person.linkedin must be a full https address or null.');

  const notices = config.notices ?? {};
  for (const key of ['status', 'safetyNote', 'contactDisclaimer', 'licenceCheckLinkText']) {
    need(isText(notices[key]), `notices.${key} is missing.`);
  }
  need(isUrl(notices.licenceCheckUrl), 'notices.licenceCheckUrl must be a full https address.');
  need(/\{name\}/.test(notices.status ?? '') && /\{statusPhrase\}/.test(notices.status ?? ''), 'notices.status must contain {name} and {statusPhrase}.');

  need(Array.isArray(config.nav) && config.nav.every((item) => isText(item.label) && isText(item.path) && item.path.startsWith('/')), 'nav must be a list of { label, path } with paths starting with /.');
  need(isText(config.followPath) && config.followPath.startsWith('/'), 'followPath must start with /.');

  const categories = config.journal?.categories;
  need(Array.isArray(categories) && categories.length > 0, 'journal.categories must list at least one category.');
  for (const category of categories ?? []) {
    need(isText(category.slug) && /^[a-z0-9-]+$/.test(category.slug), `Category slug "${category.slug}" must be lowercase letters, numbers and hyphens.`);
    need(isText(category.name) && isText(category.description), `Category "${category.slug}" needs a name and a description.`);
  }
  need(Number.isInteger(config.journal?.wordsPerMinute) && config.journal.wordsPerMinute > 0, 'journal.wordsPerMinute must be a whole number.');

  for (const form of ['newsletter', 'contact']) {
    const settings = config.forms?.[form];
    need(settings && (settings.endpoint === null || isUrl(settings.endpoint)), `forms.${form}.endpoint must be a full https address or null.`);
    need(settings && isText(settings.honeypotField), `forms.${form}.honeypotField is missing.`);
    need(settings && typeof settings.ajax === 'boolean', `forms.${form}.ajax must be true or false.`);
    need(!settings?.endpoint || isText(settings.provider), `forms.${form}.provider must name the service when an endpoint is set. The privacy page names it.`);
    if (config.mode !== 'quiet') {
      need(settings?.endpoint || person.email, `${config.mode} mode needs forms.${form}.endpoint or person.email, so people have a way to reach you.`);
    }
  }

  need(person.photo === null || person.photo === undefined || (isText(person.photo?.src) && person.photo.src.startsWith('/') && isText(person.photo?.alt)), 'person.photo must be null or { "src": "/assets/img/...", "alt": "a description" }.');
  need(Array.isArray(config.credentials), 'credentials must be a list (it can be empty).');
  for (const credential of config.credentials ?? []) {
    need(isText(credential.title), 'Each credential needs a title.');
    need(credential.when === undefined || credential.when === null || isText(credential.when), `Credential "${credential.title}": when must be text, like "Early 2026", or left out.`);
    need(['completed', 'in-progress'].includes(credential.status), `Credential "${credential.title}": status must be completed or in-progress.`);
    need(typeof credential.verified === 'boolean', `Credential "${credential.title}": verified must be true or false. Only verified credentials appear on the site.`);
  }

  need(config.features && typeof config.features.aboutCommunity === 'boolean' && typeof config.features.aboutCommunication === 'boolean', 'features.aboutCommunity and features.aboutCommunication must be true or false.');
  need(isList(config.crawlers?.allow), 'crawlers.allow must be a list of crawler names.');

  const compliance = config.compliance ?? {};
  for (const key of ['offerPhrases', 'statusClaims', 'contactOptionTerms', 'bannedPathSegments', 'allowedSchemaTypes', 'bannedSchemaProperties']) {
    need(isList(compliance[key]) && compliance[key].length > 0, `compliance.${key} must be a non-empty list.`);
  }
  for (const key of ['bannedWords', 'vagueLinkText', 'properNouns']) {
    need(isList(config.style?.[key]), `style.${key} must be a list.`);
  }
  return problems;
}
