document.addEventListener('DOMContentLoaded', async function() {
    const refreshButton = document.getElementById('refreshTabs');
    const tabTableBody = document.getElementById('tabTableBody');
    const errorMessage = document.getElementById('errorMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfoDiv = document.getElementById('userInfo');
    const viewAllTabsBtn = document.getElementById('viewAllTabsBtn');
    const popupBody = document.getElementById('popupBody');

    function formatPageTitle(title, url) {
        if (!title) return 'Untitled';

        const patterns = [
            { suffix: ' - YouTube', domain: 'youtube.com' },
            { suffix: ' | Facebook', domain: 'facebook.com' },
            { suffix: ' on Disney+ Hotstar', domain: 'hotstar.com' },
            { suffix: ' - ChatGPT', domain: 'chat.openai.com' },
            { suffix: ' | LinkedIn', domain: 'linkedin.com' },
            { suffix: ' | Twitter', domain: 'twitter.com' },
            { suffix: ' | X', domain: 'x.com' },
            { suffix: ' - Google Search', domain: 'google.com' },
            { suffix: ' - Microsoft Teams', domain: 'teams.microsoft.com' },
            { suffix: ' | Instagram', domain: 'instagram.com' }
        ];

        let cleanTitle = title;
        for (const pattern of patterns) {
            if (url.includes(pattern.domain)) {
                cleanTitle = cleanTitle.replace(pattern.suffix, '');
            }
        }

        return cleanTitle.trim() || 'Untitled';
    }

    function adjustPopupHeight() {
        const minHeight = 300;
        const maxHeight = 600;
        const contentHeight = popupBody.scrollHeight;
        const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
        document.body.style.height = `${newHeight}px`;
        document.documentElement.style.height = `${newHeight}px`;
    }

    async function displayUserInfo(user) {
        if (user) {
            userInfoDiv.innerHTML = `
                <p>Hello ${user.name} [${user.username}]</p>
                <p>Your email: ${user.email}</p>
            `;
            adjustPopupHeight();
        } else {
            userInfoDiv.innerHTML = '<p>User information not available.</p>';
        }
    }

    async function fetchUserDetails(userId, token) {
        if (!token) return;

        try {
            const response = await fetch(`http://localhost:5000/auth/user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                await displayUserInfo(user);
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
        }
    }

    async function checkLoginStatus() {
        try {
            const token = await getToken();
            const userId = await getUserId();

            if (token && userId) {
                await fetchUserDetails(userId, token);
                await fetchAndDisplayTabs(token);
            } else {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error in checkLoginStatus:', error);
        }
    }

    async function logout() {
        try {
            if (chrome?.storage?.local) {
                await new Promise((resolve, reject) => {
                    chrome.storage.local.remove(['token', 'user_id', 'tokenExpiration'], function(result) {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                });
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user_id');
                localStorage.removeItem('tokenExpiration');
            }
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error in logout:', error);
        }
    }

    async function deleteTab(url) {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch('http://localhost:5000/delete_tab', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url })
            });

            if (response.ok) {
                await fetchAndDisplayTabs(token);
            }
        } catch (error) {
            console.error('Error deleting tab:', error);
        }
    }

    async function fetchAndDisplayTabs(token) {
        if (!token) return;

        try {
            tabTableBody.innerHTML = '';

            const response = await fetch('http://localhost:5000/get_tabs', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) return;

            const tabs = await response.json();
            const extensionId = chrome.runtime.id;
            const filteredTabs = tabs.filter(tab =>
                !tab.url.startsWith('chrome-extension://' + extensionId)
            );

            const lastFiveTabs = filteredTabs
                .sort((a, b) => new Date(b.last_opened) - new Date(a.last_opened))
                .slice(0, 5);

            if (lastFiveTabs.length === 0) {
                const noDataRow = tabTableBody.insertRow();
                const noDataCell = noDataRow.insertCell();
                noDataCell.colSpan = 3;
                noDataCell.textContent = 'No tabs tracked yet.';
                noDataCell.style.textAlign = 'center';
            } else {
                for (const tab of lastFiveTabs) {
                    const row = tabTableBody.insertRow();

                    // Title cell with delete icon
                    const titleCell = row.insertCell();
                    titleCell.className = 'tab-cell';

                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'tab-link';
                    titleSpan.textContent = formatPageTitle(tab.title, tab.url);

                    const deleteIcon = document.createElement('div');
                    deleteIcon.className = 'delete-icon';
                    deleteIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteTab(tab.url);
                    });

                    titleCell.appendChild(titleSpan);
                    titleCell.appendChild(deleteIcon);

                    titleSpan.addEventListener('click', async () => {
                        try {
                            const existingTab = await findExistingTab(tab.url);
                            if (existingTab) {
                                chrome.tabs.update(existingTab.id, { active: true });
                                chrome.windows.update(existingTab.windowId, { focused: true });
                            } else {
                                chrome.tabs.create({ url: tab.url });
                            }
                        } catch (error) {
                            console.error('Error handling tab click:', error);
                        }
                    });

                    // Browser cell
                    const browserCell = row.insertCell();
                    browserCell.textContent = tab.browser || 'Unknown';

                    // Last opened cell
                    const lastOpenedCell = row.insertCell();
                    lastOpenedCell.textContent = formatDateTime(tab.last_opened);
                }
            }
            adjustPopupHeight();
        } catch (error) {
            console.error('Error fetching tabs:', error);
        }
    }

    async function getToken() {
        return new Promise((resolve, reject) => {
            if (chrome?.storage?.local) {
                chrome.storage.local.get(['token', 'tokenExpiration'], function(result) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        if (result.token && (!result.tokenExpiration || Date.now() < parseInt(result.tokenExpiration))) {
                            resolve(result.token);
                        } else {
                            resolve(null);
                        }
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
    }

    async function getUserId() {
        return new Promise((resolve, reject) => {
            if (chrome?.storage?.local) {
                chrome.storage.local.get(['user_id'], function(result) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result.user_id);
                    }
                });
            } else {
                resolve(localStorage.getItem('user_id'));
            }
        });
    }

    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'N/A';
        const utcDate = new Date(dateTimeString);
        const day = utcDate.getDate().toString().padStart(2, '0');
        const month = (utcDate.getMonth() + 1).toString().padStart(2, '0');
        const year = utcDate.getFullYear();
        const hours = utcDate.getHours().toString().padStart(2, '0');
        const minutes = utcDate.getMinutes().toString().padStart(2, '0');
        const seconds = utcDate.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    async function findExistingTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                const matchingTab = tabs.find(tab => tab.url === url);
                resolve(matchingTab);
            });
        });
    }

    refreshButton.addEventListener('click', async function() {
        try {
            const token = await getToken();
            if (token) {
                await fetchAndDisplayTabs(token);
            }
        } catch (error) {
            console.error('Error refreshing tabs:', error);
        }
    });

    viewAllTabsBtn.addEventListener('click', function() {
        window.open('webpage.html', '_blank');
    });

    logoutBtn.addEventListener('click', logout);

    // Initial setup
    checkLoginStatus();
});