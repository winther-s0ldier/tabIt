class TabService {
    constructor() {
        this.baseUrl = 'http://localhost:5000';
        this.endpoints = {
            getTabs: '/get_tabs',
            saveTabs: '/save_tab'
        };
        this.token = null;
        this.tokenExpiration = null;
        this.checkTokenExpiration();
    }

    async checkTokenExpiration() {
        // Check token expiration every hour
        setInterval(async () => {
            const tokenData = await this.getStoredTokenData();
            if (tokenData && this.isTokenNearingExpiration(tokenData.tokenExpiration)) {
                this.showRevalidationDialog();
            }
        }, 60 * 60 * 1000); // Check every hour
    }

    isTokenNearingExpiration(expirationTime) {
        const warningThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days before expiration
        return (expirationTime - Date.now()) <= warningThreshold;
    }

    async showRevalidationDialog() {
        // Create and show modal dialog
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
                    <h2 class="text-xl text-white mb-4">Session Expiring Soon</h2>
                    <p class="text-gray-300 mb-4">Please enter your password to continue using the extension.</p>
                    <input type="password" id="revalidatePassword" 
                           class="w-full p-2 mb-4 bg-gray-700 text-white rounded" 
                           placeholder="Enter your password">
                    <div class="flex justify-end gap-2">
                        <button id="cancelRevalidate" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Cancel
                        </button>
                        <button id="confirmRevalidate" 
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const handleRevalidate = async () => {
            const password = document.getElementById('revalidatePassword').value;
            try {
                const response = await fetch(`${this.baseUrl}/auth/revalidate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ password })
                });

                if (response.ok) {
                    const data = await response.json();
                    await this.updateToken(data.token, data.tokenExpiration);
                    modal.remove();
                } else {
                    // Show error message
                    document.getElementById('revalidatePassword').classList.add('border-red-500');
                }
            } catch (error) {
                console.error('Revalidation error:', error);
            }
        };

        document.getElementById('confirmRevalidate').addEventListener('click', handleRevalidate);
        document.getElementById('cancelRevalidate').addEventListener('click', () => {
            modal.remove();
        });
    }

    async fetchTabs(token) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (!token || this.isTokenExpired()) {
                console.error('Token is missing or expired. Please log in again.');
                this.handleUnauthorized();
                return [];
            }

            headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${this.baseUrl}${this.endpoints.getTabs}`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errorBody = await response.text();
                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
                }
                throw new Error(`HTTP Error: ${response.status} - ${errorBody}`);
            }

            const tabs = await response.json();
            return tabs;
        } catch (error) {
            console.error('Tab Fetching Error:', error);
            if (error.message.includes('Unauthorized')) {
                this.handleUnauthorized();
            } else {
                this.handleError(error);
            }
            return [];
        }
    }

    async saveTab(token, tabData) {
        try {
            if (!token || this.isTokenExpired()) {
                console.error('Token is missing or expired. Please log in again.');
                this.handleUnauthorized();
                return null;
            }

            const response = await fetch(`${this.baseUrl}${this.endpoints.saveTabs}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(tabData)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                if (response.status === 401) {
                    throw new Error('Unauthorized: Invalid or expired token. Please log in again.');
                }
                throw new Error(`Save Error: ${response.status} - ${errorBody}`);
            }

            const result = await response.json();
            console.log('Tab saved successfully:', result);
            return result;
        } catch (error) {
            console.error('Tab Saving Error:', error);
            if (error.message.includes('Unauthorized')) {
                this.handleUnauthorized();
            } else {
                this.handleError(error);
            }
            return null;
        }
    }

    async getToken() {
        if (!this.token || this.isTokenExpired()) {
            try {
                const tokenData = await this.getStoredTokenData();
                this.token = tokenData.token;
                this.tokenExpiration = tokenData.tokenExpiration ? parseInt(tokenData.tokenExpiration) : null;
            } catch (error) {
                console.error('Error retrieving token:', error);
                return null;
            }
        }
        return this.token;
    }

    async getUserId() {
        try {
            if (chrome?.storage?.local) {
                return new Promise((resolve, reject) => {
                    chrome.storage.local.get(['user_id'], function (result) {
                        if (chrome.runtime.lastError) {
                            console.error('Error accessing chrome.storage:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('User ID retrieved from chrome.storage:', result.user_id);
                            resolve(result.user_id);
                        }
                    });
                });
            } else {
                const userId = localStorage.getItem('user_id');
                console.log('User ID retrieved from localStorage:', userId);
                return userId;
            }
        } catch (error) {
            console.error('Error retrieving user ID:', error);
            return null;
        }
    }

    async getStoredTokenData() {
        if (chrome?.storage?.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['token', 'tokenExpiration'], (result) => {
                    resolve(result);
                });
            });
        } else {
            return {
                token: localStorage.getItem('token'),
                tokenExpiration: localStorage.getItem('tokenExpiration')
            };
        }
    }

    async updateToken(newToken, newExpiration) {
        this.token = newToken;
        this.tokenExpiration = newExpiration;
        if (chrome?.storage?.local) {
            await chrome.storage.local.set({
                token: newToken,
                tokenExpiration: newExpiration
            });
        } else {
            localStorage.setItem('token', newToken);
            localStorage.setItem('tokenExpiration', newExpiration);
        }
    }

    isTokenExpired() {
        if (!this.tokenExpiration) {
            return true;
        }
        return Date.now() > this.tokenExpiration;
    }

    handleError(error) {
        const errorDisplay = document.getElementById('errorMessage');
        if (errorDisplay) {
            errorDisplay.textContent = `Error: ${error.message}`;
            errorDisplay.classList.add('text-red-600', 'mt-2', 'font-bold');
        }
    }

    handleUnauthorized() {
        console.error('Unauthorized access. Redirecting to login.');
        this.clearToken();
        window.location.href = 'login.html';
    }

    async clearToken() {
        this.token = null;
        this.tokenExpiration = null;
        if (chrome?.storage?.local) {
            await chrome.storage.local.remove(['token', 'tokenExpiration', 'user_id']);
            console.log('Token, user ID, and token expiration cleared from chrome.storage');
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('tokenExpiration');
            localStorage.removeItem('user_id');
            console.log('Token, user ID, and token expiration cleared from localStorage');
        }
    }

    renderTabs(tabs) {
        const tabTableBody = document.querySelector('table tbody');
        if (!tabTableBody) return;

        tabTableBody.innerHTML = '';

        if (tabs.length === 0) {
            const noDataRow = tabTableBody.insertRow();
            const noDataCell = noDataRow.insertCell(0);
            noDataCell.colSpan = 5;
            noDataCell.textContent = 'No tabs found.';
            noDataCell.classList.add('text-center', 'text-gray-500', 'p-4');
            return;
        }

        tabs.forEach((tab, index) => {
            const row = tabTableBody.insertRow();
            row.innerHTML = `
                <td class="border p-2">${index + 1}</td>
                <td class="border p-2 truncate max-w-xs">${tab.title || 'Untitled'}</td>
                <td class="border p-2 truncate max-w-xs">
                    <a href="${tab.url}" target="_blank" class="text-blue-600 hover:underline">${tab.url}</a>
                </td>
                <td class="border p-2">${tab.browser || 'Unknown'}</td>
                <td class="border p-2 truncate">${this.formatDateTime(tab.last_opened)}</td>
            `;
        });
    }

    formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'N/A';
        const date = new Date(dateTimeString);
        return date.toLocaleString();
    }
}

const tabService = new TabService();
export default tabService;