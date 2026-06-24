import { state } from './state.js';
import { formatVolume, formatRupiah } from './utils.js';
import { renderPricingMatrix, processAndRenderTrend } from './tab-pricing.js';
import { renderWinLossData } from './tab-winloss.js';
import { renderOpsDashboard } from './tab-ops.js';

export function updateKPIs(dataArray = state.globalRawData) {
    let totalVol = 0; let kompCount = {}; let uniqueCustomers = new Set();

    dataArray.forEach(d => {
        totalVol += d.volume;
        let k = d.kompetitor.trim();
        if(k && k !== '-') { kompCount[k] = (kompCount[k] || 0) + 1; }
        if (d.customer && d.customer !== '-') { uniqueCustomers.add(d.customer.trim().toUpperCase()); }
    });
    
    document.getElementById('kpi-volume').innerText = formatVolume(totalVol) + " L";
    document.getElementById('kpi-accounts').innerText = uniqueCustomers.size;

    let topKomp = "-"; let maxCount = 0;
    for (let k in kompCount) { if(kompCount[k] > maxCount) { maxCount = kompCount[k]; topKomp = k; } }
    document.getElementById('kpi-competitor').innerText = topKomp;
}

export function populateDropdowns() {
    const provs = [...new Set(state.globalRawData.map(item => item.provinsi))].filter(x => x !== '-');
    const komps = [...new Set(state.globalRawData.map(item => item.kompetitor))].filter(x => x !== '-');
    
    const provSelect = document.getElementById('filter-prov');
    const kompSelect = document.getElementById('filter-komp');
    
    provSelect.innerHTML = '<option value="">Semua Provinsi</option>';
    kompSelect.innerHTML = '<option value="">Semua Kompetitor</option>';
    
    provs.forEach(p => provSelect.innerHTML += `<option value="${p}">${p}</option>`);
    komps.forEach(k => kompSelect.innerHTML += `<option value="${k}">${k}</option>`);
}

export function renderTable(filteredData = null) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    const dataToRender = filteredData || state.globalRawData;
    state.currentExportData = dataToRender; 
    
    const btn = document.getElementById('toggle-rows-btn');
    if (dataToRender.length > 5) { 
        btn.style.display = 'block'; 
        btn.innerHTML = state.isShowingAll ? 'Show Less' : 'Show All Data';
    } else { btn.style.display = 'none'; }

    const limit = state.isShowingAll ? dataToRender.length : Math.min(5, dataToRender.length);

    for (let i = 0; i < limit; i++) {
        const item = dataToRender[i];
        let gap = item.hargaKomp - item.hargaCPA;
        let gapClass = ""; let gapText = "-";
        
        if(item.hargaKomp > 0 && item.hargaCPA > 0) {
            if(gap > 0) { gapClass = "gap-positive"; gapText = `Shell lebih murah<br>${formatRupiah(gap)}`; }
            else if(gap < 0) { gapClass = "gap-negative"; gapText = `Shell lebih mahal<br>${formatRupiah(Math.abs(gap))}`; }
            else { gapText = "Harga Sama"; }
        }

        let safeIssue = String(item.issue || '-').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        let safeInfo = String(item.info || '-').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        let safeTop = String(item.top || '-').replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="hide-mobile"><strong>${item.provinsi}</strong></td>
            <td class="hide-mobile">${item.salesman}</td>
            <td class="wrap-text"><strong style="color:var(--cpa-dark);">${item.customer}</strong><br><span style="font-size:11px; color:var(--text-muted);">Sektor: ${item.sektor}</span></td>
            <td style="font-weight: bold; color: var(--cpa-blue); text-align: center; font-size:14px;">${formatVolume(item.volume)}</td>
            <td class="hide-mobile sku-text">${item.skuShell}<br><span style="color:var(--text-muted);">${item.pricingStr}</span></td>
            <td><strong>${formatRupiah(item.hargaCPA)}</strong></td>
            <td style="color:var(--shell-red); font-weight:bold;">${item.kompetitor}</td>
            <td class="hide-mobile sku-text">${item.skuKomp}<br><strong style="font-size:13px; color:var(--text-main); font-family:'Segoe UI',sans-serif;">${formatRupiah(item.hargaKomp)}</strong></td>
            <td class="${gapClass}" style="font-size:11.5px;">${gapText}</td>
            <td style="vertical-align: middle; text-align: center;">
                <button class="info-btn" onclick="showCustomModal('${safeIssue}', '${safeInfo}', '${safeTop}')">Detail</button>
            </td>
        `;
        tableBody.appendChild(tr);
    }
    renderCharts(dataToRender);
}

export function renderCharts(data) {
    if(state.chartInstances.pie) state.chartInstances.pie.destroy();
    if(state.chartInstances.bar) state.chartInstances.bar.destroy();
    if(typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

    let kompCount = {}; let provVol = {};
    data.forEach(d => { 
        if(d.kompetitor && d.kompetitor !== '-') kompCount[d.kompetitor] = (kompCount[d.kompetitor] || 0) + 1; 
        if(d.provinsi && d.provinsi !== '-') provVol[d.provinsi] = (provVol[d.provinsi] || 0) + d.volume; 
    });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    state.chartInstances.pie = new Chart(pieCtx, {
        type: 'doughnut', data: { labels: Object.keys(kompCount), datasets: [{ data: Object.values(kompCount), backgroundColor: ['#DD0000', '#1E40AF', '#FFD500', '#10B981', '#8B5CF6'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12, family: 'Segoe UI' } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 13 }, formatter: (value) => value > 0 ? value : '', textShadowColor: '#000', textShadowBlur: 3 } } }
    });

    const barCtx = document.getElementById('barChart').getContext('2d');
    state.chartInstances.bar = new Chart(barCtx, {
        type: 'bar', data: { labels: Object.keys(provVol), datasets: [{ label: 'Volume', data: Object.values(provVol), backgroundColor: '#1E40AF', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, scales: { y: { beginAtZero: true, grid: { borderDash: [4, 4] } }, x: { grid: { display: false } } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#1E3A8A', font: { weight: 'bold', size: 12 }, formatter: (value) => value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value) } } }
    });
    renderPricingMatrix(data);
}

export function sortTable(column) {
    if (state.currentSort.column === column) { state.currentSort.asc = !state.currentSort.asc; } 
    else { state.currentSort.column = column; state.currentSort.asc = true; }
    doSort(column, state.currentSort.asc);
}

export function doSort(col, isAsc) {
    state.globalRawData.sort((a, b) => {
        let valA = a[col]; let valB = b[col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });
    filterTable();
}

export function toggleRowsDisplay() {
    state.isShowingAll = !state.isShowingAll;
    renderTable(state.currentExportData); 
}

export function filterTable() {
    const query = document.getElementById('search-box').value.toLowerCase().trim();
    const provF = document.getElementById('filter-prov').value.toLowerCase().trim();
    const kompF = document.getElementById('filter-komp').value.toLowerCase().trim();
    
    // 1. Tangkap value dari dropdown segmen yang baru kita buat
    const segmenF = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value.toLowerCase().trim() : '';
    
    state.isShowingAll = false; 

    // JIKA TIDAK ADA FILTER SAMA SEKALI
    if (query === '' && provF === '' && kompF === '' && segmenF === '') {
        renderTable(); 
        updateKPIs(); 
        if (state.globalWinLossData.length > 0) renderWinLossData(state.globalWinLossData);
        processAndRenderTrend(); 
        
        // Render tabel operasional tanpa filter
        renderOpsDashboard(); 
        return;
    }

    // Filter Main Data (Data Input)
    const filteredMain = state.globalRawData.filter(item => {
        const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
        const matchQ = query === "" || safeStr(item.salesman).includes(query) || safeStr(item.provinsi).includes(query) || safeStr(item.customer).includes(query) || safeStr(item.sektor).includes(query) || safeStr(item.kompetitor).includes(query) || safeStr(item.skuShell).includes(query);
        const matchP = provF === "" || safeStr(item.provinsi) === provF;
        const matchK = kompF === "" || safeStr(item.kompetitor) === kompF;
        return matchQ && matchP && matchK;
    });
    
    renderTable(filteredMain); 
    updateKPIs(filteredMain); 

    // Filter Win/Loss Data
    if (state.globalWinLossData.length > 0) {
        const filteredWL = state.globalWinLossData.filter(item => {
            const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
            const matchQ = query === "" || safeStr(item['Nama Customer']).includes(query) || safeStr(item['Keterangan']).includes(query);
            const matchP = provF === "" || safeStr(item['Provinsi']) === provF;
            const matchK = kompF === "" || safeStr(item['Kompetitor']) === kompF;
            return matchQ && matchP && matchK;
        });
        renderWinLossData(filteredWL);
    }
    
    processAndRenderTrend(provF); 

    // 2. Render ulang Operational Dashboard khusus berdasarkan segmen yang dipilih
    renderOpsDashboard(segmenF); 
}
