import { config, state } from './state.js';
import { showSkeletonLoading, parseNum } from './utils.js';
import { updateKPIs, populateDropdowns, doSort } from './tab-main.js';
import { renderWinLossData } from './tab-winloss.js';
import { processAndRenderTrend } from './tab-pricing.js';
import { renderOpsDashboard } from './tab-ops.js'; // <-- Import statis agar tidak diblokir browser

const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.targetSheet)}`;
const alertUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.alertSheet)}`;
const winLossUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.winLossSheet)}`;
const trendUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.trendSheet)}`;
const opsUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.opsSheet)}`;
const dsrUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.dsrSheet)}`;

export function fetchData() {
    document.getElementById('toggle-rows-btn').style.display = 'none';
    showSkeletonLoading();
    
    fetchAlerts();
    fetchWinLossData();
    fetchTrendData();
    fetchOpsData(); // Tarik data operasional
    
    const statusBadge = document.getElementById('live-status');
    const headerRefreshBtn = document.querySelector('.header-refresh-btn');

    statusBadge.innerHTML = '● SYNCING... <span id="last-sync-time">Menarik data...</span>';
    statusBadge.style.backgroundColor = '#F59E0B';
    if (headerRefreshBtn) headerRefreshBtn.classList.add('spinning');

    const noCacheUrl = url + '&_=' + new Date().getTime();
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        state.globalRawData = [];
        const getVal = (cells, idx) => (cells[idx] && cells[idx].v !== null) ? cells[idx].v : '-';

        json.table.rows.forEach((row, index) => {
            if(index === 0) return; 
            const cells = row.c;
            if (!cells || !cells[0]) return;
            state.globalRawData.push({
                salesman: getVal(cells, 0), provinsi: getVal(cells, 1), customer: getVal(cells, 2),
                sektor: getVal(cells, 3), pricingStr: getVal(cells, 4), skuShell: getVal(cells, 5),
                hargaCPA: parseNum(getVal(cells, 6)), kompetitor: getVal(cells, 7), skuKomp: getVal(cells, 8),
                hargaKomp: parseNum(getVal(cells, 9)), top: getVal(cells, 10), volume: parseNum(getVal(cells, 11)),
                issue: getVal(cells, 12), info: getVal(cells, 13)          
            });
        });

        const now = new Date();
        const timeString = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WITA';
        statusBadge.innerHTML = `● LIVE & SYNCED <span id="last-sync-time">Update: ${timeString}</span>`;
        statusBadge.style.backgroundColor = '#10B981';
        if (headerRefreshBtn) headerRefreshBtn.classList.remove('spinning');

        populateDropdowns();
        updateKPIs(); 
        doSort('volume', false); 
    }).catch(err => {
        console.error('Error fetching Main Data:', err);
    });
}

function fetchAlerts() {
    const noCacheAlertUrl = alertUrl + '&_=' + new Date().getTime();
    fetch(noCacheAlertUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        document.getElementById('alert-container').innerHTML = ''; 
        json.table.rows.forEach((row, index) => {
            if(index === 0) return; 
            const cells = row.c;
            if (!cells || !cells[0]) return;
            const tipe = cells[0]?.v || '🟡';
            const judul = cells[1]?.v || 'Isu Baru';
            const deskripsi = cells[2]?.v || 'Detail isu belum tersedia.';
            const isWarning = tipe.includes('🟡') ? 'warning' : '';
            document.getElementById('alert-container').innerHTML += `<div class="alert-card ${isWarning}"><h3>${tipe} ${judul}</h3><p>${deskripsi}</p></div>`;
        });
    }).catch(err => console.error(err));
}

function fetchWinLossData() {
    const noCacheUrl = winLossUrl + '&_=' + new Date().getTime();
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        state.globalWinLossData = extractSheetData(data);
        renderWinLossData(state.globalWinLossData); 
    }).catch(err => console.error(err));
}

function fetchTrendData() {
    const noCacheUrl = trendUrl + '&_=' + new Date().getTime();
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        state.globalTrendData = extractSheetData(data);
        state.trendHeaders = Object.keys(state.globalTrendData[0] || {});
        processAndRenderTrend(); 
    }).catch(err => console.error(err));
}

export function fetchOpsData() {
    fetch(opsUrl + '&_=' + new Date().getTime()).then(res => res.text()).then(data => {
        if(data.includes('"status":"error"')) throw new Error("Tab OperationalTracker tidak ditemukan");
        state.globalOpsData = extractSheetData(data);
        fetchDsrData(); 
    }).catch(err => {
        console.error(err);
        state.globalOpsData = []; 
        fetchDsrData(); // Tetap jalan meskipun Ops error agar DSR bisa jalan
    });
}

function fetchDsrData() {
    fetch(dsrUrl + '&_=' + new Date().getTime()).then(res => res.text()).then(data => {
        if(data.includes('"status":"error"')) throw new Error("Tab TargetDSR tidak ditemukan");
        state.globalDsrData = extractSheetData(data);
        
        // Eksekusi render setelah KEDUA data sukses
        const segmenF = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value.toLowerCase().trim() : '';
        renderOpsDashboard(segmenF);
    }).catch(err => {
        console.error(err);
        state.globalDsrData = [];
        const segmenF = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value.toLowerCase().trim() : '';
        renderOpsDashboard(segmenF);
    });
}

// ==========================================
// FUNGSI EKSTRAK JSON SUPER KEBAl BANTING
// ==========================================
function extractSheetData(data) {
    try {
        const json = JSON.parse(data.substring(47, data.length - 2));
        let headers = json.table.cols.map(c => c && c.label ? String(c.label).trim() : "");
        let startIndex = 0;
        
        // Terkadang Google API melempar header ke dalam row[0], bukan label. Kode ini mengeceknya.
        if (headers.join("").trim() === "" || headers.every(h => h.length <= 2)) { 
            headers = json.table.rows[0].c.map(c => (c && c.v !== null) ? String(c.f !== undefined ? c.f : c.v).trim() : ""); 
            startIndex = 1; 
        }
        
        let arr = [];
        for (let i = startIndex; i < json.table.rows.length; i++) {
            const row = json.table.rows[i];
            if (!row || !row.c) continue;
            
            let isEmptyRow = true;
            let obj = {};
            for(let j = 0; j < headers.length; j++) { 
                if (headers[j]) {
                    let cell = row.c[j];
                    let val = cell ? (cell.f !== undefined ? cell.f : cell.v) : null;
                    obj[headers[j]] = val;
                    if (val !== null && String(val).trim() !== "") isEmptyRow = false;
                }
            }
            if (!isEmptyRow) arr.push(obj);
        }
        return arr;
    } catch (e) {
        console.error("Gagal parsing JSON Spreadsheet:", e);
        return [];
    }
}
