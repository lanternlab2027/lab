/* Watch-Party Bingo: preset square lists. All square text is original to Lantern Lab.
 * Each preset has a versioned id ("biggame1"). A share link for an unedited preset carries only the id,
 * so never change a published list in place: add "biggame2" instead, or existing links would deal new cards.
 * Generic descriptive names only; no league, event or award trademarks.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PartyPresets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 'biggame1', name: 'Big Game Sunday (football)', short: 'Big Game', title: 'Big Game Bingo',
      blurb: 'Plays, refs, commercials and the halftime show.',
      squares: [
        // the game
        'Coin toss call is wrong', 'Ref misses an obvious call', 'Flag on the opening kickoff', 'Coach throws a challenge flag',
        'Replay review takes forever', 'Kick bounces off the upright', 'Missed extra point', 'Two-point try',
        'Team goes for it on fourth down', 'Interception', 'Fumble recovered by the defense', 'Defensive touchdown',
        'Safety', 'Onside kick', 'End-zone celebration dance', 'Sack on third down',
        'Punt pinned inside the 5', 'Kick return past midfield', 'Holding call wipes out a big play', 'Kicker gets iced with a timeout',
        'Quarterback scrambles for a first down', 'Coach yells at a ref on camera', 'Score is tied after halftime', 'Lead changes hands',
        'Touchdown under 2 minutes before the half', 'Winning coach gets the cooler shower', 'Player cramps up on the field', 'Ball spotted short by an inch',
        // the broadcast
        'Announcer says "momentum"', 'A stat graphic nobody asked for', 'Celebrity spotted in a suite', 'Camera finds a crying fan',
        'Aerial shot of the stadium', 'Sideline reporter interview', 'Anthem runs over 2 minutes', 'Military flyover',
        'Broadcast cuts to the owner\'s box', 'Someone on air mentions Valentine\'s Day',
        // the commercials
        'Ad with a talking animal', 'Ad starring a dog', 'Car ad on an empty mountain road', 'Movie trailer',
        'Ad with a surprise celebrity cameo', 'Ad that makes someone tear up', 'Ad nobody can explain', 'Snack food ad',
        'Ad with a 90s throwback', 'Ad that mentions AI', 'Same ad airs twice', 'Ad with a baby',
        'Ad that ends with a website and no product', 'Two celebrities in one ad',
        // the halftime show
        'Halftime show has fireworks', 'Surprise guest performer', 'Halftime costume change', 'Performer flies or rises from the stage',
        'Someone asks "who is this?" at halftime', 'Crowd sings along on the field',
        // the room
        'Someone asks what the score is', 'Snack bowl hits empty', 'Someone yells at the TV', 'Someone only watches the ads'
      ]
    },
    {
      id: 'awards1', name: 'Awards Night', short: 'Awards', title: 'Awards Night Bingo',
      blurb: 'Speeches, play-off music, red carpet and upsets.',
      squares: [
        'Winner thanks their mom', 'Speech gets played off by music', 'Winner forgets to thank their partner', 'Host does a musical number',
        'Joke about the show running long', 'Standing ovation', 'Presenter mispronounces a name', 'Winner cries on stage',
        'Paper speech pulled from a pocket', 'Speech gets political', 'Camera catches a nominee\'s brave face after losing', 'Red carpet outfit everyone talks about',
        'Someone trips on the stairs', 'Tribute segment for those we lost', 'First-time nominee wins', 'Big upset in a top category',
        'Same film wins three in a row', 'Scripted presenter banter falls flat', 'Host roasts someone in the front row', 'Celebrity selfie in the audience',
        'Award for a short you have never heard of', 'Trophy held over the head', 'Speech runs over 2 minutes', '"I didn\'t prepare anything"',
        'Live performance of a nominated song', 'Show runs past its end time', 'A bleeped word', 'Shout-out to the crew',
        'Winner thanks their agent', 'Winner mentions their hometown', 'Sequins on the red carpet', 'Nobody in the room has seen the winning film',
        'Presenter reads the teleprompter wrong', 'Someone kisses the trophy', 'Surprise reunion on stage', 'Winner speaks in two languages'
      ]
    },
    {
      id: 'holidaymovie1', name: 'Holiday Movie Night', short: 'Holiday Movie', title: 'Holiday Movie Bingo',
      blurb: 'Every cozy small-town holiday movie, ever.',
      squares: [
        'Snow starts at the perfect moment', 'City career person goes back to a small town', 'Cookie or baking contest', 'Ugly sweater',
        'Hot cocoa with marshmallows', 'Someone explains the true meaning of the season', 'Tree lighting ceremony', 'Character named Holly, Noel or Nick',
        'Mistletoe moment', 'Almost-kiss gets interrupted', 'Fake relationship for the holidays', 'Ice skating scene',
        'Snowball fight', 'An ex shows up', 'Family inn or shop is in trouble', 'Mysterious man who might be Santa',
        'Gingerbread house', 'Kid gives wise advice', 'Carolers at the door', 'Gift mix-up',
        'Main character hates the holidays at first', 'Big misunderstanding near the end', 'Sleigh or carriage ride', 'Town festival needs saving',
        'Laptop closed for good', 'Flannel shirt', 'Matching pajamas', 'Dog in a sweater',
        'Snowman gets built', 'Grand gesture in the town square', '"It\'s a holiday miracle!"', 'Ornament with a backstory',
        'Heart-to-heart by the fireplace', 'Car breaks down in the snow', 'Baking disaster', 'Everyone sings at the end',
        'Clumsy fall into someone\'s arms', 'Call from the boss in the big city'
      ]
    },
    {
      id: 'realitytv1', name: 'Reality TV Finale', short: 'Reality Finale', title: 'Finale Night Bingo',
      blurb: 'Dramatic pauses, tears, twists and the reunion fight.',
      squares: [
        '"I\'m not here to make friends"', 'Dramatic pause before the result', 'Host says "after the break"', 'Contestant cries',
        'Season montage', 'A former contestant returns', 'Shock elimination', 'Fan favorite award',
        'Confessional eye roll', 'Live audience boos', 'Someone storms off stage', 'Reunion fight',
        'A proposal', 'Someone says "journey"', '"Best experience of my life"', 'Obvious product placement',
        'Cliffhanger for next season', 'Confetti cannon', 'Slow-motion walk', 'Dramatic music sting',
        'Host in a sparkly outfit', 'Winner thanks their family', 'Last-minute twist', 'Result is "too close to call"',
        'Old fight replayed on screen', '"Here for the right reasons"', 'Rivals hug it out', 'Reminder to vote by text or app',
        'Teary video message from home', 'Someone in the room called the winner', 'Runner-up fake smile', 'Group hug',
        'Someone brings up an old feud', 'Bleeped insult', 'Contestant says they "grew so much"', 'Spin-off announced'
      ]
    },
    {
      id: 'familydinner1', name: 'Family Holiday Dinner', short: 'Family Dinner', title: 'Family Dinner Bingo',
      blurb: 'The questions, the leftovers and the seating chart.',
      squares: [
        'Someone asks when you\'re getting married', 'The turkey (or roast) comes out dry', 'Kids\' table drama', 'Someone naps on the couch',
        'Politics comes up and gets shut down', 'Burnt rolls', 'Store-bought dish called homemade', 'A dish nobody touches',
        'Dog gets a scrap under the table', 'Phone rings at the table', 'The blessing or toast runs long', 'Game on in the background',
        '"So what are you doing for work now?"', 'Fight over the leftovers', 'Spilled drink', 'Vacation photos get passed around',
        'Board game argument', 'More pies than people', 'Someone arrives very late', '"I\'m so full" (then dessert)',
        'Group photo takes 10 tries', 'Someone\'s on a new diet', 'Embarrassing childhood story', 'Unsolicited advice',
        'You fix someone\'s phone or TV', 'Baby or pet steals the show', 'Forgot the cranberry sauce', 'Gravy runs out',
        'Debate over the stuffing recipe', 'Someone does dishes without being asked', 'Someone hides in the kitchen', '"You\'ve gotten so tall!"',
        'Leftovers sent home in containers', 'Thermostat argument', 'Seating chart chaos', 'A surprise guest'
      ]
    },
    {
      id: 'newyears1', name: 'New Year\'s Eve', short: 'New Year\'s Eve', title: 'New Year\'s Eve Bingo',
      blurb: 'Countdowns, confetti and the first text of the year.',
      squares: [
        'Countdown starts at the wrong time', 'Someone spills a drink', 'Kiss at midnight', 'Someone falls asleep before midnight',
        'A resolution announced out loud', 'Fireworks', 'Sparkly party hat', 'Noisemaker right in someone\'s ear',
        'Group selfie', 'Confetti everywhere', 'Everyone half-knows the midnight song', '"Happy New Year" text at 11:58',
        'Phone network jams at midnight', '"See you next year!"', 'TV host in a giant coat', 'Countdown on TV',
        'Someone leaves before midnight', 'Pizza ordered after 10pm', 'Celebrating another time zone\'s midnight', 'Year-number novelty glasses',
        'Cork hits the ceiling', 'Toast to absent friends', 'Someone recaps their whole year', 'Midnight snack run',
        'Living room dance floor', 'Happy tears', 'Someone loses a shoe', 'Neighbors bang pots and pans',
        'A resolution broken within the hour', 'Sparklers', 'Last photo of the year', '"This year flew by"',
        'Someone in pajamas by 11', 'Argument over whose clock is right', 'First text of the year', 'Performer on TV lip-syncs'
      ]
    }
  ];
});
