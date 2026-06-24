import { fetchData } from './api.js';
import { switchTab, showCustomModal, closeCustomModal, scrollToTop } from './utils.js';
import { sortTable, toggleRowsDisplay, filterTable } from './tab-main.js';
import { exportToCSV, exportWinLossToCSV } from './export.js';
import { renderOpsDashboard } from './tab-ops.js';

// MENGEKSPOS FUNGSI KE HTML (Karena ES6 Modules terisolasi secara default)
window.fetchData = fetchData;
window.switchTab = switchTab;
window.showCustomModal = showCustomModal;
window.closeCustomModal = closeCustomModal;
window.scrollToTop = scrollToTop;
window.sortTable = sortTable;
window.toggleRowsDisplay = toggleRowsDisplay;
window.filterTable = filterTable;
window.exportToCSV = exportToCSV;
window.exportWinLossToCSV = exportWinLossToCSV;

// Event Listeners Dasar
window.onclick = function(event) {
    const modal = document.getElementById('custom-modal');
    if (event.target === modal) { closeCustomModal(); }
};

window.onscroll = function() {
    const backToTopBtn = document.getElementById("backToTopBtn");
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) { 
        backToTopBtn.style.display = "flex"; 
    } else { 
        backToTopBtn.style.display = "none"; 
    }
};

// Tarik data secara otomatis saat web pertama kali dibuka
document.addEventListener('DOMContentLoaded', () => {
    fetchData(); 
});
