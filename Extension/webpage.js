import tabService from './tabService.js';

document.addEventListener('DOMContentLoaded', async () => {
    const refreshButton = document.getElementById('refreshTabs');
    const searchBox = document.getElementById('searchBox');
    const tabsTableBody = document.getElementById('tabsTableBody');
    const errorMessage = document.getElementById('errorMessage');
    const userInfoDiv = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    let selectedTabs = new Set();
    let isEditing = false;

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

    function handleCheckboxClick(tabUrl, checkbox) {
        if (checkbox.classList.contains('checked')) {
            checkbox.classList.remove('checked');
            selectedTabs.delete(tabUrl);
        } else {
            checkbox.classList.add('checked');
            selectedTabs.add(tabUrl);
        }
        updateActionButtons();
    }

    function updateActionButtons() {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';

        if (selectedTabs.size > 0) {
            deleteBtn.style.display = 'inline-block';
            deleteBtn.textContent = selectedTabs.size > 1 ? 'Delete All' : 'Delete';

            if (selectedTabs.size === 1) {
                editBtn.style.display = 'inline-block';
            }
        }
    }

    async function displayUserInfo(user) {
        if (user) {
            userInfoDiv.innerHTML = `
                <p>Hello ${user.name} [${user.username}]</p>
                <p>Your email: ${user.email}</p>
            `;
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
            const token = await tabService.getToken();
            if (!token) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        } catch (error) {
            window.location.href = 'login.html';
            return false;
        }
    }

    async function handleDelete() {
        try {
            const token = await tabService.getToken();
            if (!token) return;

            const urlsToDelete = Array.from(selectedTabs);
            for (const url of urlsToDelete) {
                await fetch('http://localhost:5000/delete_tab', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ url })
                });
            }

            selectedTabs.clear();
            updateActionButtons();
            await refreshTabs();

            const checkboxes = document.querySelectorAll('.custom-checkbox');
            checkboxes.forEach(checkbox => checkbox.classList.remove('checked'));
        } catch (error) {
            console.error('Error deleting tabs:', error);
        }
    }

    async function handleEdit() {
        if (selectedTabs.size !== 1 || isEditing) return;

        const url = Array.from(selectedTabs)[0];
        const titleCell = document.querySelector(`[data-url="${url}"]`);
        if (!titleCell) return;

        isEditing = true;
        const currentTitle = titleCell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editable-title';
        input.value = currentTitle;

        titleCell.textContent = '';
        titleCell.appendChild(input);

        input.focus();
        input.select();

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTitle = input.value.trim();
                if (newTitle && newTitle !== currentTitle) {
                    await updateTabTitle(url, newTitle);
                } else {
                    exitEditMode(titleCell, currentTitle);
                }
                selectedTabs.clear();
                updateActionButtons();
                const checkbox = titleCell.closest('tr').querySelector('.custom-checkbox');
                if (checkbox) checkbox.classList.remove('checked');
            }
        });

        input.addEventListener('blur', () => {
            exitEditMode(titleCell, currentTitle);
            selectedTabs.clear();
            updateActionButtons();
            const checkbox = titleCell.closest('tr').querySelector('.custom-checkbox');
            if (checkbox) checkbox.classList.remove('checked');
        });
    }

    function exitEditMode(cell, title) {
        isEditing = false;
        cell.textContent = title;
    }

    async function updateTabTitle(url, newTitle) {
        try {
            const token = await tabService.getToken();
            if (!token) return;

            const response = await fetch('http://localhost:5000/update_tab_title', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url, title: newTitle })
            });

            if (response.ok) {
                await refreshTabs();
            }
        } catch (error) {
            console.error('Error updating tab title:', error);
        }
    }

    async function refreshTabs() {
        const isLoggedIn = await checkLoginStatus();
        if (!isLoggedIn) return;

        try {
            const token = await tabService.getToken();
            if (!token) return;

            const userId = await tabService.getUserId();
            await fetchUserDetails(userId, token);

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

            if (Array.isArray(filteredTabs)) {
                filteredTabs.sort((a, b) => new Date(b.last_opened) - new Date(a.last_opened));
                renderTabs(filteredTabs);
            }
        } catch (error) {
            console.error('Error in refreshTabs:', error);
        }
    }

    function renderTabs(tabs) {
        if (!tabsTableBody) return;

        tabsTableBody.innerHTML = '';

        if (!tabs || tabs.length === 0) {
            const noDataRow = tabsTableBody.insertRow();
            const noDataCell = noDataRow.insertCell();
            noDataCell.colSpan = 7;
            noDataCell.textContent = 'No tabs found.';
            noDataCell.classList.add('text-center', 'text-gray-500', 'p-4');
            return;
        }

        tabs.forEach((tab, index) => {
            const row = tabsTableBody.insertRow();

            const checkboxCell = row.insertCell();
            const checkbox = document.createElement('div');
            checkbox.className = 'custom-checkbox';
            checkbox.addEventListener('click', () => handleCheckboxClick(tab.url, checkbox));
            checkboxCell.appendChild(checkbox);

            const indexCell = row.insertCell();
            indexCell.className = 'border p-2';
            indexCell.textContent = index + 1;

            const titleCell = row.insertCell();
            titleCell.className = 'border p-2 truncate max-w-xs';
            titleCell.textContent = formatPageTitle(tab.title, tab.url);
            titleCell.setAttribute('data-url', tab.url);

            const urlCell = row.insertCell();
            urlCell.className = 'border p-2 truncate max-w-xs';
            const urlLink = document.createElement('a');
            urlLink.href = tab.url;
            urlLink.className = 'text-blue-600 hover:underline';
            urlLink.textContent = tab.url;
            urlLink.addEventListener('click', async (event) => {
                event.preventDefault();
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
            urlCell.appendChild(urlLink);

            const browserCell = row.insertCell();
            browserCell.className = 'border p-2';
            browserCell.textContent = tab.browser || 'Unknown';

            const firstOpenedCell = row.insertCell();
            firstOpenedCell.className = 'border p-2';
            firstOpenedCell.textContent = formatDate(tab.first_opened);

            const lastOpenedCell = row.insertCell();
            lastOpenedCell.className = 'border p-2';
            lastOpenedCell.textContent = formatDate(tab.last_opened);
        });
    }

    async function findExistingTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                const matchingTab = tabs.find(tab => tab.url === url);
                resolve(matchingTab);
            });
        });
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    refreshButton.addEventListener('click', refreshTabs);

    searchBox.addEventListener('input', () => {
        const query = searchBox.value.toLowerCase();
        const rows = tabsTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const titleCell = row.cells[2];
            const urlCell = row.cells[3];
            if (!titleCell || !urlCell) return;

            const titleText = titleCell.textContent?.toLowerCase() || '';
            const urlText = urlCell.textContent?.toLowerCase() || '';

            const isVisible = titleText.includes(query) || urlText.includes(query);
            row.style.display = isVisible ? '' : 'none';
        });
    });

    editBtn.addEventListener('click', handleEdit);
    deleteBtn.addEventListener('click', handleDelete);

    logoutBtn.addEventListener('click', async () => {
        try {
            await tabService.clearToken();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    refreshTabs();
});