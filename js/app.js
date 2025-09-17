/**
 * Main application module
 * Initializes all components when the DOM is ready
 */
import { AuthManager } from './auth.js';
import { NavigationManager } from './navigation.js';

class App {
    constructor() {
        this.authManager = null;
        this.navigationManager = null;
        this.init();
    }

    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
            } else {
                this.initializeComponents();
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }

    initializeComponents() {
        try {
            // Initialize navigation manager
            this.navigationManager = new NavigationManager();
            console.log('Navigation manager initialized');

            // Initialize auth manager
            this.authManager = new AuthManager();
            console.log('Auth manager initialization started');

        } catch (error) {
            console.error('Failed to initialize components:', error);
        }
    }
}

// Initialize the application
new App();