// EDITOR: MATTHEW + STEVEN
import { HAS_SUPABASE } from "../config.js";
import { localDb } from "./local.js";

/* Steven: index.js to merge logics between local and remote db */

let remoteDb = null;

export function isGuestMode() {
  try {
    return !HAS_SUPABASE || localStorage.getItem('zoot.guest') === '1'
  } catch (err) {
    console.error(err);
    return true;
  }
}

export function setGuestMode(on) {
  try {
    on ? localStorage.setItem('zoot.guest', '1') : localStorage.removeItem('zoot.guest');
  } catch (err) {
    console.error(err);
  }
}

/*
    Has an account ever been linked in this browser?

    Not the same question as "is there a session", which is what isAuthed
    answers. This one survives signing out, and it is the difference between
    greeting a stranger and greeting someone who already has an account.

    A breadcrumb rather than a probe, because neither adapter leaves a reliable
    trace once you sign out: supabase-js deletes its persisted token, and the
    guest adapter's own keys can be cleared with the rest of site data. It is
    set when a real session is first seen and then never cleared — "this
    browser has had an account" does not stop being true.

    The adapters' own leftovers are still accepted as evidence, so anyone who
    signed in before this shipped is recognised instead of being asked to sign
    up again.
*/
export function hasLinkedAccount() {
  try {
    if (localStorage.getItem('zoot.account') === '1') return true;
    if (localStorage.getItem('zoot.session')) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // supabase-js persists as `sb-<project-ref>-auth-token` (remote.js).
      if (key && /^sb-.+-auth-token$/.test(key)) return true;
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export function rememberLinkedAccount() {
  try {
    localStorage.setItem('zoot.account', '1');
  } catch (err) {
    console.error(err);
  }
}

export async function getDb() {
  if (isGuestMode()) {
    return localDb
  }
  if (!remoteDb) {
    const { createRemoteDb } = await import('./remote.js');
    remoteDb = createRemoteDb();
  }

  return remoteDb;
}
