import { config, state } from './state.js';
import { showSkeletonLoading, parseNum } from './utils.js';
import { updateKPIs, populateDropdowns, doSort } from './tab-main.js';
import { renderWinLossData } from './tab-winloss.js';
import { processAndRenderTrend } from './tab-pricing.js';
import { renderOpsDashboard } from './tab-ops.js'; 

const baseUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json`;

export function fetchData() {
    document.getElementById('toggle-rows-btn').style.display = 'none';
    showSkeletonLoading();
    
    fetchMainData();
    fetchSecondaryData();
}

function fetchMainData() {
    const statusBadge = document.getElementById('live-status');
    const headerRefreshBtn = document.querySelector('.header-refresh-btn');

    statusBadge.innerHTML = '● SYNCING... <span id="last-sync-time">Menarik data...</span>';
    statusBadge.style.backgroundColor = '#F59E0B';
    if (headerRefreshBtn) headerRefreshBtn.classList.add('spinning');

    const noCacheUrl = `${baseUrl}&sheet=${encodeURIComponent(config.targetSheet)}&_=${new Date().getTime()}`;
    
    fetch(noCacheUrl).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47, data.length - 2));
        state.globalRawData = [];
        
        const getVal = (cells, idx) => {
            if (!cells || !cells[idx]) return '-';
            return cells[idx].v !== null ? cells[idx].v : '-';
        };

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
        statusBadge.innerHTML = '● SYNC FAILED';
        statusBadge.style.backgroundColor = '#EF4444';
        if (headerRefreshBtn) headerRefreshBtn.classList.remove('spinning');
    });
}

function fetchSecondaryData() {
    fetch(`${baseUrl}&sheet=${encodeURIComponent(config.alertSheet)}&_=${new Date().getTime()}`)
        .then(res => res.text())
        .then(data => {
            // PERBAIKAN: Parameter kedua diganti menjadi 'true' agar baris pertama (Header Excel) dilewati
            const arr = extractSheetData(data, true); 
            document.getElementById('alert-container').innerHTML = ''; 
            arr.forEach(row => {
                let keys = Object.keys(row);
                if (keys.length > 1 && row[keys[1]] && String(row[keys[1]]).trim() !== "") {
                    let tipe = row[keys[0]] || '🟡';
                    let judul = row[keys[1]];
                    let desc = row[keys[2]] || '';
                    document.getElementById('alert-container').innerHTML += `<div class="alert-card ${tipe.includes('🟡') ? 'warning' : ''}"><h3>${tipe} ${judul}</h3><p>${desc}</p></div>`;
                }
            });
        }).catch(e => console.error("Alerts error", e));

    fetch(`${baseUrl}&sheet=${encodeURIComponent(config.winLossSheet)}&_=${new Date().getTime()}`)
        .then(res => res.text())
        .then(data => {
            state.globalWinLossData = extractSheetData(data);
            renderWinLossData(state.globalWinLossData); 
        }).catch(e => console.error("WinLoss error", e));

    fetch(`${baseUrl}&sheet=${encodeURIComponent(config.trendSheet)}&_=${new Date().getTime()}`)
        .then(res => res.text())
        .then(data => {
            state.globalTrendData = extractSheetData(data);
            state.trendHeaders = Object.keys(state.globalTrendData[0] || {});
            processAndRenderTrend(); 
        }).catch(e => console.error("Trend error", e));

    fetchOpsData();
}

export function fetchOpsData() {
    fetch(`${baseUrl}&sheet=${encodeURIComponent(config.opsSheet)}&_=${new Date().getTime()}`)
        .then(res => res.text())
        .then(data => {
            state.globalOpsData = extractSheetDataByIndex(data);
            fetch(`${baseUrl}&sheet=${encodeURIComponent(config.dsrSheet)}&_=${new Date().getTime()}`)
                .then(res2 => res2.text())
                .then(data2 => {
                    state.globalDsrData = extractSheetDataByIndex(data2);
                    const segmenF = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value.toLowerCase().trim() : '';
                    renderOpsDashboard(segmenF);
                })
                .catch(err => {
                    console.error("DSR Error:", err);
                    state.globalDsrData = [];
                    const segmenF = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value.toLowerCase().trim() : '';
                    renderOpsDashboard(segmenF);
                });
        })
        .catch(err => {
            console.error("Ops Error:", err);
            state.globalOpsData = []; 
        });
}

function extractSheetData(data, useFirstRowAsHeader = true) {
    try {
        if(data.includes('"status":"error"')) return [];
        const json = JSON.parse(data.substring(47, data.length - 2));
        let headers = json.table.cols.map(c => c && c.label ? String(c.label).trim() : "");
        let startIndex = 0;
        
        if (useFirstRowAsHeader && (headers.join("").trim() === "" || headers.every(h => h.length <= 2))) { 
            headers = json.table.rows[0].c.map(c => (c && c.v !== null) ? String(c.f !== undefined ? c.f : c.v).trim() : ""); 
            startIndex = 1; 
        }
        
        let arr = [];
        for (let i = startIndex; i < json.table.rows.length; i++) {
            const row = json.table.rows[i];
            if (!row || !row.c) continue;
            let obj = {}; let hasValue = false;
            for(let j = 0; j < headers.length; j++) { 
                let key = headers[j] || `Col_${j}`; 
                let cell = row.c[j];
                let val = null;
                if (cell) {
                    if (typeof cell.v === 'number') val = cell.v;
                    else val = cell.f !== undefined ? cell.f : cell.v;
                }
                obj[key] = val;
                if (val !== null && String(val).trim() !== "") hasValue = true;
            }
            if (hasValue) arr.push(obj);
        }
        return arr;
    } catch (e) {
        console.error("Gagal parsing JSON:", e);
        return [];
    }
}

function extractSheetDataByIndex(data) {
    try {
        if(data.includes('"status":"error"')) return [];
        const json = JSON.parse(data.substring(47, data.length - 2));
        let arr = [];
        for (let i = 1; i < json.table.rows.length; i++) { 
            const row = json.table.rows[i];
            if (!row || !row.c) continue;
            let obj = {}; let hasValue = false;
            for(let j = 0; j < row.c.length; j++) { 
                let cell = row.c[j];
                let val = null;
                if (cell) {
                    if (typeof cell.v === 'number') val = cell.v;
                    else val = cell.f !== undefined ? cell.f : cell.v;
                }
                obj[j] = val; 
                if (val !== null && String(val).trim() !== "") hasValue = true;
            }
            if (hasValue) arr.push(obj);
        }
        return arr;
    } catch (e) {
        console.error("Gagal parsing JSON By Index:", e);
        return [];
    }
}
