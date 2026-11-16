// 좌표 확인용 1회성 도구: OpenStreetMap 기반 Photon 검색(ODbL)으로 이름 후보를 출력한다. 의존성 없음.
// node tools/wish/geocode.mjs "상원사|37.7,128.6" "보리암"   (|위도,경도 = 그 근처 우선)
for (const arg of process.argv.slice(2)) {
  const [q, near] = arg.split('|');
  let u = 'https://photon.komoot.io/api/?limit=4&q=' + encodeURIComponent(q);
  if (near) { const [a, b] = near.split(','); u += `&lat=${a}&lon=${b}`; }
  console.log('## ' + arg);
  try {
    const j = await (await fetch(u, { headers: { 'User-Agent': 'static-site-geocheck/1.0' } })).json();
    for (const f of j.features) { const p = f.properties, [x, y] = f.geometry.coordinates; console.log(`  ${y.toFixed(5)}, ${x.toFixed(5)} | ${p.osm_key}/${p.osm_value} | ${p.name} · ${[p.street, p.district, p.city, p.county, p.state].filter(Boolean).join(' ')}`); }
    if (!j.features.length) console.log('  (없음)');
  } catch (e) { console.log('  (오류) ' + e.message); }
  await new Promise(s => setTimeout(s, 700));
}
