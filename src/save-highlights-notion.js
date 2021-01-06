const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

const NOTION_COOKIE_PATH = 'cookies/notion.json';
const NOTION_URL =
  'https://www.notion.so/aravindballa/Sapient-Highlights-70a7b8a2710b4dfda81caad953f1b63d';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Heplers
const cursorAtEnd = async (page) => {
  await page.evaluate(() => {
    document.querySelector('div.notion-page-content').lastChild.click();
  });
  // await page.keyboard.press('Escape', { delay: 200 });
  await page.keyboard.press('Enter', { delay: 200 });
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

  if (!fs.existsSync(NOTION_COOKIE_PATH)) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(NOTION_URL);
    await sleep(30 * 1000);
    const cookiesObject = await page.cookies();
    fs.writeFileSync(NOTION_COOKIE_PATH, JSON.stringify(cookiesObject, null, 2), {
      encoding: 'utf-8',
    });
    await page.close();
    await browser.close();
  }
  // await sleep(5 * 1000);
  console.log('Starting browser...');

  const browser = await puppeteer.launch({ headless: false });
  const notionPage = await browser.newPage();
  try {
    const cookiesArr = require(`../${NOTION_COOKIE_PATH}`);
    if (cookiesArr.length !== 0) {
      for (let cookie of cookiesArr) {
        await notionPage.setCookie(cookie);
      }
      console.log('Session has been loaded in the browser');
    }
    await notionPage.goto(NOTION_URL, { waitUntil: 'networkidle0' });

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

    // TODO get the last sycned time and get all the highlights that were not synced

    const allTitles = (await keyvStore.get('allTitles')) || [];
    console.log(allTitles);
    for (const title of allTitles) {
      console.log('starting' + title);
      /**
       * Strategy (works for Roam too)
       * Make a page for each book. If not found `+Book Name Enter`
       * On Loop
       *  Click on the book
       *  Go to last text block
       *  Press Enter
       *  Add content
       *  Come back
       */
      // Navigate to the book page
      const [bookBlock] = await notionPage.$x(`//a[contains(., '${title}')]`);
      if (bookBlock) {
        await Promise.all([notionPage.waitForNavigation(), bookBlock.click()]);
      } else {
        // Create the new book page
        await cursorAtEnd(notionPage);
        await notionPage.keyboard.type('+' + title, {
          delay: 200,
        });
        await notionPage.keyboard.press('Enter', { delay: 200 });
        const [newBookBlock] = await notionPage.$x(`//a[contains(., '${title}')]`);
        if (newBookBlock) {
          await Promise.all([notionPage.waitForNavigation(), newBookBlock.click()]);
          await notionPage.keyboard.press('Enter', { delay: 200 });
        }
      }

      // Come back to the main page
      await notionPage.keyboard.down('MetaLeft');
      await notionPage.keyboard.press('[', { delay: 100 });
      await notionPage.keyboard.up('MetaLeft');
      await notionPage.keyboard.press('Enter', { delay: 100 });
    }

    // get content in Markdown
    // const allRecords =
    //   (await keyvStore.get('The End of Jobs: Money, Meaning and Freedom Without the 9-to-5')) || [];

    // // TODO do it for each page

    // const contentToType = [`## The End of Jobs: Money, Meaning and Freedom Without the 9-to-5`];
    // allRecords
    //   .filter((rec) => !!rec.highlights.length)
    //   .forEach((rec) => {
    //     contentToType.push(`### _Synced on ${new Date(rec.synced).toDateString()}_`);
    //     contentToType.push(...rec.highlights);
    //   });

    // // add content
    // await notionPage.keyboard.press('Enter', { delay: 200 });
    // for (const content of contentToType) {
    //   await notionPage.keyboard.type(content, {
    //     delay: 100,
    //   });
    //   await notionPage.keyboard.press('Enter', { delay: 100 });
    // }

    await sleep(5 * 1000);
  } catch (err) {
    console.log(err);
  } finally {
    await notionPage.close();
    await browser.close();
  }
})();
