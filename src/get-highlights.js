require('dotenv').config();

const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

const KINDLE_COOKIE_PATH = 'cookies/kindle.json';
const KINDLE_URL = 'https://read.amazon.com/notebook';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const saveCookies = async (page) => {
  const cookiesObject = await page.cookies();
  fs.writeFileSync(KINDLE_COOKIE_PATH, JSON.stringify(cookiesObject, null, 2), {
    encoding: 'utf-8',
  });
};

const login = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(KINDLE_URL);

  await page.waitForSelector('input[type="email"]');
  await page.focus('input[type="email"]');
  await page.keyboard.type(process.env.KINDLE_EMAIL);

  await page.waitForSelector('input[type="password"]');
  await page.focus('input[type="password"]');
  await page.keyboard.type(process.env.KINDLE_PASSWORD);

  await page.click('input[type="submit"]');

  // await page.$eval('.bp3-button', (el) => el.click());
  await sleep(5 * 1000);

  await saveCookies(page);

  await page.close();
  await browser.close();
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

  if (!fs.existsSync(KINDLE_COOKIE_PATH)) {
    await login();
  }
  await sleep(5 * 1000);
  console.log('Starting browser...');

  const browser = await puppeteer.launch({
    headless: false,
  });
  const kindlePage = await browser.newPage();
  const cookiesArr = require(`../${KINDLE_COOKIE_PATH}`);
  if (cookiesArr.length !== 0) {
    for (let cookie of cookiesArr) {
      await kindlePage.setCookie(cookie);
    }
    console.log('Session has been loaded in the browser');
  }
  await kindlePage.goto(KINDLE_URL, { waitUntil: 'networkidle0' });
  const cookieExpired = await kindlePage.$('input[type="password"]');
  if (cookieExpired) {
    await kindlePage.focus('input[type="email"]');
    await kindlePage.keyboard.type(process.env.KINDLE_EMAIL);

    await kindlePage.focus('input[type="password"]');
    await kindlePage.keyboard.type(process.env.KINDLE_PASSWORD);

    await kindlePage.click('input[type="submit"]');

    await sleep(5 * 1000);

    await saveCookies(kindlePage);
  }

  await kindlePage.waitForSelector('div.kp-notebook-library-each-book');
  const html = await kindlePage.content();
  const $ = cheerio.load(html);

  const allBookIds = $('div.kp-notebook-library-each-book')
    .map(function (i, el) {
      return cheerio
        .load(el)
        .html()
        .replace(/<div id="(.*?)".*/, '$1');
    })
    .get();

  /**Book titles */
  const allTitles = [];
  for (const bookId of allBookIds) {
    await kindlePage.click(`#${bookId}`);
    await kindlePage.waitForSelector('h3.kp-notebook-metadata');

    const html = await kindlePage.content();
    const $ = cheerio.load(html);

    const title = $('h3.kp-notebook-metadata').text();
    allTitles.push(title);

    // TODO get notes as well
    const highlights = $('span#highlight')
      .map((i, el) => {
        return cheerio.load(el).text();
      })
      .get();

    // await keyvStore.clear();
    /**
     * allRecords = [{highlights, synced}]
     */
    const allRecords = (await keyvStore.get(title)) || [];

    const existingHighlights = allRecords.reduce((eh, ar) => [...eh, ...ar.highlights], []);
    const newHighlights = highlights.filter((hl) => existingHighlights.indexOf(hl) === -1);

    if (newHighlights.length) {
      allRecords.push({ highlights: newHighlights, synced: new Date().getTime() });
      await keyvStore.set(title, allRecords);
    }

    console.log(title, '- Done!');
  }
  await keyvStore.set('allTitles', allTitles);

  await kindlePage.close();
  await browser.close();
})();
