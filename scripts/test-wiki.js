const fetch = require('node-fetch');

async function testWiki() {
  const artist = "Led Zeppelin";
  const url = `https://it.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&titles=${encodeURIComponent(artist)}&format=json&exintro=1&origin=*&pithumbsize=500`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
testWiki();
