require('dotenv').config();
const RoamPrivateApi = require('roam-research-private-api');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

const appName = `${process.env.APP_NAME} v${process.env.VERSION}`;

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

  for (const title of allTitles) {
    const allRecords = (await keyvStore.get(title)) || [];
    const bookData = { string: `[[B: ${title}]]`, children: [] };
    if (allRecords.length) {
      allRecords
        .filter((rec) => !!rec.highlights.length)
        .forEach((rec) => {
          bookData.children.push(...rec.highlights.map((highlight) => ({ string: highlight })));
        });
    }

    if (bookData.children.length) importObject.children.push(bookData);
  }

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

  // TODO
  // write the last synced timestamp
  // from next time, get only highlights that are new
  // OR ommit highlights that are oledr than last written timestamp
})();
