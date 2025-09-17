/**
 * Utility functions for DOM manipulation and common operations
 */

/**
 * Safely query selector with error handling
 * @param {string} selector - CSS selector
 * @returns {Element|null} - Element or null if not found
 */
export function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return null;
    }
}

/**
 * Safely query all selectors with error handling
 * @param {string} selector - CSS selector
 * @returns {NodeList} - NodeList or empty array if error
 */
export function safeQuerySelectorAll(selector) {
    try {
        return document.querySelectorAll(selector);
    } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return [];
    }
}

/**
 * Add event listener with error handling
 * @param {string} selector - CSS selector
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 */
export function addEventListeners(selector, event, handler) {
    const elements = safeQuerySelectorAll(selector);
    elements.forEach(element => {
        try {
            element.addEventListener(event, handler);
        } catch (error) {
            console.warn(`Failed to add event listener to ${selector}:`, error);
        }
    });
}

/**
 * Show modal with safety checks
 * @param {string} selector - Modal selector
 */
export function showModal(selector) {
    const modal = safeQuerySelector(selector);
    if (modal) {
        modal.style.display = 'flex';
        // Add focus trap for accessibility
        modal.focus();
    }
}

/**
 * Hide modal with safety checks
 * @param {string} selector - Modal selector
 */
export function hideModal(selector) {
    const modal = safeQuerySelector(selector);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Smooth scroll to element
 * @param {string} elementId - Element ID
 */
export function smoothScrollTo(elementId) {
    const element = safeQuerySelector(`#${elementId}`);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

/**
 * Wait for a condition with timeout
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @returns {Promise<boolean>} - True if condition met, false if timeout
 */
export function waitForCondition(condition, timeout = 5000, interval = 100) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkCondition = () => {
            if (condition()) {
                resolve(true);
                return;
            }
            
            if (Date.now() - startTime >= timeout) {
                resolve(false);
                return;
            }
            
            setTimeout(checkCondition, interval);
        };
        
        checkCondition();
    });
}