// Sign-in for r4box.com: the same accounts as the game room (Supabase, project theGAME).
// The publishable key is meant to be public; the database's rules and, for the box,
// the role in each account's app metadata (which users cannot change) are what protect things.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

export const sb = createClient('https://okywhdfmdpdvrfhbkyeo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9reXdoZGZtZHBkdnJmaGJreWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Nzc1OTQsImV4cCI6MjEwNjA1MzU5NH0.cJHfp_0pnAz9HpeX7e5UoGJ_K5rU6eSe1sajcktf8fs', {
  auth: { experimental: { passkey: true } },
});

// Who appears on "Who's here?". Email is how Supabase knows them; mail = can get a sign-in link.
export const FAMILY = [
  { name: 'phoenix_lord', email: 'phoenix_lord@thegame.com', avatar: 'avatars/phoenix_lord.jpg' },
  { name: 'dad_commander', email: 'erik@r4box.com', mail: true },
  { name: 'obanai_rocks', email: 'obanai_rocks@thegame.com' },
];

// parent sees the whole box; anyone else, kid. Unset counts as kid: fewest doors.
export const roleOf = (user) => (user?.app_metadata?.r4_role === 'parent' ? 'parent' : 'kid');
export const nameOf = (user) => FAMILY.find((f) => f.email === user?.email)?.name || (user?.email || '').split('@')[0];

// The box (os, diary...) checks who is signed in from this cookie, on every request.
// Short-lived: it is the access token itself and expires with it.
// The box's door (r4door) takes the sign-in from a cookie that lives only for
// the hop to it: set just before going to a box page that asked, cleared by the
// door at once (and here on sign-out). Box pages never see it otherwise.
const HOP = 'Domain=r4box.com; Path=/; Secure; SameSite=Lax';
export function handOver(session) {
  document.cookie = session ? `r4s=${session.access_token}; Max-Age=120; ${HOP}` : `r4s=; Max-Age=0; ${HOP}`;
}
