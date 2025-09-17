/**
 * Navigation module for handling menu interactions and smooth scrolling
 */
import { addEventListeners, smoothScrollTo, safeQuerySelector } from './utils.js';

export class NavigationManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mobile menu toggle
        addEventListeners('.mobile-menu-btn', 'click', this.toggleMobileMenu.bind(this));
        
        // Scroll to servers button
        addEventListeners('#scrollToServersBtn', 'click', NavigationManager.scrollToServers);
        
        // Close mobile menu when clicking nav links
        addEventListeners('nav a', 'click', this.closeMobileMenu.bind(this));
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const nav = safeQuerySelector('nav');
            const menuBtn = safeQuerySelector('.mobile-menu-btn');
            
            if (nav && menuBtn && 
                !nav.contains(e.target) && 
                !menuBtn.contains(e.target) && 
                nav.classList.contains('active')) {
                this.closeMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        const nav = safeQuerySelector('nav');
        if (nav) {
            nav.classList.toggle('active');
        }
    }

    closeMobileMenu() {
        const nav = safeQuerySelector('nav');
        if (nav) {
            nav.classList.remove('active');
        }
    }

    /**
     * Smooth scroll to servers section
     */
    static scrollToServers() {
        smoothScrollTo('servers-section');
    }
}

// Export the scroll function for global access (maintaining backward compatibility)
window.scrollToServers = NavigationManager.scrollToServers;