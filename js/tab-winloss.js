import { state } from './state.js';

export function renderWinLossData(dataArray) {
    state.currentWLExportData = dataArray; 
    const tbody = document.getElementById('winloss-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    let statusCounts = { win: 0, loss: 0, pending: 0 };
    let volumeStats = { win: 0, loss: 0, pending: 0 };
    let remarketingCount = 0; let remarketingVolume = 0;
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

        statusCounts[keyStatus]++; volumeStats[keyStatus] += vol;

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

    if(state.wlChartInstances.pie) state.wlChartInstances.pie.destroy();
    if(state.wlChartInstances.bar) state.wlChartInstances.bar.destroy();

    const pieCtx = document.getElementById('winLossPieChart');
    if (pieCtx) {
        state.wlChartInstances.pie = new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut', data: { labels: ['Won (Secured)', 'Lost (Churned)', 'Pending Opportunity'], datasets: [{ data: [volumeStats.win, volumeStats.loss, volumeStats.pending], backgroundColor: ['#10B981', '#EF4444', '#F59E0B'], borderWidth: 2, borderColor: '#ffffff' }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, datalabels: { color: '#FFFFFF', font: { weight: 'bold', size: 12 }, formatter: (value) => value === 0 ? '' : ((value / totalVolPipeline) * 100).toFixed(0) + '%' } } }
        });
    }

    const barCtx = document.getElementById('remarketingBarChart');
    if (barCtx) {
        let barLabels = Object.keys(remStatusBreakdown); let barData = Object.values(remStatusBreakdown);
        if(barLabels.length === 0) { barLabels = ["Belum ada data"]; barData = [0]; }
        state.wlChartInstances.bar = new Chart(barCtx.getContext('2d'), {
            type: 'bar', data: { labels: barLabels, datasets: [{ label: 'Jumlah Akun', data: barData, backgroundColor: '#3B82F6', borderRadius: 4 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: '#1E3A8A', font: { weight: 'bold', size: 12 } } }, scales: { x: { display: false }, y: { grid: { display: false } } } }
        });
    }
}
