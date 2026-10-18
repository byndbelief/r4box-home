# r4box-home

The front door at https://r4box.com. Plain static files on GitHub Pages; pushing to `main` publishes.

- `index.html`: the page. Links to the games (https://games.r4box.com) and the tailnet-only hub.
- `404.html` + `door.js`: links from when the games lived here (`r4box.com/golf.html#game=…`,
  `r4box.com/#game=…`) carry on to the same path on games.r4box.com.
- `sw.js`: alerts only. The family chat registers it when someone turns on alerts; it also
  stands in for the games' old service worker on phones that turned on turn alerts while the
  games lived here, opening those alerts on games.r4box.com.
- `chat.html`: the family chat. Messages go through the `family-chat` Edge Function (in the
  game-room repo, `supabase/functions/family-chat`), which pushes alerts and answers @claude.
- `admin.html`: a parent's admin page: box health (reported by r4os every 5 minutes), each kid's
  Claude use and limits, flagged tutor chats, family devices and passkeys, and chat/trip clean-up.
  Its data comes from parent-only database functions (094) and the `admin-tools` Edge Function.
