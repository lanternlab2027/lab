// Builds synthetic fixtures for docs/amazon/ (Year in Orders). Every product, order and address is invented.
// Run: TZ=America/New_York node bots/amazon/make_fixtures.js
// Layouts follow the research in bots/amazon/NOTES.md; column names are unverified against a real export.
const fs = require('fs'), path = require('path');
const D = require('../../docs/amazon/demo.js');
const JSZip = require('../../docs/amazon/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
fs.mkdirSync(FX, { recursive: true });
const w = (f, t) => fs.writeFileSync(path.join(FX, f), t);
const opts = { year: 2026, endMonth: 11, endDay: 13 };

(async () => {
  // 1. Newer layout zip ("Your Orders.zip"), with unrelated files that must be skipped.
  const nf = D.files(Object.assign({ layout: 'new' }, opts));
  let z = new JSZip();
  nf.forEach((f) => z.file(f.name, f.text));
  z.file('Your Amazon Orders/Cart History.csv', D.csv(['ASIN', 'Cart List', 'Date Added To Cart', 'Product Name', 'Quantity'], [['B0X', 'Active', '2026-01-01T00:00:00Z', 'Cart item that was never bought', '1']]));
  z.file('Your Returns & Refunds/Returns Status.csv', D.csv(['Order ID', 'Return Amount', 'Return Amount Currency', 'Date of Return'], [['111-0000000-0000000', '999.00', 'USD', '2026-02-02T00:00:00Z']]));
  z.file('Account/Profile/Addresses.csv', D.csv(['Name', 'Address'], [['Sam Example', D.ADDRESS]]));
  z.file('Retail.CustomerProfile/Payment Instruments.csv', D.csv(['Order ID', 'Card'], [['111-0000000-0000000', 'Visa 0000']]));
  z.file('README.txt', 'Invented sample export for tests.\n');
  w('Your Orders.zip', await z.generateAsync({ type: 'nodebuffer' }));
  w('Order History.csv', nf[0].text);
  w('Refund Details.csv', nf[1].text);

  // 2. Classic layout zip.
  const cf = D.files(Object.assign({ layout: 'classic' }, opts));
  z = new JSZip();
  cf.forEach((f) => z.file(f.name, f.text));
  z.file('Retail.OrderHistory.1/Retail.OrderHistory.1.README.txt', 'Invented.\n');
  w('classic-export.zip', await z.generateAsync({ type: 'nodebuffer' }));
  w('Retail.OrderHistory.1.csv', cf[0].text);

  // 3. Two marketplaces: .1 in USD, .2 in CAD (classic layout).
  const ca = D.files({ year: 2026, endMonth: 6, endDay: 30, layout: 'classic', currency: 'CAD', years: 1, seed: 5 });
  z = new JSZip();
  z.file(cf[0].name, cf[0].text);
  z.file('Retail.OrderHistory.2/Retail.OrderHistory.2.csv', ca[0].text);
  w('two-marketplaces.zip', await z.generateAsync({ type: 'nodebuffer' }));

  // 4. Hand-written edge cases for the alias map, money and date formats.
  w('aliases_reordered.csv', '\ufeff"Website","Product Name","Quantity","Order ID","Total Owed","Order Date","Currency","Order Status","Shipping Address","Payment Instrument Type"\r\n' +
    'Amazon.com,"Desk fan, 12""",2,111-1111111-0000001,"$1,049.98",2026-04-02T03:15:00.000Z,USD,Closed,"1 Secret Lane, Hidden Town",Visa - 0000\r\n' +
    'Amazon.com,Sticky notes,1,111-1111111-0000002,\'4.99\',2026-04-05T15:00:00Z,USD,Closed,"1 Secret Lane, Hidden Town",Visa - 0000\r\n' +
    'Amazon.com,Cancelled thing,1,111-1111111-0000003,25.00,2026-04-06T15:00:00Z,USD,Cancelled,"1 Secret Lane, Hidden Town",Visa - 0000\r\n' +
    'Amazon.com,Lamp with no total,2,111-1111111-0000004,Not Available,2026-04-07T15:00:00Z,USD,Closed,"1 Secret Lane, Hidden Town",Visa - 0000\r\n');
  // Unit price fallback for the row without a total needs those columns, so add a second file with them.
  w('unit_price_only.csv', 'Order ID,Order Date,Product Name,Original Quantity,Unit Price,Unit Price Tax,Shipping Charge,Total Discounts,Currency\n' +
    '112-2222222-0000001,2026-05-01T12:00:00Z,Bookends,2,10.00,0.80,4.99,\'-2.00\',USD\n');
  w('eu_amounts.csv', 'Bestellnummer;Order ID;Order Date;Product Name;Quantity;Total Amount;Currency\n' +
    'x;302-0000000-0000001;2026-01-15T10:00:00Z;Kaffeefilter;1;12,99;EUR\n' +
    'x;302-0000000-0000002;2026-01-16T10:00:00Z;Wasserkocher;1;1.234,50;EUR\n');
  w('old_order_report.csv', 'Order Date,Order ID,Title,Category,ASIN/ISBN,Purchase Price Per Unit,Quantity,Item Total,Buyer Name\n' +
    '01/15/22,113-0000000-0000001,Old paperback,Paperback,0000000001,$9.99,1,$10.69,Sam Example\n' +
    '12/20/23,113-0000000-0000002,Old toaster,Kitchen,B000000002,$29.99,1,$32.09,Sam Example\n' +
    '11/02/25,113-0000000-0000003,Old umbrella,Apparel,B000000003,$19.99,1,$21.39,Sam Example\n');
  w('not_amazon.csv', 'Title,Date\nSome Show: Season 1: Pilot,11/14/26\n');
  w('empty_orders.csv', D.NEW_HEADER.join(',') + '\n');
  console.log('fixtures written:', fs.readdirSync(FX).join(', '));
})();
