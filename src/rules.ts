// Public rules shown at /live/rules. Edit the text here; each entry becomes one collapsible tile.
export type RuleSection={heading:string;items:string[]};
export type RuleTile={id:string;title:string;tag:string;format:string;sections:RuleSection[]};
export const rulesUpdated='21 October 2026';
export const ruleTiles:RuleTile[]=[
  {id:'general',title:'General rules',tag:'Every game',format:'Applies to every game, tournament and free-play session at GameON.',sections:[
    {heading:'Check-in and timing',items:[
      'Check in at the GameON desk at least 15 minutes before your first match.',
      'Be at your station when your match is called. If you are not there within 10 minutes of the call, you forfeit that match.',
      'Match times can move on the night. Keep an eye on the live board for the latest schedule.']},
    {heading:'Fair play',items:[
      'Play to win, but play fair. Cheats, exploits, macros, modded controllers or outside help mean instant disqualification.',
      'Use the consoles, PCs and settings provided. You may bring your own controller or headset if an organiser checks it first.',
      'Do not touch another player\'s controller, keyboard or settings during a match.']},
    {heading:'Results and disputes',items:[
      'Both players (or both teams) confirm the result with the station organiser before leaving the station.',
      'Raise any problem straight away, before the next match starts. Once the next match begins, the earlier result stands.',
      'If a game crashes or disconnects, call an organiser. Do not restart on your own. Organisers decide whether to replay or continue.',
      'Organisers have the final say on rules, disputes and anything this page does not cover.']},
    {heading:'Conduct',items:[
      'Respect your opponents, spectators, organisers and the equipment. Abuse, harassment or damaging equipment means removal from the event.',
      'Keep food and drinks away from the consoles, PCs and controllers.',
      'This is a charity event. Good games, good people, one good cause.']},
  ]},
  {id:'fc26',title:'FC 26',tag:'Console · 1 vs 1',format:'Two 7-minute halves. A draw goes to 2 minutes of extra time, then penalties.',sections:[
    {heading:'Match format',items:[
      'Half length: 7 minutes (14 minutes of match time).',
      'If the match ends in a draw, play 2 minutes of extra time.',
      'If it is still a draw after extra time, it goes straight to a penalty shootout.']},
    {heading:'Settings',items:[
      'Kick Off, 1 vs 1, default game settings, normal game speed. Organisers set the match up at the station.',
      'Any club or national team may be used. Custom tactics and formations are allowed.',
      'Home and away are decided by a coin toss or by the bracket order.']},
    {heading:'During the match',items:[
      'Pause only when the ball is out of play, or in an emergency. Pausing during an attacking move may be penalised by the organiser.',
      'Substitutions and tactic changes are made during natural stoppages.',
      'If the match disconnects, it is replayed from the score and time it stopped at where possible. Otherwise the organiser decides.']},
  ]},
  {id:'mortal-kombat',title:'Mortal Kombat',tag:'Console · 1 vs 1',format:'Each game is best of 3 rounds. Each set is best of 3 games (first to 2 wins).',sections:[
    {heading:'Match format',items:[
      'Each game is best of 3 rounds (first to win 2 rounds).',
      'Each set is best of 3 games (first to win 2 games takes the set).',
      'Standard knockout bracket. The grand final may be extended to best of 5 games if time allows.']},
    {heading:'Settings',items:[
      'Default versus settings: 90-second round timer, default health, no handicaps.',
      'All characters and their default kameos/variations are legal. Organisers may ban a character or stage that is found to be broken on the night.',
      'Stage for game 1 is random. After that, the loser of the previous game picks the stage.']},
    {heading:'Character picks',items:[
      'Game 1: both players pick at the same time. Either player can ask for a blind pick, done by telling the organiser.',
      'After each game, the winner must keep the same character. The loser may change character.',
      'Pick within 60 seconds when asked. Taking too long can mean a random pick.']},
    {heading:'During the match',items:[
      'Pausing mid-round without a good reason can cost you the round, at the organiser\'s call.',
      'If a controller fails or disconnects, call an organiser. The round is replayed if the fault was not the player\'s.',
      'Finishers (Fatalities, Brutalities) are fine, but do not stall or waste time.']},
  ]},
  {id:'cod-ffa',title:'Call of Duty · Free for all',tag:'PC · Promod · Everyone vs everyone',format:'5-minute rounds, 2 rounds per match, 3 matches. Bottom fraggers are eliminated, top fraggers move on.',sections:[
    {heading:'Match format',items:[
      'Each match is 2 rounds of 5 minutes, played on the Promod config.',
      'There are 3 matches. Your score for a match is your total kills across both rounds.',
      'After each match, the bottom fraggers are eliminated and the top fraggers move on to the next match. Organisers announce how many go through before each match.',
      'The player with the most kills in match 3 is the winner.']},
    {heading:'Ties',items:[
      'Tied on kills: fewer deaths goes through.',
      'Still tied: a 1-round sudden-death shoot-out between the tied players, first to the target set by the organiser.']},
    {heading:'Settings and conduct',items:[
      'Promod settings and maps are set by the organisers. Do not change game or graphics settings that affect gameplay.',
      'No aim assist software, wallhacks, macros, exploits or spawn-camping glitches.',
      'If the server crashes, the round is replayed. Kills from an unfinished round do not count.']},
  ]},
  {id:'cod-2v2',title:'Call of Duty · 2 vs 2 TDM',tag:'PC · Promod · Team knockout',format:'Team deathmatch, 2 rounds of 5 minutes. Knockout bracket: the loser is out.',sections:[
    {heading:'Match format',items:[
      'Each match is 2 rounds of 5 minutes of 2 vs 2 team deathmatch on the Promod config.',
      'The team with the most total kills across both rounds wins and moves on in the knockout bracket. The losing team is out.',
      'Teams swap sides between rounds.']},
    {heading:'Ties',items:[
      'If total kills are level after 2 rounds, play a sudden-death round. The first team to get a kill wins.']},
    {heading:'Settings and conduct',items:[
      'Promod settings and maps are set by the organisers.',
      'Both players must be registered on the same team before the event. Substitutes need an organiser\'s approval.',
      'If the server crashes or a player disconnects, call an organiser. The round is replayed from the start.']},
  ]},
];
