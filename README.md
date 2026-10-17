# r4box-home

The front door at https://r4box.com. Plain static files on GitHub Pages; pushing to `main` publishes.

- `index.html`: the page. Links to the games (https://games.r4box.com) and the tailnet-only hub.
- `404.html` + `door.js`: links from when the games lived here (`r4box.com/golf.html#game=…`,
  `r4box.com/#game=…`) carry on to the same path on games.r4box.com.
- `sw.js`: the push bridge. Phones that turned on turn alerts at r4box.com still get them, and a
  tap opens the game on games.r4box.com. Nothing registers it; browsers that had the games'
  service worker pick it up as an update. Retire it once everyone has re-enabled alerts on games.
