import { fetchRSSLinks } from './backend/newsroom-engine.js';

(async () => {
  try {
    const result = await fetchRSSLinks({ urls: ['https://somoskudasai.com/feed/'], limit: 5 });
    for (const feed of result) {
      console.log('FEED:', feed.title);
      for (let i = 0; i < feed.items.length; i++) {
        console.log(`  [${i}] Title:`, feed.items[i].title);
        console.log(`      Link:`, feed.items[i].link);
      }
    }
  } catch (err) {
    console.error(err);
  }
})();
