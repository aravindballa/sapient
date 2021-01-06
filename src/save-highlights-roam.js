require('dotenv').config();

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const format = require('date-fns/format');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

const COOKIE_PATH = 'cookies/roam.json';
const PAGE_URL = 'https://roamresearch.com/#/app/aravindballa/page/9xhY7w9Fv';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Heplers
const cursorAtEnd = async (page) => {
  await sleep(2000);
  await page.evaluate(() => {
    const blocks = document.querySelectorAll(
      '.rm-block-children > .roam-block-container > .rm-block-main > .rm-block__input'
    );
    const lastBlock = blocks[blocks.length - 1];
    console.log(lastBlock);
    lastBlock.click();
  });
  await page.keyboard.down('MetaLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.up('MetaLeft');
  await page.keyboard.press('Enter', { delay: 200 });
};

(async () => {
  const keyvStore = new Keyv({
    store: new KeyvFile({
      filename: `highlights-db.json`, // the file path to store the data
      writeDelay: 100, // ms, batch write to disk in a specific duration, enhance write performance.
      encode: JSON.stringify, // serialize function
      decode: JSON.parse, // deserialize function
    }),
    namespace: 'highlights',
  });

  // await sleep(5 * 1000);
  console.log('Starting browser...');

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  try {
    await page.goto(PAGE_URL);
    await page.waitForSelector('[name="email"]');
    await page.focus('[name="email"]');
    await page.keyboard.type(process.env.ROAM_EMAIL);

    await page.focus('[name="password"]');
    await page.keyboard.type(process.env.ROAM_PASSWORD);

    await page.$eval('.bp3-button', (el) => el.click());
    console.log('logged in');

    // await page.goto(PAGE_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.roam-article');

    // await sleep(5 * 1000);

    console.log('ready');

    const html = await page.content();
    const $ = cheerio.load(html);

    const lastTextBlock = $(
      '.roam-article > div > .rm-block-children > .roam-block-container > .rm-block-main > .rm-block__input'
    ).last();
    const lastTextBlockId = lastTextBlock.attr('id');
    console.log(lastTextBlockId);

    await page.waitForSelector(`#${lastTextBlockId}`);
    await page.click(`#${lastTextBlockId}`);
    // doesn't work for some reason
    await page.keyboard.down('MetaRight');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.up('MetaRight');
    await page.keyboard.press('Enter', { delay: 200 });

    // START ENTERING DATA

    await sleep(2000);

    await page.keyboard.type(`[[${format(new Date(), 'do MMMM, yyyy')}]]`);
    await sleep(1000);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const allRecords =
      (await keyvStore.get('The End of Jobs: Money, Meaning and Freedom Without the 9-to-5')) || [];
    const contentToType = [];
    allRecords
      .filter((rec) => !!rec.highlights.length)
      .forEach((rec) => {
        contentToType.push(...rec.highlights);
      });

    await page.keyboard.type(
      `[[B: The End of Jobs: Money, Meaning and Freedom Without the 9-to-5]]`
    );
    await sleep(1000);
    await page.keyboard.press('Enter');
    for (const content of contentToType) {
      await page.keyboard.type(content);
      await sleep(1000);
      await page.keyboard.press('Enter');
    }

    // await cursorAtEnd(page);

    await sleep(10 * 1000);

    // const html = await notionPage.content();
    // const $ = cheerio.load(html);

    // const lastTextBlockId = $('div.notion-text-block').last().data('block-id');
    // console.log(lastTextBlockId);

    // await notionPage.click(`[data-block-id="${lastTextBlockId}"]`);

    // clear everything
    // await notionPage.keyboard.down('MetaLeft');
    // await notionPage.keyboard.press('KeyA', { delay: 200 });
    // await notionPage.keyboard.press('KeyA', { delay: 200 });
    // await notionPage.keyboard.up('MetaLeft');
    // await notionPage.keyboard.press('Delete', { delay: 200 });
    // await notionPage.keyboard.press('Enter', { delay: 200 });
  } catch (err) {
    console.log(err);
  } finally {
    await page.close();
    await browser.close();
  }
})();
