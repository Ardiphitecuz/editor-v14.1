/**
 * Normalize rss-parser items into the article shape used by newsroom-engine.
 * Keep this adapter separate so feed edge cases can be tested without network I/O.
 */

function textValue(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && typeof value._ === 'string') return value._.trim();
  return '';
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mediaUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return textValue(value.url) || textValue(value.$?.url) || textValue(value.href);
}

function normalizeMediaContent(value) {
  return asArray(value).map((media) => {
    if (!media || typeof media !== 'object') return null;
    const attrs = media.$ || media;
    const url = mediaUrl(media) || mediaUrl(attrs);
    if (!url) return null;
    return {
      url,
      medium: textValue(attrs.medium) || textValue(media.medium),
      type: textValue(attrs.type) || textValue(media.type),
      width: attrs.width ?? media.width ?? null,
      height: attrs.height ?? media.height ?? null,
    };
  }).filter(Boolean);
}

function normalizeAttachment(enclosure) {
  if (!enclosure || typeof enclosure !== 'object') return null;
  const url = mediaUrl(enclosure);
  if (!url) return null;
  return {
    url,
    mimeType: textValue(enclosure.type) || textValue(enclosure.mimeType),
    length: enclosure.length ?? null,
  };
}

function normalizeCategories(value) {
  return asArray(value).map((category) => {
    if (typeof category === 'string') {
      const label = category.trim();
      return label ? { label, term: label } : null;
    }
    if (!category || typeof category !== 'object') return null;
    const label = textValue(category.label) || textValue(category.term) || textValue(category._);
    return label ? { label, term: textValue(category.term) || label } : null;
  }).filter(Boolean);
}

/**
 * @param {Record<string, any>} item RSSParser item
 * @returns {Record<string, any>} legacy-compatible normalized article
 */
export function normalizeRssItem(item = {}) {
  const raw = item && typeof item === 'object' ? item : {};
  const authorName = textValue(raw.author) || textValue(raw['dc:creator']) ||
    textValue(raw.creator) || textValue(raw['itunes:author']);
  const published = validDate(raw.isoDate) || validDate(raw.pubDate) ||
    validDate(raw.published) || validDate(raw.date);
  const updated = validDate(raw.updated) || validDate(raw['atom:updated']) ||
    validDate(raw.isoDate);

  const sourceRaw = raw.source;
  const sourceUrl = typeof sourceRaw === 'string'
    ? sourceRaw
    : textValue(sourceRaw?.url) || textValue(sourceRaw?.href);

  const mediaThumbnail = mediaUrl(raw['media:thumbnail']) ||
    mediaUrl(raw.mediaThumbnail) || mediaUrl(raw.thumbnail);
  const mediaContents = normalizeMediaContent(raw['media:content'] ?? raw.mediaContent);
  const attachments = asArray(raw.enclosure ?? raw.enclosures)
    .map(normalizeAttachment).filter(Boolean);

  const description = textValue(raw.contentSnippet) ||
    textValue(raw.summary) ||
    textValue(raw.description) ||
    textValue(raw['media:description']);

  const content = textValue(raw['content:encoded']) ||
    textValue(raw.content) ||
    textValue(raw.contentEncoded) ||
    description;

  const link = textValue(raw.link) ||
    textValue(raw.guid?.isPermaLink === false ? '' : raw.guid) ||
    textValue(raw.id);

  return {
    id: textValue(raw.guid) || textValue(raw.id) || link || null,
    title: { value: textValue(raw.title) },
    links: link ? [{ href: link }] : [],
    link,
    description: { value: description },
    content: { value: content },
    published,
    updated,
    author: authorName ? { name: authorName } : null,
    categories: normalizeCategories(raw.categories ?? raw.category),
    attachments,
    'media:content': mediaContents,
    'media:thumbnail': mediaThumbnail ? { url: mediaThumbnail } : null,
    'media:group': raw['media:group'] ?? raw.mediaGroup ?? null,
    'media:description': { value: textValue(raw['media:description']) },
    'media:community': raw['media:community'] ?? raw.mediaCommunity ?? null,
    'dc:subject': textValue(raw['dc:subject']) || null,
    source: sourceUrl ? { url: sourceUrl } : null,
  };
}
