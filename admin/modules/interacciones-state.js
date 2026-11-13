/** Estado compartido del módulo de interacciones. */

let cachedInteractions = [];
let filteredInteractions = [];
let currentPage = 0;
let pageSize = 20;
let daysWindow = 7;
let activeStatusFilter = "pending";
let autoRefreshTimer = null;
let badgePollTimer = null;
let isRefreshing = false;
let isBadgeRefreshing = false;
let lastLoadedAt = 0;
let pendingMutations = 0;
const expandedThreadIds = new Set();

export function getCachedInteractions() { return cachedInteractions; }
export function setCachedInteractions(list) { cachedInteractions = Array.isArray(list) ? list : []; }

export function getFilteredInteractions() { return filteredInteractions; }
export function setFilteredInteractions(list) { filteredInteractions = Array.isArray(list) ? list : []; }

export function getCurrentPage() { return currentPage; }
export function setCurrentPage(page) { currentPage = page; }

export function getPageSize() { return pageSize; }
export function setPageSize(size) { pageSize = size; }

export function getDaysWindow() { return daysWindow; }
export function setDaysWindow(days) { daysWindow = days; }

export function getActiveStatusFilter() { return activeStatusFilter; }
export function setActiveStatusFilter(filter) { activeStatusFilter = filter; }

export function getAutoRefreshTimer() { return autoRefreshTimer; }
export function setAutoRefreshTimer(timer) { autoRefreshTimer = timer; }

export function getBadgePollTimer() { return badgePollTimer; }
export function setBadgePollTimer(timer) { badgePollTimer = timer; }

export function getIsRefreshing() { return isRefreshing; }
export function setIsRefreshing(value) { isRefreshing = value; }

export function getIsBadgeRefreshing() { return isBadgeRefreshing; }
export function setIsBadgeRefreshing(value) { isBadgeRefreshing = value; }

export function getLastLoadedAt() { return lastLoadedAt; }
export function setLastLoadedAt(ts) { lastLoadedAt = ts; }

export function getPendingMutations() { return pendingMutations; }
export function setPendingMutations(n) { pendingMutations = n; }
export function bumpPendingMutations(delta) {
  pendingMutations = Math.max(0, pendingMutations + delta);
}

export function getExpandedThreadIds() { return expandedThreadIds; }
