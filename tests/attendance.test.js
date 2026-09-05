const assert=require('assert');
const {timeToMinutes,dayOfWeek,zonedParts}=require('../src/time');
assert.strictEqual(timeToMinutes('08:30'),510);
assert.ok(dayOfWeek('2026-06-18')>=0&&dayOfWeek('2026-06-18')<=6);
assert.match(zonedParts('2026-06-18T18:00:00Z').date,/^2026-06-18$/);
console.log('Pruebas básicas aprobadas.');
