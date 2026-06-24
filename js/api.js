import { config, state } from './state.js';
import { showSkeletonLoading, parseNum } from './utils.js';
import { updateKPIs, populateDropdowns, doSort } from './tab-main.js';
import { renderWinLossData } from './tab-winloss.js';
import { processAndRenderTrend } from './tab-pricing.js';

const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.targetSheet)}`;
const alertUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.alertSheet)}`;
const winLossUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.winLossSheet)}`;
const trendUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(config.trendSheet)}`;

export function fetchData() {
    document.getElementById('toggle-rows-btn').style.display = 'none';
    showSkeletonLoading();
    fetchAlerts();
    fetchWinLossData();
    fetchTrendData();
    
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
        document.getElementById('table-body').innerHTML = '<tr><td colspan="10" style="text-align:center; color:#EF4444; padding:20px;">❌ Gagal sinkronisasi data.</td></tr>';
        statusBadge.innerHTML = '● SYNC FAILED <span id="last-sync-time">Cek koneksi internet</span>';
        statusBadge.style.backgroundColor = '#EF4444';
        if (headerRefreshBtn) headerRefreshBtn.classList.remove('spinning');
    });
}

function fetchAlerts() {
    const alertContainer = document.getElementById('alert-container');
    const noCacheAlertUrl = alertUrl + '&_=' + new Date().getTime();
    fetch(noCacheAlertUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        alertContainer.innerHTML = ''; 
        json.table.rows.forEach((row, index) => {
            if(index === 0) return; 
            const cells = row.c;
            if (!cells || !cells[0]) return;
            const tipe = cells[0]?.v || '🟡';
            const judul = cells[1]?.v || 'Isu Baru';
            const deskripsi = cells[2]?.v || 'Detail isu belum tersedia.';
            const isWarning = tipe.includes('🟡') ? 'warning' : '';
            alertContainer.innerHTML += `<div class="alert-card ${isWarning}"><h3>${tipe} ${judul}</h3><p>${deskripsi}</p></div>`;
        });
    }).catch(err => console.error(err));
}

function fetchWinLossData() {
    const noCacheUrl = winLossUrl + '&_=' + new Date().getTime();
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        const winLossArray = [];
        let headers = json.table.cols.map(c => c && c.label ? c.label.trim() : "");
        let startIndex = 0;
        if (headers.join("") === "") { headers = json.table.rows[0].c.map(c => c ? c.v.trim() : ""); startIndex = 1; }

        for (let i = startIndex; i < json.table.rows.length; i++) {
            const row = json.table.rows[i];
            if (!row || !row.c || !row.c[0]) continue;
            let rowObj = {};
            row.c.forEach((cell, colIndex) => {
                let headerName = headers[colIndex];
                if (headerName) { rowObj[headerName] = (cell && cell.f) ? cell.f : ((cell && cell.v !== null) ? cell.v : ""); }
            });
            winLossArray.push(rowObj);
        }
        state.globalWinLossData = winLossArray; 
        renderWinLossData(state.globalWinLossData); 
    }).catch(err => console.error(err));
}

function fetchTrendData() {
    const noCacheUrl = trendUrl + '&_=' + new Date().getTime();
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        let headers = json.table.cols.map(c => c && c.label ? c.label.trim() : "");
        let startIndex = 0;
        if (headers.join("") === "") { headers = json.table.rows[0].c.map(c => c ? c.v.trim() : ""); startIndex = 1; }
        
        state.trendHeaders = headers; 
        state.globalTrendData = [];

        for (let i = startIndex; i < json.table.rows.length; i++) {
            const row = json.table.rows[i];
            if (!row || !row.c || !row.c[0]) continue;
            let rowObj = {};
            for(let j = 0; j < headers.length; j++) { rowObj[headers[j]] = row.c[j] ? row.c[j].v : null; }
            state.globalTrendData.push(rowObj);
        }
        processAndRenderTrend(); 
    }).catch(err => console.error(err));
}