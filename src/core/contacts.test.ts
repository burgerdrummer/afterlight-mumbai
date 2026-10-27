import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONTACTS,contactLink,phoneLink} from './contacts.ts';
import {googleMapsUrl} from './google-maps.ts';
test('emergency calling and traffic WhatsApp have distinct actions and published provenance',()=>{
  assert.equal(contactLink(CONTACTS[0]),'tel:112');
  assert.equal(contactLink(CONTACTS.find(c=>c.id==='traffic')!),'https://wa.me/918454999999');
  for(const c of CONTACTS){assert.ok(c.source.startsWith('https://'));assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.reviewed));}
  assert.equal(phoneLink('javascript:alert(1)'),null);assert.equal(phoneLink('+91 (22) 1234 5678'), 'tel:+912212345678');
});
test('Google handoff preserves the chosen vehicle mode',()=>{
  for(const [mode,expected] of [['walk','walking'],['motorcycle','two-wheeler'],['car','driving']] as const){const url=new URL(googleMapsUrl([[72.82,19.05],[72.83,19.06]],mode)!);assert.equal(url.searchParams.get('travelmode'),expected);}
});
