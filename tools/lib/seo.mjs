// Page titles, robots rules, Open Graph values and JSON-LD.
// JSON-LD stays inside rule 6: WebSite, Person and BlogPosting only.

export function pageTitle(page, config) {
  if (page.metaTitle) return page.metaTitle;
  return page.title === config.site.name ? config.site.name : `${page.title} | ${config.site.name}`;
}

export function robotsFor(page, config) {
  if (config.mode === 'quiet') return 'noindex, nofollow';
  if (page.noindex) return 'noindex, follow';
  return null;
}

export function personLd(config) {
  const person = { '@type': 'Person', name: config.person.name, url: `${config.origin}/about/` };
  if (config.person.jobTitle) person.jobTitle = config.person.jobTitle;
  if (config.person.linkedin) person.sameAs = [config.person.linkedin];
  return person;
}

export function websiteLd(config) {
  return { '@type': 'WebSite', name: config.site.name, url: `${config.origin}/` };
}

export function blogPostingLd(post, config) {
  const posting = {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    url: `${config.origin}${post.url}`,
    mainEntityOfPage: `${config.origin}${post.url}`,
    author: personLd(config),
  };
  if (post.images.length) posting.image = post.images.map((image) => new URL(image.src, `${config.origin}/`).href);
  return posting;
}

/** Turns a list like ["website", "person"] into one JSON-LD script tag. */
export function jsonLdScript(kinds, config, post = null) {
  const items = [];
  for (const kind of kinds) {
    if (kind === 'website') items.push(websiteLd(config));
    else if (kind === 'person') items.push(personLd(config));
    else if (kind === 'post' && post) items.push(blogPostingLd(post, config));
    else throw new Error(`Unknown schema "${kind}". Use website, person or post.`);
  }
  if (!items.length) return '';
  const data = items.length === 1
    ? { '@context': 'https://schema.org', ...items[0] }
    : { '@context': 'https://schema.org', '@graph': items };
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
