import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursState, istInputToDate } from './hours.ts';

test('evaluates Mumbai wall-clock time regardless of host timezone',()=>{
  for(const tz of ['UTC','America/New_York','Asia/Kolkata']){
    process.env.TZ=tz;
    assert.equal(hoursState('Mo-Su 20:00-23:00',new Date('2026-10-27T15:00:00Z')),'open');
    assert.equal(hoursState('Mo-Su 20:00-23:00',new Date('2026-10-27T18:00:00Z')),'closed');
  }
});
test('opening intervals continue across midnight',()=>{
  assert.equal(hoursState('Tu 20:00-02:00',new Date('2026-10-27T19:30:00Z')),'open');
  assert.equal(hoursState('Tu 20:00-02:00',new Date('2026-10-27T21:00:00Z')),'closed');
});
test('missing, unsupported holiday and ambiguous hours remain unknown',()=>{
  const when=new Date('2026-10-27T15:30:00Z');
  for(const value of [null,'not a valid schedule','Mo-Su 08:00-22:00; PH off','"call first"']) assert.equal(hoursState(value,when),'unknown');
  assert.equal(hoursState('24/7',when),'open');
});
test('explicit input conversion uses IST, not computer local time',()=>{
  assert.equal(istInputToDate('2026-10-27T21:00').toISOString(),'2026-10-27T15:30:00.000Z');
});
