// Debug script untuk lihat extraction hasil dari seputarotaku.com
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const testUrl = 'https://seputarotaku.com/game-sword-art-online-echoes-of-aincrad-hadirkan-death-game-mode/';

async function debugExtraction() {
  try {
    const response = await fetch(testUrl);
    const html = await response.text();
    
    // Parse dengan JSDOM (lebih mirip browser daripada DOMParser)
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Cari body element
    const selectors = [
      ".entry-content", ".post-content", ".article-body", ".article-content",
      ".post-body", ".article-text", ".main-text", ".entry-body", ".content-body",
      "#article-body", "#post-body", "#content", "#the-content", ".matome-body",
      "article", "main",
    ];
    
    let bodyEl = null;
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el && (el.textContent?.trim().length ?? 0) > 150) {
        console.log(`✓ Found body with selector: ${sel}`);
        bodyEl = el;
        break;
      }
    }
    
    const source = bodyEl || doc.body;
    
    // List semua direct children dengan text
    const elements = Array.from(source.children);
    console.log(`\n📄 Total direct children: ${elements.length}\n`);
    
    const RECOMMENDATION_PATTERN = /recommended|suggested|related|terakhir|terbaru|artikel|post|berita|konten/i;
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const text = el.textContent?.trim() ?? "";
      const shortText = text.slice(0, 80).replace(/\n/g, ' ');
      
      // Check recommendation pattern
      const matchesPattern = RECOMMENDATION_PATTERN.test(text);
      const cardCount = el.querySelectorAll("img, [class*='card'], [class*='item'], .post").length;
      
      console.log(`[${i}] ${el.tagName.toLowerCase()} | len=${text.length} | cards=${cardCount} | pattern=${matchesPattern ? '✓' : '-'}`);
      if (text.length < 100) {
        console.log(`     → "${shortText}..."`);
      } else {
        console.log(`     → "${shortText}..."`);
      }
      
      // If matches pattern, show next 5 elements
      if (matchesPattern && text.length < 100) {
        console.log(`     🔍 PATTERN MATCH! Checking next 6 elements for cards:`);
        let totalCards = 0;
        for (let j = i; j < Math.min(i + 6, elements.length); j++) {
          const nextEl = elements[j];
          const nextCards = nextEl.querySelectorAll("img, [class*='card'], [class*='item'], .post").length;
          totalCards += nextCards;
          console.log(`        [${j}] ${nextEl.tagName} | cards=${nextCards} | text="${nextEl.textContent?.trim().slice(0, 40)}..."`);
        }
        console.log(`     → Total cards in next 6: ${totalCards}`);
        if (totalCards >= 2) {
          console.log(`     ✓✓✓ RECOMMENDATION SECTION DETECTED AT INDEX ${i}! ✓✓✓\n`);
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugExtraction();
