/* ==========================================================================
   MARKET LANDSCAPE DASHBOARD - PT CPA
   Main JavaScript File
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. GLOBAL VARIABLES & CONFIGURATION
   -------------------------------------------------------------------------- */
const spreadsheetId = '1F9UeVxShXE7yNyWiyrJuKAHhZCR-WnCXSXPItte32Io';

const targetSheet = 'Data Input'; 
const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetSheet)}`;

const alertSheet = 'Alerts';
const alertUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(alertSheet)}`;

const winLossSheet = 'WinLoss'; 
const winLossUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(winLossSheet)}`;

const trendSheet = 'TrendHarga'; 
const trendUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(trendSheet)}`;

// State Management
let globalRawData = [];
let globalWinLossData = [];
let globalTrendData = []; // Menyimpan data mentah Trend Harga
let trendHeaders = [];    // Menyimpan header kolom Trend Harga

let isShowingAll = false;
let currentSort = { column: 'volume', asc: false };

let chartInstances = {};
let wlChartInstances = { pie: null, bar: null };


/* --------------------------------------------------------------------------
   2. UTILITY FUNCTIONS (Helper)
   -------------------------------------------------------------------------- */
const parseNum = val => {
    if (!val || val === '-') return 0;
    let num = parseFloat(val.toString().replace(/[^0-9.-]+/g,""));
    return isNaN(num) ? 0 : num;
};

function formatRupiah(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatVolume(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(num);
}


/* --------------------------------------------------------------------------
   3. DATA FETCHING (Google Sheets API)
   -------------------------------------------------------------------------- */
function fetchData() {
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
    fetch(noCacheUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            globalRawData = [];
            const getVal = (cells, idx) => (cells[idx] && cells[idx].v !== null) ? cells[idx].v : '-';

            json.table.rows.forEach((row, index) => {
                if(index === 0) return; 
                const cells = row.c;
                if (!cells || !cells[0]) return;

                globalRawData.push({
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
        })
        .catch(error => {
            console.error('Error fetching Main Data:', error);
            document.getElementById('table-body').innerHTML = '<tr><td colspan="10" style="text-align:center; color:#EF4444; padding:20px;">❌ Gagal sinkronisasi data. Cek koneksi internet.</td></tr>';
            statusBadge.innerHTML = '● SYNC FAILED <span id="last-sync-time">Cek koneksi internet</span>';
            statusBadge.style.backgroundColor = '#EF4444';
            if (headerRefreshBtn) headerRefreshBtn.classList.remove('spinning');
        });
}

function fetchAlerts() {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = `
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
    `;

    const noCacheAlertUrl = alertUrl + '&_=' + new Date().getTime();
    fetch(noCacheAlertUrl)
        .then(res => res.text())
        .then(data => {
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
    fetch(noCacheUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            const winLossArray = [];
            
            let headers = json.table.cols.map(c => c && c.label ? c.label.trim() : "");
            let startIndex = 0;
            if (headers.join("") === "") {
                headers = json.table.rows[0].c.map(c => c ? c.v.trim() : "");
                startIndex = 1; 
            }

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
            globalWinLossData = winLossArray; 
            renderWinLossData(globalWinLossData); 
        }).catch(err => console.error(err));
}

function fetchTrendData() {
    const noCacheUrl = trendUrl + '&_=' + new Date().getTime();
    fetch(noCacheUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            let headers = json.table.cols.map(c => c && c.label ? c.label.trim() : "");
            let startIndex = 0;
            if (headers.join("") === "") {
                headers = json.table.rows[0].c.map(c => c ? c.v.trim() : "");
                startIndex = 1; 
            }
            trendHeaders = headers; 
            globalTrendData = [];

            for (let i = startIndex; i < json.table.rows.length; i++) {
                const row = json.table.rows[i];
                if (!row || !row.c || !row.c[0]) continue;
                let rowObj = {};
                for(let j = 0; j < headers.length; j++) {
                    rowObj[headers[j]] = row.c[j] ? row.c[j].v : null;
                }
                globalTrendData.push(rowObj);
            }
            processAndRenderTrend(); // Render awal
        }).catch(err => console.error(err));
}


/* --------------------------------------------------------------------------
   4. RENDER UI & CHARTS
   -------------------------------------------------------------------------- */
function updateKPIs(dataArray = globalRawData) {
    let totalVol = 0;
    let kompCount = {};
    let uniqueCustomers = new Set();

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

function populateDropdowns() {
    const provs = [...new Set(globalRawData.map(item => item.provinsi))].filter(x => x !== '-');
    const komps = [...new Set(globalRawData.map(item => item.kompetitor))].filter(x => x !== '-');
    
    const provSelect = document.getElementById('filter-prov');
    const kompSelect = document.getElementById('filter-komp');
    
    provSelect.innerHTML = '<option value="">Semua Provinsi</option>';
    kompSelect.innerHTML = '<option value="">Semua Kompetitor</option>';
    
    provs.forEach(p => provSelect.innerHTML += `<option value="${p}">${p}</option>`);
    komps.forEach(k => kompSelect.innerHTML += `<option value="${k}">${k}</option>`);
}

function renderTable(filteredData = null) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    const dataToRender = filteredData || globalRawData;

    window.currentExportData = dataToRender; // Simpan untuk Export CSV
    
    const btn = document.getElementById('toggle-rows-btn');
    
    // --- PERBAIKAN 1: Logika Limit 5 Baris yang Sempurna ---
    if (dataToRender.length > 5) { 
        btn.style.display = 'block'; 
        btn.innerHTML = isShowingAll ? 'Show Less' : 'Show All Data';
    } else { 
        btn.style.display = 'none'; 
    }

    const limit = isShowingAll ? dataToRender.length : Math.min(5, dataToRender.length);
    // --------------------------------------------------------

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

function renderCharts(data) {
    if(chartInstances.pie) chartInstances.pie.destroy();
    if(chartInstances.bar) chartInstances.bar.destroy();
    if(typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

    let kompCount = {};
    data.forEach(d => { if(d.kompetitor && d.kompetitor !== '-') kompCount[d.kompetitor] = (kompCount[d.kompetitor] || 0) + 1; });
    
    let provVol = {};
    data.forEach(d => { if(d.provinsi && d.provinsi !== '-') provVol[d.provinsi] = (provVol[d.provinsi] || 0) + d.volume; });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    chartInstances.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(kompCount),
            datasets: [{ data: Object.values(kompCount), backgroundColor: ['#DD0000', '#1E40AF', '#FFD500', '#10B981', '#8B5CF6'], borderWidth: 0 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12, family: 'Segoe UI' } } },
                datalabels: { color: '#ffffff', font: { weight: 'bold', size: 13 }, formatter: (value) => { return value > 0 ? value : ''; }, textShadowColor: '#000', textShadowBlur: 3 }
            } 
        }
    });

    const barCtx = document.getElementById('barChart').getContext('2d');
    chartInstances.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(provVol),
            datasets: [{ label: 'Volume', data: Object.values(provVol), backgroundColor: '#1E40AF', borderRadius: 6 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, 
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [4, 4] } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }, 
                datalabels: { anchor: 'end', align: 'top', color: '#1E3A8A', font: { weight: 'bold', size: 12 }, formatter: (value) => { return value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value); } }
            }
        }
    });
    renderPricingMatrix(data);
}

function renderWinLossData(dataArray) {
    window.currentWLExportData = dataArray; 

    const tbody = document.getElementById('winloss-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    let statusCounts = { win: 0, loss: 0, pending: 0 };
    let volumeStats = { win: 0, loss: 0, pending: 0 };
    let remarketingCount = 0;
    let remarketingVolume = 0;
    let remStatusBreakdown = {};

    dataArray.forEach(row => {
        let customerName = row['Nama Customer'] || '-';
        let rawStatus = String(row['Status'] || 'Pending').toLowerCase().trim();
        let kompetitorName = row['Kompetitor'] || '-';
        let remText = String(row['Remarketing'] || 'No').trim();
        let keterangan = row['Keterangan'] || '-';

        let rawVolStr = String(row['Volume (L)'] || '0');
        let cleanVolStr = rawVolStr.split(',')[0].replace(/\./g, '');
        let vol = Number(cleanVolStr.replace(/[^0-9]/g, '')) || 0;

        let badgeClass = "pipeline"; let keyStatus = "pending"; let displayStatus = "PENDING OPPORTUNITY";
        if (rawStatus.includes('win')) { badgeClass = "gap-positive"; keyStatus = "win"; displayStatus = "WON (SECURED)"; } 
        else if (rawStatus.includes('loss')) { badgeClass = "gap-negative"; keyStatus = "loss"; displayStatus = "LOST (CHURNED)"; }

        statusCounts[keyStatus]++;
        volumeStats[keyStatus] += vol;

        let remStyle = "color: #64748B; font-weight: 500;";
        let uppercaseRem = remText.toUpperCase();

        if (uppercaseRem !== 'NO' && uppercaseRem !== '-' && uppercaseRem !== '') {
            remarketingCount++; remarketingVolume += vol;
            remStatusBreakdown[remText] = (remStatusBreakdown[remText] || 0) + 1;
            
            if (keyStatus !== 'win') displayStatus += " 🔄"; 
            if (uppercaseRem.includes('IN PROGRESS')) remStyle = "color: #3B82F6; font-weight: 700;"; 
            if (uppercaseRem.includes('SCHEDULED')) remStyle = "color: #F59E0B; font-weight: 700;"; 
            if (uppercaseRem.includes('WON-BACK')) remStyle = "color: #10B981; font-weight: 700; background-color: #E6F4EA; padding: 2px 6px; border-radius: 4px;"; 
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="wrap-text"><strong style="color:var(--cpa-dark);">${customerName}</strong></td>
            <td><span class="badge ${badgeClass}" style="font-size:11px;">${displayStatus}</span></td>
            <td style="color:#DC2626; font-weight:600;">${kompetitorName}</td>
            <td style="font-weight:700; color:var(--cpa-blue);">${new Intl.NumberFormat('id-ID').format(vol)}</td>
            <td><span style="${remStyle}">${remText}</span></td>
            <td class="wrap-text" style="color:var(--text-muted); font-size:12.5px;">${keterangan}</td>
        `;
        tbody.appendChild(tr);
    });

    let totalVolPipeline = volumeStats.win + volumeStats.loss + volumeStats.pending;
    let totalAccCount = statusCounts.win + statusCounts.loss + statusCounts.pending;
    let winRatePct = totalVolPipeline > 0 ? Math.round((volumeStats.win / totalVolPipeline) * 100) : 0;
    let lossRatePct = totalVolPipeline > 0 ? Math.round((volumeStats.loss / totalVolPipeline) * 100) : 0;

    if(document.getElementById('wl-total-pipeline')) document.getElementById('wl-total-pipeline').textContent = new Intl.NumberFormat('id-ID').format(totalVolPipeline) + ' L';
    if(document.getElementById('wl-total-accounts')) document.getElementById('wl-total-accounts').textContent = `${totalAccCount} Akun Terdata`;
    if(document.getElementById('wl-winrate')) document.getElementById('wl-winrate').textContent = winRatePct + '%';
    if(document.getElementById('wl-secured-vol')) document.getElementById('wl-secured-vol').textContent = new Intl.NumberFormat('id-ID').format(volumeStats.win) + ' L Secured';
    if(document.getElementById('wl-lossrate')) document.getElementById('wl-lossrate').textContent = lossRatePct + '%';
    if(document.getElementById('wl-lost-vol')) document.getElementById('wl-lost-vol').textContent = new Intl.NumberFormat('id-ID').format(volumeStats.loss) + ' L Churned';
    if(document.getElementById('wl-remarketing-vol')) document.getElementById('wl-remarketing-vol').textContent = new Intl.NumberFormat('id-ID').format(remarketingVolume) + ' L';
    if(document.getElementById('wl-remarketing-count')) document.getElementById('wl-remarketing-count').textContent = `${remarketingCount} Target Recovery`;

    if(wlChartInstances.pie) wlChartInstances.pie.destroy();
    if(wlChartInstances.bar) wlChartInstances.bar.destroy();

    const pieCtx = document.getElementById('winLossPieChart');
    if (pieCtx) {
        wlChartInstances.pie = new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Won (Secured)', 'Lost (Churned)', 'Pending Opportunity'],
                datasets: [{
                    data: [volumeStats.win, volumeStats.loss, volumeStats.pending],
                    backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
                    borderWidth: 2, borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                    datalabels: {
                        color: '#FFFFFF', font: { weight: 'bold', size: 12 }, textShadowColor: '#000', textShadowBlur: 4,
                        formatter: (value) => {
                            if (value === 0) return '';
                            return ((value / totalVolPipeline) * 100).toFixed(0) + '%';
                        }
                    }
                }
            }
        });
    }

    const barCtx = document.getElementById('remarketingBarChart');
    if (barCtx) {
        let barLabels = Object.keys(remStatusBreakdown);
        let barData = Object.values(remStatusBreakdown);
        if(barLabels.length === 0) { barLabels = ["Belum ada data"]; barData = [0]; }

        wlChartInstances.bar = new Chart(barCtx.getContext('2d'), {
            type: 'bar',
            data: { labels: barLabels, datasets: [{ label: 'Jumlah Akun', data: barData, backgroundColor: '#3B82F6', borderRadius: 4 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#1E3A8A', font: { weight: 'bold', size: 12 } } },
                scales: { x: { display: false }, y: { grid: { display: false } } }
            }
        });
    }
}

function renderPricingMatrix(data) {
    const canvas = document.getElementById('pricingBubbleChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if(chartInstances.bubble) chartInstances.bubble.destroy();

    const summary = data.reduce((acc, d) => {
        if (d.hargaCPA > 0 && d.hargaKomp > 0 && d.kompetitor && d.kompetitor !== '-') {
            let key = `${d.provinsi}_${d.kompetitor}`;
            if (!acc[key]) { acc[key] = { area: d.provinsi, komp: d.kompetitor, vol: 0, sumCPA: 0, sumKomp: 0, count: 0 }; }
            acc[key].vol += d.volume; acc[key].sumCPA += d.hargaCPA; acc[key].sumKomp += d.hargaKomp; acc[key].count++;
        }
        return acc;
    }, {});

    const colorPalette = { 'Pertamina': 'rgba(239, 68, 68, 0.7)', 'Castrol': 'rgba(16, 185, 129, 0.7)', 'Sefas': 'rgba(245, 158, 11, 0.7)', 'Idemitsu': 'rgba(59, 130, 246, 0.7)' };
    const defaultColor = 'rgba(100, 116, 139, 0.7)'; 

    let datasetsObj = {};
    Object.values(summary).forEach(item => {
        let avgCPA = item.sumCPA / item.count;
        let avgKomp = item.sumKomp / item.count;
        let selisih = avgKomp - avgCPA; 

        if (!datasetsObj[item.komp]) { datasetsObj[item.komp] = { label: item.komp, backgroundColor: colorPalette[item.komp] || defaultColor, data: [] }; }
        datasetsObj[item.komp].data.push({
            x: selisih, y: item.vol, r: Math.max(8, Math.sqrt(item.vol) / 15), 
            _area: item.area, _avgCPA: avgCPA, _avgKomp: avgKomp
        });
    });

    chartInstances.bubble = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: Object.values(datasetsObj) },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: '← Shell Lebih Mahal (Rp) | Selisih Harga | (Rp) Shell Lebih Murah →', font: {weight: 'bold'} }, grid: { color: (ctx) => ctx.tick.value === 0 ? '#1E293B' : '#E2E8F0', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1 } },
                y: { title: { display: true, text: 'Total Volume (Liter)', font: {weight: 'bold'} }, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' }, datalabels: { display: false }, 
                tooltip: { callbacks: { label: function(context) { const d = context.raw; return [ `Area: ${d._area} (Komp: ${context.dataset.label})`, `Volume: ${new Intl.NumberFormat('id-ID').format(d.y)} L`, `Avg Harga Shell: Rp ${new Intl.NumberFormat('id-ID').format(d._avgCPA)}`, `Avg Harga Komp: Rp ${new Intl.NumberFormat('id-ID').format(d._avgKomp)}`, `Selisih: Rp ${new Intl.NumberFormat('id-ID').format(d.x)}` ]; } } }
            }
        }
    });
}

// --- PERBAIKAN 2: FUNGSI TREND FILTERING ---
function processAndRenderTrend(provFilter = '') {
    if (globalTrendData.length === 0) return;

    // Filter by Area
    let filteredData = globalTrendData;
    if (provFilter !== '') {
        filteredData = globalTrendData.filter(item => {
            let prov = String(item['Provinsi'] || '').toLowerCase().trim();
            return prov === provFilter.toLowerCase().trim();
        });
    }

    // Kalkulasi rata-rata per bulan
    let monthMap = {};
    filteredData.forEach(row => {
        let bulan = row[trendHeaders[0]]; 
        if (!bulan) return;

        if (!monthMap[bulan]) {
            monthMap[bulan] = { count: 0, sums: {} };
            for (let j = 2; j < trendHeaders.length; j++) { monthMap[bulan].sums[trendHeaders[j]] = 0; }
        }
        
        monthMap[bulan].count++;
        for (let j = 2; j < trendHeaders.length; j++) {
            let brand = trendHeaders[j];
            monthMap[bulan].sums[brand] += parseNum(row[brand]);
        }
    });

    let labels = Object.keys(monthMap);
    let datasetsObj = {};
    for (let j = 2; j < trendHeaders.length; j++) {
        let brand = trendHeaders[j];
        datasetsObj[brand] = [];
        labels.forEach(bulan => {
            let avg = monthMap[bulan].count > 0 ? (monthMap[bulan].sums[brand] / monthMap[bulan].count) : null;
            datasetsObj[brand].push(avg);
        });
    }

    renderTrendChart(labels, datasetsObj);
}

function renderTrendChart(labels, datasetsObj) {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;
    if(chartInstances.line) chartInstances.line.destroy();

    const colors = { 'Shell': '#FFD500', 'Pertamina': '#DD0000', 'Castrol': '#10B981', 'Sefas': '#F59E0B', 'Idemitsu': '#3B82F6' };

    const datasets = Object.keys(datasetsObj).map(brand => {
        return {
            label: brand, data: datasetsObj[brand],
            borderColor: colors[brand] || '#64748B', backgroundColor: colors[brand] || '#64748B',
            borderWidth: brand === 'Shell' ? 4 : 2, 
            tension: 0.3, pointRadius: 4, pointHoverRadius: 7
        };
    });

    chartInstances.line = new Chart(canvas.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, 
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } }, datalabels: { display: false }, 
                tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) { label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(context.parsed.y); } return label; } } }
            },
            scales: { y: { title: { display: true, text: 'Harga Rata-Rata (Rp)', font: {weight: 'bold'} }, beginAtZero: false, grid: { borderDash: [4, 4] } }, x: { grid: { display: false } } }
        }
    });
}

function showSkeletonLoading() {
    // ... skeleton loader UI ... (Diringkas di kode blok agar tidak terlalu panjang)
    document.getElementById('kpi-volume').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-accounts').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-competitor').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    for(let i = 0; i < 5; i++) {
        tableBody.innerHTML += `<tr><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div></td><td><div class="skeleton skeleton-text" style="width: 100%;"></div><div class="skeleton skeleton-text" style="width: 60%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 70%; margin: 0 auto;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div><div class="skeleton skeleton-text" style="width: 50%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div><div class="skeleton skeleton-text" style="width: 70%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 100%;"></div></td><td><div class="skeleton skeleton-btn"></div></td></tr>`;
    }
}


/* --------------------------------------------------------------------------
   5. INTERACTION & LOGIC (Filter, Sort, Tabs)
   -------------------------------------------------------------------------- */
function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

function sortTable(column) {
    if (currentSort.column === column) { currentSort.asc = !currentSort.asc; } 
    else { currentSort.column = column; currentSort.asc = true; }
    doSort(column, currentSort.asc);
}

function doSort(col, isAsc) {
    globalRawData.sort((a, b) => {
        let valA = a[col]; let valB = b[col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });
    filterTable();
}

function toggleRowsDisplay() {
    isShowingAll = !isShowingAll;
    renderTable(window.currentExportData); // Menggunakan data yang sedang aktif difilter
}

function filterTable() {
    const query = document.getElementById('search-box').value.toLowerCase().trim();
    const provF = document.getElementById('filter-prov').value.toLowerCase().trim();
    const kompF = document.getElementById('filter-komp').value.toLowerCase().trim();

    isShowingAll = false; // Reset tombol show more ke 5 baris saat ada filter baru

    if (query === '' && provF === '' && kompF === '') {
        renderTable();
        updateKPIs(); 
        if (globalWinLossData.length > 0) renderWinLossData(globalWinLossData);
        processAndRenderTrend(); // Reset trend chart
        return;
    }

    const filteredMain = globalRawData.filter(item => {
        const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
        const matchQ = query === "" || safeStr(item.salesman).includes(query) || safeStr(item.provinsi).includes(query) || safeStr(item.customer).includes(query) || safeStr(item.sektor).includes(query) || safeStr(item.kompetitor).includes(query) || safeStr(item.skuShell).includes(query);
        const matchP = provF === "" || safeStr(item.provinsi) === provF;
        const matchK = kompF === "" || safeStr(item.kompetitor) === kompF;
        return matchQ && matchP && matchK;
    });
    
    renderTable(filteredMain);
    updateKPIs(filteredMain); 

    if (globalWinLossData.length > 0) {
        const filteredWL = globalWinLossData.filter(item => {
            const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
            const matchQ = query === "" || safeStr(item['Nama Customer']).includes(query) || safeStr(item['Keterangan']).includes(query);
            const matchP = provF === "" || safeStr(item['Provinsi']) === provF;
            const matchK = kompF === "" || safeStr(item['Kompetitor']) === kompF;
            return matchQ && matchP && matchK;
        });
        renderWinLossData(filteredWL);
    }

    processAndRenderTrend(provF); // Update trend chart berdasarkan area
}

function showCustomModal(issue, info, top) {
    document.getElementById('modal-issue').textContent = issue || '-';
    document.getElementById('modal-info').textContent = info || '-';
    document.getElementById('modal-top').textContent = top || '-';
    document.getElementById('custom-modal').classList.add('show');
}

function closeCustomModal() { document.getElementById('custom-modal').classList.remove('show'); }
window.onclick = function(event) { const modal = document.getElementById('custom-modal'); if (event.target === modal) { closeCustomModal(); } };

window.onscroll = function() {
    const backToTopBtn = document.getElementById("backToTopBtn");
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) { backToTopBtn.style.display = "flex"; } 
    else { backToTopBtn.style.display = "none"; }
};

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }


/* --------------------------------------------------------------------------
   6. EXPORT UTILITIES (CSV)
   -------------------------------------------------------------------------- */
function exportToCSV() {
    const data = window.currentExportData || globalRawData;
    if (data.length === 0) { alert("Tidak ada data untuk diekspor."); return; }

    let csvContent = "Provinsi,Salesman,Customer / Akun,Sektor,Volume (L),Produk Shell,Harga Shell,Kompetitor,Produk Komp,Harga Komp,Selisih Harga,Issue Lapangan,Info Update,Terms of Payment (TOP)\n";

    data.forEach(item => {
        const clean = (str) => `"${String(str || '-').replace(/"/g, '""')}"`;
        let selisih = item.hargaKomp - item.hargaCPA;
        let row = [ clean(item.provinsi), clean(item.salesman), clean(item.customer), clean(item.sektor), item.volume, clean(item.skuShell), item.hargaCPA, clean(item.kompetitor), clean(item.skuKomp), item.hargaKomp, selisih, clean(item.issue), clean(item.info), clean(item.top) ];
        csvContent += row.join(",") + "\n";
    });

    triggerDownload(csvContent, 'Market_Landscape_CPA');
}

function exportWinLossToCSV() {
    const data = window.currentWLExportData || globalWinLossData;
    if (data.length === 0) { alert("Tidak ada data Win/Loss untuk diekspor."); return; }

    let csvContent = "Nama Customer,Provinsi,Status Pipeline,Kompetitor,Volume (L),Status Remarketing,Keterangan\n";

    data.forEach(item => {
        const clean = (str) => `"${String(str || '-').replace(/"/g, '""')}"`;
        let row = [ clean(item['Nama Customer']), clean(item['Provinsi']), clean(item['Status']), clean(item['Kompetitor']), clean(item['Volume (L)']), clean(item['Remarketing']), clean(item['Keterangan']) ];
        csvContent += row.join(",") + "\n";
    });

    triggerDownload(csvContent, 'WinLoss_Tracker_CPA');
}

function triggerDownload(csvContent, prefixName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `${prefixName}_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* --------------------------------------------------------------------------
   7. INITIALIZATION
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    fetchData(); 
});
