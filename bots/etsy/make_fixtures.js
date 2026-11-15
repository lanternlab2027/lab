// Builds synthetic fixtures for the Seller Year in Review tests. Everything is invented.
// Run: TZ=America/New_York node bots/etsy/make_fixtures.js
const fs = require('fs'), path = require('path');
const D = require('../../docs/etsy/demo.js');
const JSZip = require('../../docs/etsy/vendor/jszip-3.10.1.min.js');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const w = (n, t) => fs.writeFileSync(path.join(OUT, n), t);

// 1. A full sample shop for 2026 (Jan 1 - Nov 13) plus 2025 orders, as Etsy names the files.
const files = D.files({ year: 2026, endMonth: 11, endDay: 13 });
files.forEach((f) => w(f.name, f.text));

// 2. Orders with refunds: one partial (Adjusted Order Total), one cancelled, one plain. PII values are sentinels
//    the privacy test looks for in parser output.
const OH = 'Sale Date,Order ID,Buyer User ID,Full Name,First Name,Last Name,Number of Items,Payment Method,Date Shipped,Street 1,Street 2,Ship City,Ship State,Ship Zipcode,Ship Country,Currency,Order Value,Coupon Code,Coupon Details,Discount Amount,Shipping Discount,Shipping,Sales Tax,Order Total,Status,Card Processing Fees,Order Net,Adjusted Order Total,Adjusted Card Processing Fees,Adjusted Net Order Amount,Buyer,Order Type,Payment Type,InPerson Discount,InPerson Location,SKU';
w('orders_refunds.csv', [OH,
  '03/02/26,3300000001,77001,Zelda Sentinelname,Zelda,Sentinelname,2,Credit Card,03/04/26,99 Secretaddress Lane,,Hiddencity,California,94999,United States,USD,60.00,SECRETCOUPON,10% off,6.00,0.00,5.00,4.79,63.79,,2.16,61.63,43.79,1.56,42.23,zelda_user,online,online_cc,,,',
  '03/05/26,3300000002,77002,Quincy Sentinelname,Quincy,Sentinelname,1,Credit Card,,1 Privacy Rd,,Hiddencity,NY,10999,United States,USD,25.00,,,0.00,0.00,0.00,2.22,27.22,Canceled,1.07,26.15,0.00,0.00,0.00,quincy_user,online,online_cc,,,',
  '03/09/26,3300000003,77001,Zelda Sentinelname,Zelda,Sentinelname,1,Credit Card,03/10/26,99 Secretaddress Lane,,Hiddencity,CA,94999,United States,USD,30.00,,,0.00,0.00,5.00,0.00,35.00,,1.30,33.70,0.00,0.00,0.00,zelda_user,online,online_cc,,,'
].join('\n') + '\n');

// 3. A 2020-era UK-English orders file ("Delivery" and "Date Posted"), day-first dates, GBP.
w('EtsySoldOrders2020-uk.csv', [
  '"Sale Date","Order ID","Buyer User ID","Full Name","First Name","Last Name","Number of Items","Payment Method","Date Posted","Street 1","Street 2","Delivery City","Delivery State","Delivery Zipcode","Delivery Country",Currency,"Order Value","Coupon Code","Coupon Details","Discount Amount","Delivery Discount",Delivery,"Sales tax","Order total",Status,"Card Processing Fees","Order Net","Adjusted Order Total","Adjusted Card Processing Fees","Adjusted Net Order Amount",Buyer,"Order Type","Payment Type","InPerson Discount","InPerson Location",SKU',
  '"25/09/2020",2200000001,501,"Una Sentinelname",Una,Sentinelname,1,"Credit Card","26/09/2020","5 Hidden Mews",,London,,"SW0 0AA","United Kingdom",GBP,18.50,,,0,0,3.20,0,21.70,,0.87,20.83,0,0,0,una_x,online,online_cc,,,',
  '"13/10/2020",2200000002,502,"Vic Sentinelname",Vic,Sentinelname,3,"Credit Card","14/10/2020","6 Hidden Mews",,Leeds,,"LS0 0AA","United Kingdom",GBP,45.00,,,4.50,0,0,0,40.50,,1.47,39.03,0,0,0,vic_x,online,online_cc,,,'
].join('\n') + '\n');

// 4. Order items with columns reordered and renamed the way a re-export or another locale might.
w('items_aliases.csv', [
  'order id;item title;qty;price;item total;currency code;listing id;transaction id;sale date;ship country;ship state;ship name;ship address1;buyer',
  '3400000001;Hand-thrown bowl;2;"12,50";"25,00";EUR;111;9001;2026-04-02;Germany;;Gerda Sentinelname;Geheimstrasse 1;gerda',
  '3400000001;Glazed cup;1;"9,00";"9,00";EUR;112;9002;2026-04-02;Germany;;Gerda Sentinelname;Geheimstrasse 1;gerda',
  '3400000002;Hand-thrown bowl;1;"12,50";"12,50";EUR;111;9003;2026-05-11;France;;Henri Sentinelname;Rue Secrete 2;henri'
].join('\n') + '\n');

// 5. A statement shaped like a real 2025 export from a non-US seller: currency symbols, VAT rows, credits,
//    regulatory fee, Etsy Plus, a card charge (Payment) and a deposit. Amounts are invented.
const SH = 'Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net,Tax Details';
w('statement_vat.csv', [SH,
  '"January 30, 2025",Sale,Payment for Order #3500000001,,EUR,"\u20ac40.00",--,"\u20ac40.00",--',
  '"January 30, 2025",Tax,Sales tax paid by buyer,Order #3500000001,EUR,--,"-\u20ac3.00","-\u20ac3.00",--',
  '"January 30, 2025",Fee,"Transaction fee: Hand-thrown bowl &amp; lid",Order #3500000001,EUR,--,"-\u20ac2.40","-\u20ac2.40",--',
  '"January 30, 2025",Fee,Transaction fee: Shipping,Order #3500000001,EUR,--,"-\u20ac0.30","-\u20ac0.30",--',
  '"January 30, 2025",Fee,Processing fee,Order #3500000001,EUR,--,"-\u20ac1.60","-\u20ac1.60",--',
  '"January 30, 2025",Fee,Regulatory Operating fee,Order #3500000001,EUR,--,"-\u20ac0.45","-\u20ac0.45",--',
  '"January 30, 2025",VAT,VAT: Processing Fee,Order #3500000001,EUR,--,"-\u20ac0.32","-\u20ac0.32",--',
  '"January 30, 2025",VAT,VAT: transaction,transaction: 4500000001,EUR,--,"-\u20ac0.48","-\u20ac0.48",--',
  '"January 30, 2025",Fee,Listing fee ($0.20 USD),Listing #1600000001,EUR,--,"-\u20ac0.19","-\u20ac0.19",--',
  '"January 30, 2025",VAT,VAT: auto-renew sold ,auto-renew sold : 1600000001,EUR,--,"-\u20ac0.04","-\u20ac0.04",--',
  '"January 28, 2025",Marketing,Fee for sale made through Offsite Ads,Order #3500000001,EUR,--,"-\u20ac6.00","-\u20ac6.00",--',
  '"January 28, 2025",VAT,VAT: Offsite Ads fee,order: 3500000001,EUR,--,"-\u20ac1.20","-\u20ac1.20",--',
  '"January 27, 2025",Marketing,Etsy Ads,"Bill for click-throughs to your shop on Jan 26, 2025",EUR,--,"-\u20ac5.00","-\u20ac5.00",--',
  '"January 26, 2025",Refund,Partial refund for Order #3500000000,,EUR,"-\u20ac10.00",--,"-\u20ac10.00",--',
  '"January 26, 2025",Tax,Refund to buyer for sales tax,Order #3500000000,EUR,--,"\u20ac0.75","\u20ac0.75",--',
  '"January 26, 2025",Fee,Credit for processing fee,Order #3500000000,EUR,--,"\u20ac0.40","\u20ac0.40",--',
  '"January 26, 2025",Fee,Credit for transaction fee on Glazed cup,Order #3500000000,EUR,--,"\u20ac0.60","\u20ac0.60",--',
  '"January 26, 2025",Payment,Charge for refund 99887766,,EUR,"\u20ac5.00",--,"\u20ac5.00",--',
  '"January 15, 2025",Marketing,Etsy Plus subscription fee ($10.00 USD),,EUR,--,"-\u20ac9.50","-\u20ac9.50",--',
  '"January 16, 2025",Fee,Credit for listing fee,Etsy Plus listing credits,EUR,--,"\u20ac0.19","\u20ac0.19",--',
  '"January 20, 2025",Deposit,"\u20ac25.00 sent to your bank account",,EUR,--,--,--,--',
  '"January 21, 2025",Shipping,USPS shipping label,Label #940001,EUR,--,"-\u20ac4.10","-\u20ac4.10",--',
  '"January 22, 2025",Shipping,Credit for USPS shipping label,Label #940001,EUR,--,"\u20ac1.10","\u20ac1.10",--'
].join('\n') + '\n');

// 6. Two currencies in one statement (a seller who switched payment account currency).
w('statement_two_currencies.csv', [SH,
  '"March 3, 2026",Sale,Payment for Order #3600000001,,USD,$20.00,--,$20.00,--',
  '"March 3, 2026",Fee,Processing fee,Order #3600000001,USD,--,-$0.85,-$0.85,--',
  '"March 4, 2026",Sale,Payment for Order #3600000002,,USD,$30.00,--,$30.00,--',
  '"March 9, 2026",Sale,Payment for Order #3600000003,,CAD,CA$50.00,--,CA$50.00,--',
  '"March 9, 2026",Fee,Processing fee,Order #3600000003,CAD,--,-CA$1.75,-CA$1.75,--'
].join('\n') + '\n');

// 7. A statement re-saved by a European spreadsheet: semicolons, decimal commas, U+2212 minus signs.
w('statement_semicolon.csv', [
  'Date;Type;Title;Info;Currency;Amount;Fees & Taxes;Net;Tax Details',
  '"5 April 2026";Sale;Payment for Order #3700000001;;EUR;1.234,50 \u20ac;--;1.234,50 \u20ac;--',
  '"5 April 2026";Fee;Transaction fee: Big commission piece;Order #3700000001;EUR;--;\u221280,24 \u20ac;\u221280,24 \u20ac;--',
  '"5 April 2026";Fee;Processing fee;Order #3700000001;EUR;--;\u221241,29 \u20ac;\u221241,29 \u20ac;--'
].join('\n') + '\n');

// 8. Not an Etsy file.
w('not_etsy.csv', 'Name,Email,Phone\nSomeone,someone@example.com,555-0100\n');

// 9. Everything zipped together (some sellers zip their downloads).
(async () => {
  const z = new JSZip();
  files.filter((f) => /2026/.test(f.name)).forEach((f) => z.file('etsy-2026/' + f.name, f.text));
  z.file('etsy-2026/EtsyDeposits2026-1.csv', 'Date,Amount,Currency,Status,Bank Account Ending Digits\n"January 5, 2026",100.00,USD,Executed,1234\n');
  fs.writeFileSync(path.join(OUT, 'etsy-2026.zip'), await z.generateAsync({ type: 'nodebuffer' }));
  console.log('fixtures written to', OUT);
})();
