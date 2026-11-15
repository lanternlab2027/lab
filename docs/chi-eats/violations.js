/* Plain-English summaries of Chicago food inspection violations, written by Lantern Lab.
   The official text (title and the inspector's comments) always comes from the dataset row and is always shown;
   these are our own short paraphrases, not official definitions.
   Chicago renumbered its violations on July 1, 2018, so summaries are matched on the official TITLE wording
   rather than the number. Titles we don't recognise get no summary; only the official text is shown. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChiViolations = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // [pattern on the upper-case title, summary]. First match wins, so specific patterns come first.
  var RULES = [
    [/PREVIOUS PRIORITY VIOLATION/, 'A priority violation from an earlier inspection had not been fixed.'],
    [/PREVIOUS CORE VIOLATION/, 'A minor (core) violation from an earlier inspection had not been fixed.'],
    [/PREVIOUS (MINOR|SERIOUS|CRITICAL) VIOLATION/, 'A violation from an earlier inspection had not been fixed.'],
    [/SUMMARY REPORT/, 'The inspection summary report was not posted where the public can see it.'],
    [/SUSPENSION SIGN/, 'A license-suspension sign was removed without the city’s OK.'],
    [/CLEAN INDOOR AIR|SMOKING/, 'A rule of Chicago’s Clean Indoor Air (smoke-free) ordinance was not followed.'],
    [/ALLERGEN/, 'Required food-allergen training was missing or not documented.'],
    [/FOOD HANDLER/, 'Not every food employee had the required food-handler training on record.'],
    [/SANITATION CERTIFICATE|CERTIFIED FOOD MANAGER|FOOD SERVICE SANITATION MANAGER|\bFSSM\b/, 'No manager with a City of Chicago food sanitation certificate was on site when required.'],
    [/PERSON IN CHARGE/, 'The person in charge was missing or could not show the food-safety knowledge and duties required.'],
    [/RESTRICTION AND EXCLUSION/, 'Sick employees were not properly kept away from food or sent home as required.'],
    [/EMPLOYEE.*(KNOWLEDGE|REPORTING)|REPORTING.*ILLNESS|EMPLOYEE HEALTH/, 'Staff did not know, or had no written policy for, reporting illnesses that could spread through food.'],
    [/VOMIT|DIARRH/, 'There was no written plan or kit for cleaning up after vomiting or diarrhea.'],
    [/EATING, TASTING, DRINKING|TOBACCO USE/, 'Staff ate, drank or smoked in a food area in a way that isn’t allowed.'],
    [/DISCHARGE FROM (THE )?EYES/, 'A worker with a runny nose or eyes was handling food.'],
    [/BARE HAND/, 'Ready-to-eat food was touched with bare hands instead of gloves or utensils.'],
    [/HAND ?WASHING SINK|HAND SINK|HANDWASHING FACILITIES|HAND WASHING FACILITIES/, 'A handwashing sink was missing, blocked, or short on soap, towels or warm water.'],
    [/HANDS CLEAN|HANDS.*WASHED|WASH(ED)? HANDS/, 'Workers did not wash their hands properly or when required.'],
    [/GLOVES/, 'Gloves were not used properly.'],
    [/WATER (&|AND) ICE/, 'Water or ice was not from an approved source.'],
    [/SHELLSTOCK|PARASITE DESTRUCTION/, 'Required records were missing, such as shellfish tags or proof that fish for raw service was frozen to kill parasites.'],
    [/APPROVED SOURCE|APPROVED, UNADULTERATED|SOUND CONDITION/, 'Food came from an unapproved source, or was not in sound condition.'],
    [/RECEIVED AT PROPER TEMPERATURE/, 'Food was delivered or accepted at an unsafe temperature.'],
    [/GOOD CONDITION, SAFE|UNADULTERATED/, 'Food was spoiled, contaminated or otherwise not safe to serve.'],
    [/RETURNED, PREVIOUSLY SERVED|RECONDITIONED|UNSAFE FOOD/, 'Food that was returned, already served or unsafe was not thrown out or handled properly.'],
    [/PLANT FOOD/, 'Fruits or vegetables meant to be kept hot were not cooked properly first.'],
    [/REHEATING/, 'Cooked food was not reheated fast enough or hot enough before being kept hot.'],
    [/COOLING METHODS|ADEQUATE EQUIPMENT FOR TEMPERATURE/, 'Food was cooled the wrong way, or there wasn’t enough equipment to keep food at safe temperatures.'],
    [/COOLING TIME/, 'Cooked food was not cooled down fast enough.'],
    [/HOT HOLDING/, 'Hot food was not kept hot enough.'],
    [/COLD HOLDING|COLD FOOD.*41|POTENTIALLY HAZARDOUS FOOD MEETS TEMPERATURE/, 'Cold food was not kept cold enough.'],
    [/COOKING TIME|COOKED TO PROPER/, 'Food was not cooked to a safe temperature for long enough.'],
    [/DATE MARKING/, 'Ready-to-eat food was missing a use-by date label, or was kept past it.'],
    [/TIME AS A PUBLIC HEALTH CONTROL/, 'Food held without temperature control was not tracked by time as required.'],
    [/CONSUMER ADVISORY/, 'The menu did not warn customers about raw or undercooked food.'],
    [/PASTEURIZED EGGS/, 'Pasteurized eggs were not used where required.'],
    [/PASTEURIZED FOODS|PROHIBITED FOODS/, 'Unpasteurized or prohibited foods were offered where they aren’t allowed.'],
    [/FOOD ADDITIVES/, 'A food additive was not approved or was used incorrectly.'],
    [/TOXIC/, 'Chemicals such as cleaners or pesticides were not labeled, stored or used safely.'],
    [/VARIANCE|SPECIALIZED PROCESS|HACCP/, 'A special process (for example curing or vacuum-packing) was done without the required approval or plan.'],
    [/THAWING/, 'Frozen food was thawed the wrong way.'],
    [/THERMOMETER/, 'Thermometers were missing or not accurate.'],
    [/LABELED|ORIGINAL CONTAINER/, 'Food was not labeled properly or was not in its original container.'],
    [/INSECTS, RODENTS|RODENT|INSECT|PEST/, 'Signs of insects, rodents or other animals were found, or the place wasn’t sealed against them.'],
    [/CONTAMINATION PREVENTED|PROTECTED FROM CONTAMINATION|FOOD SEPARATED AND PROTECTED|CROSS[- ]CONTAMINATION/, 'Food was not protected from contamination during storage, prep or display.'],
    [/PERSONAL CLEANLINESS|HAIR RESTRAINT|CLEAN CLOTHING/, 'Workers’ personal cleanliness was lacking (for example no hair restraint or dirty clothing).'],
    [/WIPING CLOTHS/, 'Wiping cloths were not stored in sanitizer or were used incorrectly.'],
    [/WASHING FRUITS/, 'Fruits and vegetables were not washed before use.'],
    [/IN-USE UTENSILS/, 'Utensils in use were stored in a way that could contaminate food.'],
    [/UTENSILS, EQUIPMENT (&|AND) LINENS/, 'Clean utensils, equipment or linens were not stored, dried or handled properly.'],
    [/SINGLE-USE|SINGLE-SERVICE/, 'Disposable items (cups, containers, utensils) were not stored or used properly.'],
    [/FOOD-CONTACT SURFACES: CLEANED|FOOD CONTACT SURFACES.*SANITIZ/, 'Surfaces that touch food were not cleaned and sanitized properly.'],
    [/WAREWASHING|DISH ?MACHINE|TEST STRIPS|SANITIZING RINSE/, 'Dishwashing equipment was not set up, maintained or used correctly, or sanitizer test strips were missing.'],
    [/NON-FOOD.*CLEAN\b|EQUIPMENT.*CLEAN\b|UTENSILS CLEAN\b/, 'Surfaces or equipment were dirty.'],
    [/HOT (&|AND) COLD WATER|WATER PRESSURE|ADEQUATE PRESSURE/, 'Hot or cold running water, or water pressure, was not adequate.'],
    [/PLUMBING|BACKFLOW/, 'Plumbing problems were found, such as leaks or a missing backflow device.'],
    [/SEWAGE|WASTE WATER/, 'Sewage or waste water was not disposed of properly.'],
    [/TOILET/, 'Toilet facilities were not properly built, supplied or kept clean.'],
    [/GARBAGE|REFUSE|LITTER/, 'Garbage was not handled or stored properly, or the trash area was not maintained.'],
    [/PHYSICAL FACILITIES|FLOORS|WALLS|CEILINGS/, 'Floors, walls, ceilings or other parts of the building were dirty or in poor repair.'],
    [/VENTILATION|LIGHTING|DESIGNATED AREAS/, 'Ventilation or lighting was inadequate, or areas were not used as designated.'],
    [/CLEANABLE|PROPERLY DESIGNED|CONSTRUCTED/, 'Equipment or surfaces were in poor repair or not easy to clean.'],
    [/LICENSE/, 'A licensing requirement was not met.']
  ];

  /** Our paraphrase for an official title, or '' if we don't have one. */
  function plain(title) {
    var t = String(title || '').toUpperCase();
    if (!t) return '';
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(t)) return RULES[i][1];
    return '';
  }

  return { plain: plain, RULES: RULES };
});
