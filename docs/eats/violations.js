/* Plain-English summaries of DOHMH violation codes, written by Lantern Lab.
   The official text always comes from the dataset row itself; these are our own
   short paraphrases to help a diner read it. They are not official definitions.
   Source for the official wording: NYC Open Data 43nn-pn8j, VIOLATION DESCRIPTION. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EatsViolations = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PLAIN = {
    // 02: food temperature
    '02A': 'Food that has to be cooked to a safe internal temperature was undercooked.',
    '02B': 'Hot food was being held below 140 °F, the minimum for keeping it hot.',
    '02C': 'Food that was cooked, cooled and then held for serving was not reheated to 165 °F within 2 hours.',
    '02D': 'Pre-cooked packaged food was not heated to 140 °F within 2 hours of being opened.',
    '02F': 'Raw or undercooked meat, fish, eggs or shellfish was served without the required written notice to customers.',
    '02G': 'Cold food was being kept warmer than allowed (above 41 °F for most foods).',
    '02H': 'Cooked food was not cooled down fast enough (140 °F to 70 °F in 2 hours, then to 41 °F in 4 more).',
    '02I': 'Food made from room-temperature ingredients was not chilled to 41 °F within 4 hours.',
    // 03: food source
    '03A': 'Food came from an unapproved or unknown source, or was prepared in a way the rules don’t allow (for example, home-made).',
    '03B': 'Shellfish was missing proper source tags, or the tags were not kept for 90 days.',
    '03C': 'Cracked or dirty eggs, or unpasteurized liquid, frozen or powdered eggs, were kept or used.',
    '03D': 'Damaged cans or packages (swollen, leaking, rusted) were not labeled DO NOT USE or kept apart.',
    '03E': 'There was a problem with the drinking water or ice supply.',
    '03F': 'Unpasteurized milk or milk products were served.',
    '03G': 'Raw fruit or vegetables were not washed before cutting or serving.',
    '03I': 'Juice packaged on site was missing its label or warning statement.',
    // 04: contamination, workers, pests
    '04A': 'No manager or supervisor on duty held a Food Protection Certificate.',
    '04B': 'A worker with an infected wound or reportable illness was working, or someone was spitting.',
    '04C': 'A worker touched ready-to-eat food with bare hands instead of gloves or utensils.',
    '04D': 'A worker didn’t wash hands (or change gloves) when required.',
    '04E': 'Chemicals or pesticides were stored or used where they could get into food.',
    '04F': 'An area used for food or by staff or customers was contaminated by sewage or liquid waste.',
    '04H': 'Food was contaminated or cross-contaminated, or was not thrown out when it should have been.',
    '04I': 'Unwrapped food that had already been served was being served again.',
    '04J': 'No working food thermometer was available to check food temperatures.',
    '04K': 'Inspectors found rats or signs of rats.',
    '04L': 'Inspectors found mice or signs of mice.',
    '04M': 'Inspectors found live roaches.',
    '04N': 'Inspectors found flies or other nuisance pests.',
    '04O': 'A live animal (other than fish in a tank or a service animal) was on the premises.',
    '04P': 'Food contained a substance that is not allowed.',
    // 05: facilities and equipment
    '05A': 'The sewage disposal system was missing, inadequate or not approved.',
    '05B': 'Harmful gas or vapor was detected (for example, carbon monoxide above 9 ppm).',
    '05C': 'Food-contact equipment or containers were built, placed or maintained improperly, or there was no proper sink for washing food.',
    '05D': 'A hand-washing sink was missing, blocked or not set up properly (water, soap or a way to dry hands).',
    '05E': 'A required toilet was missing, or the shared toilet was reached through a food area.',
    '05F': 'There was not enough equipment to keep food hot or cold at safe temperatures.',
    '05H': 'No approved written procedure for refillable or returnable containers.',
    // 06: hygiene and handling
    '06A': 'Personal hygiene issue, such as no hair restraint, dirty clothing, jewelry or untrimmed nails.',
    '06B': 'Someone was smoking, eating or drinking from an open cup in a food prep, storage or dishwashing area.',
    '06C': 'Food, supplies or equipment were not protected from possible contamination.',
    '06D': 'A surface that touches food was not properly washed, rinsed and sanitized.',
    '06E': 'Clean utensils or equipment were used or stored improperly.',
    '06F': 'Wiping cloths were not kept clean and dry or in sanitizer between uses.',
    '06G': 'A required food safety (HACCP) plan was missing or not kept on site.',
    '06H': 'Records showing the food safety (HACCP) plan was followed were not kept.',
    '06I': 'Food was not labeled the way its approved food safety (HACCP) plan requires.',
    '07A': 'Someone interfered with or obstructed the inspector.',
    // 08: pests and waste (general)
    '08A': 'Conditions that could attract or shelter pests, such as gaps, holes or clutter.',
    '08B': 'Garbage was not stored, covered or removed properly.',
    '08C': 'Pesticides or other chemicals were labeled, used or stored improperly, or bait stations were unprotected.',
    // 09: food handling (general)
    '09A': 'Damaged cans meant to be returned were not kept apart and labeled DO NOT USE.',
    '09B': 'Frozen food was thawed the wrong way.',
    '09C': 'A food-contact surface was not easy to clean or not kept in good repair.',
    '09D': 'Food was being prepared in a room used for living or sleeping.',
    '09E': 'No "wash hands" sign at the hand-washing sink.',
    // 10: facility maintenance (general)
    '10A': 'A toilet room was missing toilet paper, a trash can or a self-closing door.',
    '10B': 'Plumbing or drainage problem, such as a missing back-flow device or a poorly draining floor or sink.',
    '10C': 'Lighting was inadequate, or bulbs over food areas were not shatterproof or shielded.',
    '10D': 'Ventilation was missing or not controlling grease, heat, steam, smoke or odors.',
    '10E': 'A fridge, freezer or hot-holding unit had no accurate thermometer.',
    '10F': 'Surfaces or equipment that don’t touch food were not clean, sealed or easy to clean around.',
    '10G': 'Dishwashing or sanitizing of dishes, utensils or equipment was not done properly.',
    '10H': 'Disposable items (cups, utensils, straws) were missing, reused or not protected.',
    '10I': 'Disposable items were reused, stored improperly, or not used when required.',
    '10J': 'No "wash hands" sign posted.',
    '10K': 'Dishwashing setup or technique was incorrect (for example, no test kit or thermometer).',
    '10M': 'No "wash hands" sign at the hand-washing sink.',
    // 18: permits and documents
    '18-01': 'No valid permit to operate was available.',
    '18-08': 'The permit was not displayed where it can be seen.',
    '18-11': 'The Food Protection Certificate was not available for the inspector.',
    '18-12': 'A Health Department document was altered, or false information was given.',
    '18-13': 'An order from the Health Department was not followed.',
    '18-14': 'A Health Department notice was removed, covered or damaged.',
    '18F': 'The permit was not displayed where it can be seen.',
    '18G': 'Frozen desserts made without authorization, or milk was undated or expired.',
    '18I': 'A required sign or poster (such as choking first aid) was not posted.',
    // 20: signs and postings
    '20-01': 'An allergen notice was not translated into a common language when required.',
    '20-02': 'The required link to the Health Department’s inspection lookup was not posted.',
    '20-03': 'The food allergy poster used was not an approved one.',
    '20-04': 'A required sign or kit was not posted (choking first aid poster, alcohol and pregnancy warning, or resuscitation masks and gloves).',
    '20-05': 'The letter grade or Grade Pending card was not posted where passersby can see it.',
    '20-06': 'The letter grade or Grade Pending card was not posted.',
    '20-07': 'The letter grade or Grade Pending card was removed, covered or tampered with.',
    '20-08': 'Required healthy eating information was not posted.',
    '20A': 'The food allergy poster was not posted where food workers can see it.',
    '20D': 'A required sign or kit was not posted (choking first aid poster, alcohol and pregnancy warning, or resuscitation masks and gloves).',
    '20F': 'The letter grade sign was not posted.',
    // 22 and 28: other general
    '22A': 'An unsafe, hazardous or offensive condition was found.',
    '22C': 'Light bulbs in hot or high-contact areas were not shatterproof or shielded.',
    '22E': 'Vacuum-packing (ROP) equipment was not approved by the Health Department.',
    '22F': 'Food was mislabeled.',
    '22G': 'Restricted foam (polystyrene) items were sold or used.',
    '28-01': 'An unsafe, hazardous or offensive condition was found.',
    '28-03': 'Lights over food or dishwashing areas were not shatterproof or shielded.',
    '28-04': 'Vacuum-packing (ROP) equipment was not approved by the Health Department.',
    '28-05': 'Food was contaminated or mislabeled.',
    '28-06': 'No contract with a licensed pest control company, or no pest control records on site.',
    '28-07': 'Cooking was being done outdoors or on the sidewalk without approval.',
    '99B': 'Other general violation.'
  };
  // Families with many rarely used codes: one summary for the group.
  var FAMILY = {
    '15': 'Smoke-Free Air Act rule (for example, no-smoking signs or tobacco sales). These are special-program violations and do not count toward the inspection score.',
    '16': 'Menu labeling rule (calories, trans fat or sodium warnings). These are special-program violations and do not count toward the inspection score.',
    '19': 'City waste rule, such as plastic straws, foam containers or organics recycling.',
    '20': 'A required sign or posting was missing.',
    '22': 'Other general condition.',
    '28': 'Other general condition.'
  };
  function family(code) {
    var m = /^(\d{2})/.exec(code || '');
    return m ? m[1] : '';
  }
  function plain(code) {
    if (!code) return '';
    var c = String(code).trim().toUpperCase();
    if (PLAIN[c]) return PLAIN[c];
    var f = family(c);
    return FAMILY[f] || '';
  }
  return { plain: plain, family: family, PLAIN: PLAIN, FAMILY: FAMILY };
});
