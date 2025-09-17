// supabase-auth.js
class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.init();
    }

    async init() {
        // Wait for Supabase to load
        if (typeof window.supabase === 'undefined') {
            console.error("Supabase is not loaded!");
            return;
        }

        try {
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            this.setupEventListeners();
            await this.checkAuth();
            
            // Listen for auth state changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event);
                this.updateUI();
            });
        } catch (error) {
            console.error('Error initializing Supabase:', error);
        }
    }

    setupEventListeners() {
        // Discord login
        this.on('#discordSignIn', 'click', (e) => {
            e.preventDefault();
            this.signInWithDiscord();
        });

        // User section clicks
        this.on('#userSection', 'click', (e) => {
            if (e.target.closest('.login-btn')) {
                this.showModal('#authPage');
            }
            if (e.target.closest('.user-avatar')) {
                this.signOut();
            }
        });

        // Close modals
        this.on('.close-auth', 'click', () => this.hideModal('#authPage'));
        this.on('.close-ip-modal', 'click', () => this.hideModal('#ipModal'));

        // Close modals by clicking outside
        this.on('#authPage', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#authPage');
        });
        this.on('#ipModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#ipModal');
        });

        // Server join buttons
        this.on('.server-join-btn', 'click', () => this.handleServerJoin());

        // IP copy buttons
        this.on('.ip-btn', 'click', (e) => this.copyIP(e.currentTarget));
    }

    // Helper function for event handlers
    on(selector, event, handler) {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener(event, handler);
        });
    }

    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) modal.style.display = 'flex';
    }

    hideModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) modal.style.display = 'none';
    }

    async signInWithDiscord() {
        try {
            console.log('Starting Discord authentication...');
            
            // Get the current URL for proper redirect
            const currentUrl = window.location.href.split('?')[0]; // Remove any query params
            const redirectUrl = currentUrl.endsWith('/') ? currentUrl : `${currentUrl}/`;
            
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    redirectTo: redirectUrl,
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

    async signOut() {
        if (confirm('Sign out of your account?')) {
            try {
                const { error } = await this.supabase.auth.signOut();
                if (error) throw error;
                this.updateUI();
                this.hideModal('#authPage');
                this.hideModal('#ipModal');
            } catch (error) {
                console.error('Sign out error:', error);
                alert('Could not sign out of account');
            }
        }
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                return;
            }

            if (session) {
                console.log('Session found:', session.user);
                this.updateUI();
            } else {
                console.log('No active session found');
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    async updateUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('Error getting user:', error);
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
                                name[0]
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

    async handleServerJoin() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('User check error:', error);
                this.showModal('#authPage');
                return;
            }

            if (user) {
                this.showModal('#ipModal');
            } else {
                this.showModal('#authPage');
            }
        } catch (error) {
            console.error('Server button handling error:', error);
            this.showModal('#authPage');
        }
    }

    async copyIP(button) {
        const ip = button.getAttribute('data-ip');
        
        try {
            await navigator.clipboard.writeText(ip);
            
            // Visual feedback
            button.classList.add('copied');
            
            // Reset after 1.2 seconds
            setTimeout(() => {
                button.classList.remove('copied');
            }, 1200);
            
        } catch (error) {
            console.error('Copy error:', error);
            
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = ip;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1200);
                
            } catch (fallbackError) {
                alert('Could not copy IP. Copy manually: ' + ip);
            }
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if Supabase is loaded
    if (typeof window.supabase !== 'undefined') {
        new AuthManager();
    } else {
        // If Supabase is not yet loaded, wait for it
        const checkSupabase = setInterval(() => {
            if (typeof window.supabase !== 'undefined') {
                clearInterval(checkSupabase);
                new AuthManager();
            }
        }, 100);
    }
});

// Global functions for buttons
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
