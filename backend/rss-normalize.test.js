import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRssItem } from './rss-normalize.js';

test('normalizes common RSS and Atom fields while keeping the existing article shape', () => {
  const article = normalizeRssItem({
    title: '  Example story ',
    link: 'https://example.com/story',
    guid: 'story-123',
    contentSnippet: 'Short summary',
    'content:encoded': '<p>Full article</p>',
    pubDate: '2026-10-15T10:00:00Z',
    author: 'Reporter',
    categories: ['News', { term: 'Tech', label: 'Technology' }],
    enclosure: { url: 'https://example.com/photo.jpg', type: 'image/jpeg' },
    'media:thumbnail': { $: { url: 'https://example.com/thumb.jpg' } },
    'media:content': [{ $: { url: 'https://example.com/hero.jpg', medium: 'image' } }],
    source: { url: 'https://example.com' },
  });

  assert.equal(article.id, 'story-123');
  assert.equal(article.title.value, 'Example story');
  assert.equal(article.link, 'https://example.com/story');
  assert.equal(article.description.value, 'Short summary');
  assert.equal(article.content.value, '<p>Full article</p>');
  assert.equal(article.published.toISOString(), '2026-10-15T10:00:00.000Z');
  assert.equal(article.author.name, 'Reporter');
  assert.deepEqual(article.categories.map((x) => x.label), ['News', 'Technology']);
  assert.equal(article.attachments[0].mimeType, 'image/jpeg');
  assert.equal(article['media:thumbnail'].url, 'https://example.com/thumb.jpg');
  assert.equal(article['media:content'][0].medium, 'image');
  assert.equal(article.source.url, 'https://example.com');
});

test('tolerates missing or malformed optional media and dates', () => {
  const article = normalizeRssItem({
    title: 'Sparse feed',
    pubDate: 'not-a-date',
    'media:content': [null, {}, { $: {} }],
    enclosure: {},
    categories: [null, '', { label: '  ' }],
  });

  assert.equal(article.published, null);
  assert.deepEqual(article['media:content'], []);
  assert.deepEqual(article.attachments, []);
  assert.deepEqual(article.categories, []);
  assert.equal(article.author, null);
});

test('falls back to a readable description and link identifiers', () => {
  const article = normalizeRssItem({
    id: 'https://example.com/atom-entry',
    summary: 'Atom summary',
    content: { _: 'Atom full content' },
    updated: '2026-10-01T00:00:00Z',
  });

  assert.equal(article.link, 'https://example.com/atom-entry');
  assert.equal(article.description.value, 'Atom summary');
  assert.equal(article.content.value, 'Atom full content');
  assert.equal(article.updated.toISOString(), '2026-10-01T00:00:00.000Z');
});
