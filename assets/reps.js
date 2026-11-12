/* Find your state senator and Assembly member from a New York City address.
   Geocoding: NYC Planning Labs GeoSearch (free, no key). District boundaries: NYC Department of City Planning via NYC Open Data. */
(function () {
  var box = document.getElementById('find-reps');
  if (!box) return;
  var root = document.documentElement.dataset.root || '';
  var form = box.querySelector('form'), input = box.querySelector('input'), out = box.querySelector('.reps-out');
  var maps = null;

  function loadMaps() {
    if (maps) return Promise.resolve(maps);
    return Promise.all(['senate', 'assembly'].map(function (n) {
      return fetch(root + 'data/' + n + '-districts.json').then(function (r) { return r.json(); });
    })).then(function (m) { maps = { senate: m[0], assembly: m[1] }; return maps; });
  }
  function inRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inPolygon(x, y, poly) {
    if (!inRing(x, y, poly[0])) return false;
    for (var k = 1; k < poly.length; k++) if (inRing(x, y, poly[k])) return false;
    return true;
  }
  function district(fc, x, y) {
    for (var i = 0; i < fc.features.length; i++) {
      var g = fc.features[i].geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (var p = 0; p < polys.length; p++) if (inPolygon(x, y, polys[p])) return String(fc.features[i].properties.d);
    }
    return null;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(html) { out.innerHTML = html; out.hidden = false; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    show('<p class="small">Looking up your address…</p>');
    Promise.all([
      fetch('https://geosearch.planninglabs.nyc/v2/search?size=1&text=' + encodeURIComponent(q)).then(function (r) { return r.json(); }),
      loadMaps()
    ]).then(function (res) {
      var f = res[0].features && res[0].features[0];
      if (!f) { show('<p>We couldn’t find that address. Try the house number, street and borough or ZIP code. This tool covers New York City addresses only.</p>'); return; }
      var x = f.geometry.coordinates[0], y = f.geometry.coordinates[1];
      var sd = district(maps.senate, x, y), ad = district(maps.assembly, x, y);
      if (!sd && !ad) { show('<p>That address doesn’t appear to be in New York City. This tool covers city addresses only.</p>'); return; }
      var html = '<p class="small">Results for <strong>' + esc(f.properties.label) + '</strong>. Not your address? Add the borough or ZIP code and try again.</p><div class="reps-grid">';
      if (sd) html += '<div class="rep"><p class="eyebrow">State Senate</p><h3>District ' + sd + '</h3><a class="btn" href="https://www.nysenate.gov/district/' + sd + '" target="_blank" rel="noopener">Your state senator</a></div>';
      if (ad) html += '<div class="rep"><p class="eyebrow">State Assembly</p><h3>District ' + ad + '</h3><a class="btn" href="https://nyassembly.gov/mem/?ad=' + ('00' + ad).slice(-3) + '" target="_blank" rel="noopener">Your Assembly member</a></div>';
      html += '</div><p class="small">Each link opens the official page with their name, office phone and contact form. Copy the letter, paste it into the form, and add one sentence about why it matters to you.</p>';
      show(html);
    }).catch(function () {
      show('<p>Something went wrong with the lookup. Please try again, or use the <a href="https://www.nysenate.gov/find-my-senator" target="_blank" rel="noopener">Senate</a> and <a href="https://nyassembly.gov/mem/search/" target="_blank" rel="noopener">Assembly</a> lookups.</p>');
    });
  });
})();
