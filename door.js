// Old links from when the games lived here (r4box.com/golf.html#game=…, r4box.com/#game=…, a
// tapped alert) carry on to the same place on games.r4box.com.
const GAMES = 'https://games.r4box.com';
export function forward(force) {
  const { pathname, search, hash } = location;
  if (force || hash.startsWith('#game=')) location.replace(GAMES + pathname + search + hash);
}
