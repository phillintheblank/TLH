// ---------- the review site is mouse only ----------
// Hand control (08-hands.js), its camera code and its files are left out of this page. These stand in for the few
// parts of it that the rest of the page mentions, so that nothing here can turn a camera on.
const HT = { status: 'off', cal: null, clock: 0, cams: [], slot: { L: { engaged: false, pinch: false, tSeen: -9 }, R: { engaged: false, pinch: false, tSeen: -9 } } };
const HCOL = { L: '#43c6c0', R: '#f0b24a' };
function htWire() {} function htPointers() {} function htActions() {} function htRenderUI() {} function htResetSlots() {} function htEnable() {} function htDisable() {}
function htFresh() { return false; } function htWarning() { return ''; }
