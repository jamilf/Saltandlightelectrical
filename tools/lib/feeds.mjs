// robots.txt, sitemap.xml, rss.xml, llms.txt and _headers.
import { statusNoticeText } from './config.mjs';
import { escapeXml, rfc822 } from './util.mjs';

export function robotsTxt(config) {
  if (config.mode === 'quiet') {
    return [
      '# Quiet mode: this site is not ready for search engines yet.',
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
  }
  return [
    'User-agent: *',
    'Allow: /',
    '',
    ...config.crawlers.allow.map((name) => `User-agent: ${name}`),
    'Allow: /',
    '',
    `Sitemap: ${config.origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(pages, config) {
  const entries = pages
    .filter((page) => page.sitemap)
    .map((page) => `  <url>\n    <loc>${escapeXml(config.origin + page.path)}</loc>\n    <lastmod>${page.lastmod}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export function rssXml(posts, config, lastDate) {
  const items = posts.map((post) => [
    '    <item>',
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(config.origin + post.url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(config.origin + post.url)}</guid>`,
    `      <pubDate>${rfc822(post.date)}</pubDate>`,
    `      <category>${escapeXml(post.category.name)}</category>`,
    `      <description>${escapeXml(post.summary)}</description>`,
    '    </item>',
  ].join('\n'));
  const description = `Journal of ${config.person.name}, building ${config.site.name} in public. ${statusNoticeText(config)}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(config.site.name)} journal</title>`,
    `    <link>${escapeXml(config.origin)}/journal/</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>en-au</language>',
    `    <lastBuildDate>${rfc822(lastDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(config.origin)}/rss.xml" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

export function llmsTxt(config, milestones) {
  const url = (path) => `${config.origin}${path}`;
  const current = milestones.current ? `Current stage: ${milestones.current.title}.` : '';
  return [
    `# ${config.site.name}`,
    '',
    `> ${statusNoticeText(config)} ${config.site.name} is planned to open in ${config.site.launchYear}, once licensed. This site is where ${config.person.name} documents the road from apprentice to licensed contractor.`,
    '',
    `Run by ${config.person.name}, New South Wales, Australia. ${current} Last updated ${milestones.latest.date}.`,
    '',
    '## Main pages',
    '',
    `- [Home](${url('/')}): what the site is and where things are at`,
    `- [Road to launch](${url('/road-to-launch/')}): the plan, stage by stage, with a revision history`,
    `- [Journal](${url('/journal/')}): dated entries about the trade and about building the business`,
    `- [About](${url('/about/')}): who runs the site and where the name comes from`,
    `- [Contact](${url('/contact/')}): how to get in touch`,
    `- [RSS feed](${url('/rss.xml')}): journal entries as a feed`,
    '',
  ].join('\n');
}

export function headersFile(config) {
  const endpoints = [config.forms.newsletter.endpoint, config.forms.contact.endpoint]
    .filter(Boolean)
    .map((endpoint) => new URL(endpoint).origin);
  const analytics = Boolean(config.analytics.cloudflareWebAnalyticsToken);
  const unique = (list) => [...new Set(list)].join(' ');
  const csp = [
    "default-src 'self'",
    `script-src ${unique(["'self'", ...(analytics ? ['https://static.cloudflareinsights.com'] : [])])}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${unique(["'self'", ...endpoints, ...(analytics ? ['https://cloudflareinsights.com'] : [])])}`,
    `form-action ${unique(["'self'", ...endpoints])}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  const lines = [
    '/*',
    ...(config.mode === 'quiet' ? ['  X-Robots-Tag: noindex, nofollow'] : []),
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    `  Content-Security-Policy: ${csp}`,
    '',
    '/assets/fonts/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/css/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/js/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ];
  return lines.join('\n');
}
