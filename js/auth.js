/**
 * Authentication module using Supabase
 * Handles Discord OAuth, session management, and UI updates
 */
import { CONFIG } from './config.js';
import { 
    addEventListeners, 
    showModal, 
    hideModal, 
    safeQuerySelector,
    waitForCondition 
} from './utils.js';

export class AuthManager {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.init();
    }

    /**
     * Initialize the authentication manager
     */
    async init() {
        try {
            // Wait for Supabase to load with improved error handling
            const supabaseLoaded = await waitForCondition(
                () => typeof window.supabase !== 'undefined',
                CONFIG.SUPABASE_RETRY_ATTEMPTS * CONFIG.SUPABASE_RETRY_DELAY,
                CONFIG.SUPABASE_RETRY_DELAY
            );

            if (!supabaseLoaded) {
                console.error('Supabase failed to load. Authentication will be disabled.');
                this.setupFallbackUI();
                return;
            }

            // Initialize Supabase client
            this.supabase = window.supabase.createClient(
                CONFIG.SUPABASE_URL, 
                CONFIG.SUPABASE_ANON_KEY
            );

            // Setup event listeners and check current auth state
            this.setupEventListeners();
            await this.checkAuth();

            // Listen for auth state changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event);
                this.updateUI();
            });

            this.isInitialized = true;
            console.log('Auth manager initialized successfully');

        } catch (error) {
            console.error('Failed to initialize auth manager:', error);
            this.setupFallbackUI();
        }
    }

    /**
     * Setup event listeners for authentication-related actions
     */
    setupEventListeners() {
        // Discord login button
        addEventListeners('#discordSignIn', 'click', (e) => {
            e.preventDefault();
            this.signInWithDiscord();
        });

        // User section interactions (login/logout)
        addEventListeners('#userSection', 'click', (e) => {
            if (e.target.closest('.login-btn')) {
                showModal('#authPage');
            }
            if (e.target.closest('.user-avatar') || e.target.closest('.user-dropdown-btn')) {
                this.signOut();
            }
        });

        // Modal close buttons
        addEventListeners('.close-auth', 'click', () => hideModal('#authPage'));
        addEventListeners('.close-ip-modal', 'click', () => hideModal('#ipModal'));

        // Close modals by clicking outside
        addEventListeners('#authPage', 'click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal('#authPage');
            }
        });
        addEventListeners('#ipModal', 'click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal('#ipModal');
            }
        });

        // Server join buttons
        addEventListeners('.server-join-btn', 'click', () => this.handleServerJoin());

        // IP copy buttons
        addEventListeners('.ip-btn', 'click', (e) => this.copyIP(e.currentTarget));
    }

    /**
     * Setup fallback UI when Supabase is not available
     */
    setupFallbackUI() {
        const userSection = safeQuerySelector('#userSection');
        if (userSection) {
            userSection.innerHTML = '<button class="login-btn" disabled>Service Unavailable</button>';
        }

        // Still allow server join button to show IP modal
        addEventListeners('.server-join-btn', 'click', () => showModal('#ipModal'));
        addEventListeners('.close-ip-modal', 'click', () => hideModal('#ipModal'));
        addEventListeners('#ipModal', 'click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal('#ipModal');
            }
        });
        addEventListeners('.ip-btn', 'click', (e) => this.copyIP(e.currentTarget));
    }

    /**
     * Sign in with Discord OAuth
     */
    async signInWithDiscord() {
        if (!this.isInitialized || !this.supabase) {
            alert('Authentication service is not available');
            return;
        }

        try {
            console.log('Starting Discord authentication...');
            
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    redirectTo: CONFIG.REDIRECT_URL,
                    scopes: 'identify email'
                }
            });

            if (error) {
                console.error('OAuth error:', error);
                alert('Error signing in with Discord: ' + error.message);
                return;
            }

            console.log('OAuth data:', data);

        } catch (error) {
            console.error('Authentication error:', error);
            alert('An error occurred during authentication');
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        if (!this.isInitialized || !this.supabase) {
            return;
        }

        if (confirm('Sign out of your account?')) {
            try {
                const { error } = await this.supabase.auth.signOut();
                if (error) throw error;
                
                this.updateUI();
                hideModal('#authPage');
                hideModal('#ipModal');
                
            } catch (error) {
                console.error('Sign out error:', error);
                alert('Failed to sign out');
            }
        }
    }

    /**
     * Check current authentication status
     */
    async checkAuth() {
        if (!this.isInitialized || !this.supabase) {
            return;
        }

        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                return;
            }

            if (session) {
                console.log('Active session found:', session.user);
                this.updateUI();
            } else {
                console.log('No active session found');
                this.updateUI();
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    /**
     * Update the UI based on authentication status
     */
    async updateUI() {
        const userSection = safeQuerySelector('#userSection');
        if (!userSection) return;

        if (!this.isInitialized || !this.supabase) {
            userSection.innerHTML = '<button class="login-btn" disabled>Service Unavailable</button>';
            return;
        }

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('Get user error:', error);
                userSection.innerHTML = '<button class="login-btn">Sign In</button>';
                return;
            }

            if (user) {
                console.log('User found:', user);
                
                const name = user.user_metadata?.full_name || 
                            user.user_metadata?.global_name || 
                            user.email || 
                            'User';
                
                const avatarUrl = user.user_metadata?.avatar_url;
                
                userSection.innerHTML = `
                    <div class="user-info">
                        <div class="user-avatar" title="${name}">
                            ${avatarUrl ? 
                                `<img src="${avatarUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;">` : 
                                name[0].toUpperCase()
                            }
                        </div>
                        <span>${name}</span>
                    </div>
                `;
            } else {
                userSection.innerHTML = '<button class="login-btn">Sign In</button>';
            }
        } catch (error) {
            console.error('UI update error:', error);
            userSection.innerHTML = '<button class="login-btn">Sign In</button>';
        }
    }

    /**
     * Handle server join button click
     */
    async handleServerJoin() {
        if (!this.isInitialized || !this.supabase) {
            // Show IP modal directly if auth is not available
            showModal('#ipModal');
            return;
        }

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('User check error:', error);
                showModal('#authPage');
                return;
            }

            if (user) {
                showModal('#ipModal');
            } else {
                showModal('#authPage');
            }
        } catch (error) {
            console.error('Server join error:', error);
            showModal('#authPage');
        }
    }

    /**
     * Copy IP address to clipboard
     * @param {HTMLElement} button - The IP button element
     */
    async copyIP(button) {
        const ip = button.getAttribute('data-ip');
        if (!ip) return;
        
        try {
            await navigator.clipboard.writeText(ip);
            
            // Visual feedback
            button.classList.add('copied');
            setTimeout(() => {
                button.classList.remove('copied');
            }, 1200);
            
        } catch (error) {
            console.error('Copy error:', error);
            
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = ip;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1200);
                
            } catch (fallbackError) {
                alert(`Failed to copy IP. Copy manually: ${ip}`);
            }
        }
    }
}