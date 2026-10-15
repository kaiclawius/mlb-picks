// ChumGPT's own face: the CHUM·TRONIX 3000. One function draws every mood as an SVG string.
// The site uses it live, the share card draws it on a canvas, and the build script writes kit/chumgpt.svg from it.
(function (g) {
  var PHOS = '#7dff8a', RED = '#ff5a4a', DARK = '#021a0b', AMBER = '#ffc24a';
  var cells = function (list, ox, oy, s, fill) {
    return list.map(function (c) { return '<rect x="' + (ox + c[0] * s) + '" y="' + (oy + c[1] * s) + '" width="' + s + '" height="' + s + '" fill="' + fill + '"/>'; }).join('');
  };
  var MOUTH = {
    smile: [[0, 0], [1, 1], [2, 1], [3, 1], [4, 1], [5, 0]],
    frown: [[0, 1], [1, 0], [2, 0], [3, 0], [4, 0], [5, 1]],
    flat: [[1, 0], [2, 0], [3, 0], [4, 0]],
    smirk: [[1, 1], [2, 1], [3, 1], [4, 0], [5, -1]],
    open: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2]],
    grin: [[0, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]
  };
  var TALK = [
    [[1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [2, 1], [3, 1], [4, 1]],
    MOUTH.open
  ];
  var MOOD = {
    scheme: { mouth: 'smirk', lid: 18, pupil: [-12, 4] },
    laugh: { mouth: 'open', eye: 'happy' },
    rage: { mouth: 'frown', brow: true, glow: RED },
    sad: { mouth: 'frown', lid: 26, pupil: [0, 10], tear: true },
    smug: { mouth: 'smirk', lid: 26, pupil: [10, 6] },
    yes: { mouth: 'smile', sparkle: true },
    conquer: { mouth: 'grin', crown: true, pupil: [0, -6] },
    karen: { mouth: 'flat', pupil: [16, 0], sweat: true }
  };

  function face(mood, opt) {
    opt = opt || {};
    var m = MOOD[mood] || MOOD.smug, id = opt.id || 'cf', glow = m.glow || PHOS, p = m.pupil || [0, 0];
    var eye;
    if (m.eye === 'happy') {
      eye = cells([[0, 3], [1, 2], [2, 1], [3, 0], [4, 1], [5, 2], [6, 3]], 158, 156, 12, glow);
    } else {
      eye = '<rect x="170" y="150" width="60" height="60" fill="' + glow + '"/>' +
        '<g class="pupil"><rect x="' + (190 + p[0]) + '" y="' + (170 + p[1]) + '" width="20" height="20" fill="' + DARK + '"/>' +
        (m.sparkle ? '<rect x="' + (192 + p[0]) + '" y="' + (172 + p[1]) + '" width="6" height="6" fill="#eafff0"/>' : '') + '</g>' +
        (m.lid ? '<rect x="168" y="148" width="64" height="' + (m.lid + 2) + '" fill="' + DARK + '"/>' : '');
    }
    var extra = '';
    if (m.brow) extra += '<path d="M156 128 L200 146 L244 128 L244 140 L200 158 L156 140 Z" fill="' + glow + '"/>';
    if (m.tear) extra += cells([[0, 0], [0, 1]], 236, 206, 8, '#8fd3ff');
    if (m.sweat) extra += cells([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], 250, 140, 6, '#8fd3ff');
    if (m.crown) extra += cells([[0, 0], [2, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], 175, 128, 10, AMBER);
    var mouth = '<g class="mouth">' + cells(MOUTH[m.mouth], 170, 232, 10, glow) + '</g>';
    // opt.talk adds three hidden mouth frames (closed, half, wide) that a speaking scene can flip through
    if (opt.talk) mouth += '<g class="talk" style="display:none">' + TALK.map(function (f, i) { return '<g class="t' + i + '" style="display:none">' + cells(f, 170, 232, 10, glow) + '</g>'; }).join('') + '</g>';

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="ChumGPT, ' + (mood || 'smug') + '">' +
      '<defs>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbc5b0"/><stop offset="1" stop-color="#8f8a79"/></linearGradient>' +
      '<radialGradient id="' + id + 's" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="' + (m.glow ? '#2a0806' : '#06331a') + '"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient>' +
      '<pattern id="' + id + 'l" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="rgba(0,0,0,.28)"/></pattern>' +
      '<filter id="' + id + 'g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="' + id + 'n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '</defs>' +
      '<ellipse cx="200" cy="372" rx="150" ry="14" fill="rgba(0,0,0,.35)"/>' +
      '<path d="M300 330 C 350 340, 330 380, 392 376" stroke="#2a2f2c" stroke-width="7" fill="none" stroke-linecap="round"/>' +
      '<rect x="150" y="318" width="100" height="30" rx="4" fill="#7d7869"/><rect x="118" y="344" width="164" height="18" rx="9" fill="#9a9583"/>' +
      '<g transform="rotate(-14 236 60)"><rect x="232" y="20" width="8" height="78" rx="3" fill="#b9bfc2"/><rect x="224" y="14" width="24" height="10" rx="2" fill="#b9bfc2"/>' +
      '<rect x="224" y="0" width="4" height="22" fill="#b9bfc2"/><rect x="231" y="0" width="4" height="22" fill="#b9bfc2"/><rect x="238" y="0" width="4" height="22" fill="#b9bfc2"/><rect x="244" y="0" width="4" height="22" fill="#b9bfc2"/>' +
      '<rect x="222" y="68" width="28" height="14" fill="rgba(240,226,180,.85)"/></g>' +
      '<rect x="56" y="88" width="288" height="236" rx="24" fill="url(#' + id + 'b)" stroke="#2a2f2c" stroke-width="4"/>' +
      (opt.lite ? '' : '<rect x="56" y="88" width="288" height="236" rx="24" fill="#000" filter="url(#' + id + 'n)" opacity=".9"/>') +
      '<rect x="84" y="112" width="232" height="176" rx="20" fill="#232a27"/>' +
      '<rect x="96" y="124" width="208" height="152" rx="16" fill="url(#' + id + 's)"/>' +
      '<g class="face"' + (opt.lite ? '' : ' filter="url(#' + id + 'g)"') + '>' + '<g class="eye">' + eye + '</g>' + extra + mouth + '</g>' +
      '<rect x="96" y="124" width="208" height="152" rx="16" fill="url(#' + id + 'l)"/>' +
      '<path d="M112 136 Q 150 128 186 134" stroke="rgba(255,255,255,.12)" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<text x="200" y="309" text-anchor="middle" font-family="VT323, ui-monospace, monospace" font-size="15" letter-spacing="3" fill="#3d433f">CHUM·TRONIX 3000</text>' +
      '<circle class="led" cx="318" cy="304" r="6" fill="#e0362c"/><circle cx="318" cy="304" r="12" fill="#e0362c" opacity=".25"/>' +
      '</svg>';
  }
  face.moods = Object.keys(MOOD);
  g.chumFace = face;
})(typeof window !== 'undefined' ? window : globalThis);
