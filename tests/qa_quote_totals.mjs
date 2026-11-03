import assert from 'node:assert/strict';
import {calculateQuote} from '../static/js/features/quote-layout.js';
assert.deepEqual(calculateQuote([{quantity:2,unit_price:125000,discount_percent:10,tax_percent:18}],0,0,500),{subtotal:250000,discount:25000,tax:40500,adjustment:500,grand:266000});
const lines=[{quantity:2,unit_price:100,discount_percent:10,tax_percent:10},{quantity:1,unit_price:50}];
assert.equal(calculateQuote(lines).grand,248);
assert.equal(calculateQuote(lines,10,18,500).grand,763.38);
assert.deepEqual(calculateQuote([]),{subtotal:0,discount:0,tax:0,adjustment:0,grand:0});
console.log('Quote total breakdown checks passed');
