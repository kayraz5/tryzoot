import {defineStore} from 'pinia';
import {getDb, hasLinkedAccount, isGuestMode, rememberLinkedAccount, setGuestMode} from '../services/db/index.js';
import {HAS_SUPABASE} from '../services/config.js';
import {levelFor, titleFor} from '../services/xp.js';

/* Steven: User Profile Authentication & Session */
export const useUserStore = defineStore('user', {
    // initial state
    state: () => ({
        session: null,
        profile: null,
        ready: false,
        mode: 'local',
        // Whether this browser has ever had an account. Read once, then kept in
        // state so views react to it the way they do to session.
        hasAccount: hasLinkedAccount(),
        _init: null
    }),
    
    // getters (encapsulate field retrieval)
    getters: {
        isAuthed: (s) => Boolean(s.session?.user),
        userId: (s) => s.session?.user?.id || null,
        needsOnboarding: (s) => Boolean(s.session?.user) && !s.profile?.style,
        level: (s) => levelFor(s.profile?.xp || 0),
        canUseEmail: () => HAS_SUPABASE,
        title() { 
            return titleFor(this.level.level);
        }
    },
    
    // define methods & actions
    actions: {
        init() {
            if (!this._init) {
                this._init = this._load();
            }
            return this._init;
        },
        
        // load session
        async _load() {
            const db = await getDb();
            this.mode = db.kind;
            this.session = await db.getSession();
            
            if (this.session?.user) {
                this.rememberAccount();
                await this.refreshProfile();
            }
            
            db.onAuthChange(async (session) => {
                this.session = session;
                if (session?.user) {
                    this.rememberAccount();
                    await this.refreshProfile();
                } else {
                    this.profile = null;
                }
            });
            
            this.ready = true;
        },
        
        // Record that this browser has had an account. Never undone: signOut
        // ends the session, it does not un-create the account.
        rememberAccount() {
            this.hasAccount = true;
            rememberLinkedAccount();
        },
        
        // refresh the profile
        async refreshProfile() {
            const db = await getDb();
            let p = await db.getProfile(this.userId);
            
            // The signup trigger creates the row; if it has not landed yet, create a minimal one.
            if (!p && db.kind === 'supabase') {
                p = await db.updateProfile(this.userId, {display_name: this.session.user.email?.split('@')[0]});
            }
            
            this.profile = p;
        },
        
        // set session to guest account
        async continueAsGuest(name) {
            setGuestMode(true);
            this._init = null;
            
            const db = await getDb();
            this.mode = db.kind;
            this.session = await db.signInGuest(name);
            
            // The local adapter's onAuthChange is a no-op, so nothing else will
            // notice this session; same for passwordAuth below.
            this.rememberAccount();
            await this.refreshProfile();
            this.ready = true;
        },
        
        // magic link to authenticate with email without password
        async sendMagicLink(email) {
            setGuestMode(false);
            this._init = null;
            
            const db = await getDb();
            await db.signInWithEmail(email);
        },
        
        // resend the "confirm your email" message after creating an account
        async resendConfirmation(email) {
            const db = await getDb();
            await db.resendSignup(email);
        },

        // email and password login
        async passwordAuth(email, password, isSignUp = false) {
            setGuestMode(false);
            this._init = null;
            
            const db = await getDb();
            this.mode = db.kind;
            
            const session = isSignUp 
                ? await db.signUpWithPassword(email, password) 
                : await db.signInWithPassword(email, password);
                
            if (!session) {
                return false;
            }
            
            this.session = session;
            this.rememberAccount();
            await this.refreshProfile();
            this.ready = true;
            
            return true;
        },
        
        // update profiles with specified updates
        async updateProfile(updates) {
            const db = await getDb();
            this.profile = await db.updateProfile(this.userId, updates);
        },
        
        // set profile
        setProfile(profile) {
            if (profile) {
                this.profile = profile;
            }
        },
        
        // sign out and empty the session
        async signOut() {
            const db = await getDb();
            await db.signOut();
            
            this.session = null;
            this.profile = null;
            
            if (HAS_SUPABASE && isGuestMode()) {
                setGuestMode(false);
            }
            
            this._init = null;
        }
    }
});