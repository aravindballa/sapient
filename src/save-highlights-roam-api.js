require('dotenv').config();
const RoamPrivateApi = require('roam-research-private-api');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

const appName = `${process.env.APP_NAME} v${process.env.VERSION}`;
const LAST_SYNC_KEY = 'lastSyncedToRoam';

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

  const allTitles = (await keyvStore.get('allTitles')) || [];
  console.log(allTitles);

  const importObject = {
    title: `[[${appName}]] synced at ${new Date().toTimeString()}`,
    children: [],
  };

  const lastSyncedTime = (await keyvStore.get(LAST_SYNC_KEY)) || 0;

  for (const title of allTitles) {
    const allRecords = (await keyvStore.get(title)) || [];
    const bookData = { string: `[[B: ${title}]]`, children: [] };
    if (allRecords.length) {
      allRecords
        .filter((rec) => !!rec.highlights.length)
        .filter((rec) => rec.synced > lastSyncedTime)
        .forEach((rec) => {
          bookData.children.push(...rec.highlights.map((highlight) => ({ string: highlight })));
        });
    }

    if (bookData.children.length) importObject.children.push(bookData);
  }

  console.log(importObject);

  if (importObject.children.length) {
    const api = new RoamPrivateApi(
      'aravindballa',
      process.env.ROAM_EMAIL,
      process.env.ROAM_PASSWORD,
      {
        headless: true,
        folder: './tmp/',
      }
    );
    await api.import([importObject]);
    await api.close();
  } else {
    console.log('Roam is already up to date...');
  }

  console.log('Updating the last synced timestamp');
  await keyvStore.set(LAST_SYNC_KEY, new Date().getTime());
})();
