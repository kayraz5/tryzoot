<script setup>
import {onBeforeUnmount, ref, watchEffect} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useUserStore} from '../../../model/stores/user.js';

/* Steven: Authentication page (login, signup, or continue as guest) */

const user = useUserStore();
const route = useRoute();
const router = useRouter();

const sent = ref(false);
const confirmSent = ref(false);

const email = ref('');
const password = ref('');
const method = ref('password'); // can be 'link' also
/*
    Which tab to open on. An explicit ?mode wins, because a button that said
    "Sign up" has to produce a sign-up form. Without one — arriving by the
    router's guard from a protected page, say — it follows whether this browser
    has ever had an account, since offering "sign in" to someone who has never
    registered is a dead end.
*/
const isSignUp = ref(
    route.query.mode ? route.query.mode === 'signup' : !user.hasAccount);

/*
    Whether this visitor was already signed in when the page opened.

    The redirect below exists to carry someone onward the moment they
    authenticate. It cannot also fire for a session that was already there, or
    the landing page's sign-up button would bounce anyone holding an old session
    straight to /plan without ever showing them the form — which is the bug this
    pairs with. A session that appears while the page is open is a sign-in; one
    that was there when it opened is just history.
*/
const wasSignedIn = user.isAuthed;
const name = ref('');
const busy = ref(false);

const error = ref('');

const next = () => {
    return (
        typeof route.query.next === 'string' ? route.query.next : '/plan'
    );
};

/*
    Leave the auth page, once.

    Two things call this, because neither covers the other. The watcher below
    catches a session that turns up on its own — following a magic link back
    into the tab. The buttons catch what the watcher structurally cannot see: a
    visitor who was already holding a session when the page opened never
    transitions from signed out to signed in, so nothing fires, and the button
    they just pressed appears to do nothing at all.

    Guarded, because for a visitor who arrived signed out both paths are live
    and replacing the route twice is a wasted navigation at best.
*/
let leaving = false;

function proceed() {
    if (leaving) return;
    leaving = true;

    router.replace(user.needsOnboarding ? {
        name: 'onboard',
        query: {next: next()},
    } : next());
}

watchEffect(() => {
    if (user.isAuthed && !wasSignedIn) {
        proceed();
    }
})

async function submitPassword() {
    error.value = '';
    busy.value = true;

    try {
        const signedIn = await user.passwordAuth(
            email.value.trim(), password.value, isSignUp.value);

        if (signedIn) {
            proceed();
        } else {
            confirmSent.value = true;
            startCooldown();
        }
    } catch (err) {
        error.value = friendly(err);
    } finally {
        busy.value = false;
    }
}

// The magic-link form submitted to this, but it was never written, so no link was ever sent.
async function sendLink() {
    error.value = '';
    busy.value = true;
    try {
        await user.sendMagicLink(email.value.trim());
        sent.value = true;
        startCooldown();
    } catch (err) {
        error.value = friendly(err);
    } finally {
        busy.value = false;
    }
}

// Resend whichever email we just sent. Supabase allows one per address per minute.
const cooldown = ref(0);
let cooldownTimer = null;
function startCooldown() {
    cooldown.value = 60;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
        cooldown.value -= 1;
        if (cooldown.value <= 0) clearInterval(cooldownTimer);
    }, 1000);
}
async function resend() {
    error.value = '';
    busy.value = true;
    try {
        if (sent.value) await user.sendMagicLink(email.value.trim());
        else await user.resendConfirmation(email.value.trim());
        startCooldown();
    } catch (err) {
        error.value = friendly(err);
    } finally {
        busy.value = false;
    }
}
onBeforeUnmount(() => clearInterval(cooldownTimer));
function useAnotherEmail() {
    sent.value = false;
    confirmSent.value = false;
    error.value = '';
}

// Supabase error messages, in words a traveller understands.
function friendly(err) {
    const msg = err?.message || String(err);
    if (/rate limit|too many|429|only request this after/i.test(msg)) return 'Too many emails were sent recently. Wait a minute or two, then try again.';
    if (/email not confirmed/i.test(msg)) return 'Confirm your email first: check your inbox (and spam folder) for the link.';
    if (/invalid login credentials/i.test(msg)) return 'Wrong email or password. New here? Create an account instead.';
    if (/invalid.*email|unable to validate email/i.test(msg)) return 'That email address doesn\'t look right. Check it and try again.';
    return msg;
}

async function switchMethod(m) {
    method.value = m;
    error.value = '';
}

async function guest() {
    busy.value = true;
    await user.continueAsGuest(name.value.trim() || 'Field Traveller');
    busy.value = false;
    proceed();
}

</script>

<template>
    <main class="zt-page" style="max-width:460px">
        <RouterLink to="/" class="btn btn-link px-0 mb-2">
            <i class="bi bi-arrow-left"></i> Back
        </RouterLink>
        <div class="zt-card overflow-hidden">
            <div class="banner" role="img" aria-label="A traveller reading a yellow Zoot passport" />
            <div class="p-4">
                <h1 class="title mb-1">Board the quest</h1>
                <p class="text-muted">Your stamps, XP and passport follow your account.</p>

                <div v-if="sent || confirmSent" class="alert alert-success">
                    <i class="bi bi-envelope-check"></i>
                    <template v-if="sent">Check <b>{{ email }}</b> and tap the link on this device.</template>
                    <template v-else>Account created. Check <b>{{ email }}</b> to confirm it, then sign in.</template>
                    <div class="small mt-2">Nothing after a minute? Check your spam folder, or resend it.</div>
                    <div class="d-flex flex-wrap gap-2 mt-2">
                        <button type="button" class="btn btn-sm btn-dark" :disabled="busy || cooldown > 0" @click="resend">
                            {{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email' }}
                        </button>
                        <button type="button" class="btn btn-sm btn-link" @click="useAnotherEmail">Use a different email</button>
                    </div>
                </div>
                <template v-else-if="user.canUseEmail">
                    <!-- login/signup forms -->
                    <div class="btn-group w-100 mb-3" role="group" aria-label="Sign-in method">
                        <button type="button" class="btn btn-sm" :class="method === 'password' ? 'btn-dark' : 'btn-outline-dark'" @click="switchMethod('password')">Password</button>
                        <button type="button" class="btn btn-sm" :class="method === 'link' ? 'btn-dark' : 'btn-outline-dark'" @click="switchMethod('link')">Magic link</button>
                    </div>

                    <form v-if="method === 'password'" @submit.prevent="submitPassword" class="mb-3">
                        <label class="form-label" for="email">Email</label>
                        <input id="email" v-model="email" type="email" class="form-control mb-2" placeholder="email@example.com" required autocomplete="email" />

                        <label class="form-label" for="password">Password</label>
                        <input id="password" v-model="password" type="password" minlength="6" 
                            class="form-control mb-2" placeholder="At least 6 characters" required 
                            :autocomplete="isSignUp ? 'new-password' : 'current-password'" />

                        <button class="btn btn-primary w-100" :disabled="busy || !email || password.length < 6">
                            {{ isSignUp ? 'Create account' : 'Sign in' }}
                        </button>
                        <p class="small text-center mt-2 mb-0">
                            {{ isSignUp ? 'Already have an account?' : 'New here?' }}
                            <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="isSignUp = !isSignUp; error = ''">
                                {{ isSignUp ? 'Sign in' : 'Create an account' }}
                            </button>
                        </p>
                    </form>

                    <form v-else @submit.prevent="sendLink" class="mb-3">
                        <label class="form-label" for="email">Email magic link</label>
                        <input id="email" v-model="email" type="email" class="form-control mb-2" placeholder="email@example.com" required autocomplete="email"/>
                        <button class="btn btn-primary w-100" :disabled="busy || !email">Send me a link</button>
                    </form>
                </template>

                <!-- happens when database is not connected -->
                <div v-else class="alert alert-info tiny mb-3">
                    <i class="bi bi-info-circle"></i> 
                    Email sign-in turns on when <code>VITE_SUPABASE_URL</code> and 
                    <code>VITE_SUPABASE_ANON_KEY</code> are set. 
                    Guest mode saves on this device.
                </div>

                <p v-if="error" class="text-danger small">{{ error }}</p>

                <div class="divider my-3"><span>or</span></div>

                <label class="form-label" for="name">Play as guest</label>
                <input id="name" v-model="name" class="form-control mb-2" placeholder="Traveller name (optional)" maxlength="32"/>
                <button class="btn btn-pop w-100" :disabled="busy" @click="guest"><i class="bi bi-person-walking"></i> Continue as guest</button>
            </div>
        </div>
    </main>
</template>

<style scoped>
.divider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--zt-muted);
    font-weight: 800;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}
.divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 2px;
    background: var(--zt-line);
}
.banner {
    height: 150px;
    background: var(--zt-yellow) url('/brand/zoot-passport.jpg') center 28% / cover no-repeat;
    border-bottom: var(--zt-bw) solid var(--zt-line);
    border-radius: calc(var(--zt-radius) - 3px) calc(var(--zt-radius) - 3px) 0 0;
}
.title {
    font-size: 2.4rem;
}
</style>