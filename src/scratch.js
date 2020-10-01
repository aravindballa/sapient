const Keyv = require('keyv');
const KeyvFile = require('keyv-file').KeyvFile;

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

  const allRecords =
    (await keyvStore.get('The End of Jobs: Money, Meaning and Freedom Without the 9-to-5')) || [];
  console.log(allRecords);
})();
