// Set up error handling for unhandled promises
self.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

let tabTracker = {
    apiEndpoint: 'http://localhost:5000/save_tab',
    openTabs: new Map(),
    activeTabId: null,
    lastSavedUrls: new Map(), // Track last saved URLs to prevent duplicates

    extractTabInfo: function (tab) {
        if (!tab.url || !this.shouldTrackTab(tab)) {
            return null;
        }

        return {
            url: tab.url,
            title: tab.title || 'Untitled',
            browser: this.detectBrowser(),
            state: JSON.stringify({
                windowId: tab.windowId,
                index: tab.index,
                pinned: tab.pinned,
                tabId: tab.id
            })
        };
    },

    detectBrowser: function () {
        const userAgent = self.navigator.userAgent;
        if (userAgent.indexOf("Chrome") > -1) return 'chrome';
        if (userAgent.indexOf("Firefox") > -1) return 'firefox';
        return 'unknown';
    },

    getToken: async function () {
        try {
            return new Promise((resolve, reject) => {
                if (chrome?.storage?.local) {
                    chrome.storage.local.get(['token', 'tokenExpiration'], function (result) {
                        if (chrome.runtime.lastError) {
                            console.error('Storage error:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                            return;
                        }

                        const { token, tokenExpiration } = result;

                        if (token && (!tokenExpiration || Date.now() < parseInt(tokenExpiration))) {
                            resolve(token);
                        } else {
                            console.log('Token expired or not found');
                            resolve(null);
                        }
                    });
                } else {
                    const token = localStorage.getItem('token');
                    const tokenExpiration = localStorage.getItem('tokenExpiration');

                    if (token && (!tokenExpiration || Date.now() < parseInt(tokenExpiration))) {
                        resolve(token);
                    } else {
                        resolve(null);
                    }
                }
            });
        } catch (error) {
            console.error('Error in getToken:', error);
            return null;
        }
    },

    shouldTrackTab: function(tab) {
        try {
            // Basic validation
            if (!tab || !tab.url) {
                return false;
            }

            // Excluded URL patterns
            const excludePatterns = [
                'chrome://',
                'chrome-extension://',
                'edge://',
                'about:blank',
                'about:newtab',
                'chrome://newtab',
                'edge://newtab'
            ];

            // Check if URL matches any excluded pattern
            if (excludePatterns.some(pattern => tab.url.startsWith(pattern))) {
                return false;
            }

            // Check if URL is different from last saved
            const lastUrl = this.lastSavedUrls.get(tab.id);
            if (lastUrl === tab.url) {
                return false;
            }

            // Additional validation
            const isValidUrl = tab.url.includes('://') &&
                             !tab.url.includes('chrome://') &&
                             !tab.url.includes('chrome-extension://');

            return isValidUrl;
        } catch (error) {
            console.error('Error in shouldTrackTab:', error);
            return false;
        }
    },

    saveTabInfo: async function (tab) {
        try {
            if (!this.shouldTrackTab(tab)) {
                return;
            }

            const tabInfo = this.extractTabInfo(tab);
            if (!tabInfo) {
                return;
            }

            const token = await this.getToken();
            if (!token) {
                console.error('Token is missing. User may not be logged in.');
                return;
            }

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(tabInfo)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save tab. Status: ${response.status}, Response: ${errorText}`);
            }

            // Update last saved URL only after successful save
            this.lastSavedUrls.set(tab.id, tab.url);
            console.log('Tab saved successfully:', tabInfo.url);

        } catch (error) {
            console.error('Tab save error:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        }
    },

    handleTabActivation: async function(activeInfo) {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab.status === 'complete' && this.shouldTrackTab(tab)) {
                this.activeTabId = activeInfo.tabId;
                await this.saveTabInfo(tab);
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
    },

    handleTabUpdate: async function(tabId, changeInfo, tab) {
        try {
            // Only track when URL changes and page is complete
            if (changeInfo.status === 'complete' && tab.url && this.shouldTrackTab(tab)) {
                this.openTabs.set(tabId, tab.url);
                await this.saveTabInfo(tab);
            }
        } catch (error) {
            console.error('Error handling tab update:', error);
        }
    },

    handleTabRemoval: function(tabId) {
        this.openTabs.delete(tabId);
        this.lastSavedUrls.delete(tabId);
    },

    initializeTracking: async function () {
        console.log('Initializing tab tracking...');

        // Track URL changes
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Track active tab changes
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivation(activeInfo);
        });

        // Clean up removed tabs
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoval(tabId);
        });

        // Initialize with current active tab
        try {
            const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (activeTab) {
                await this.handleTabActivation({tabId: activeTab.id});
            }
        } catch (error) {
            console.error('Error initializing active tab:', error);
        }
    }
};

// Initialize tracking with error handling
console.log('Starting tab tracker...');
tabTracker.initializeTracking().catch(error => {
    console.error('Failed to initialize tab tracking:', error);
});