import { state } from './state.js';
import { parseNum } from './utils.js';

export function renderPricingMatrix(data) {
    const canvas = document.getElementById('pricingBubbleChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if(state.chartInstances.bubble) state.chartInstances.bubble.destroy();

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
        let avgCPA = item.sumCPA / item.count; let avgKomp = item.sumKomp / item.count; let selisih = avgKomp - avgCPA; 
        if (!datasetsObj[item.komp]) { datasetsObj[item.komp] = { label: item.komp, backgroundColor: colorPalette[item.komp] || defaultColor, data: [] }; }
        datasetsObj[item.komp].data.push({ x: selisih, y: item.vol, r: Math.max(8, Math.sqrt(item.vol) / 15), _area: item.area, _avgCPA: avgCPA, _avgKomp: avgKomp });
    });

    state.chartInstances.bubble = new Chart(ctx, {
        type: 'bubble', data: { datasets: Object.values(datasetsObj) },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: '← Shell Lebih Mahal (Rp) | Selisih Harga | (Rp) Shell Lebih Murah →', font: {weight: 'bold'} }, grid: { color: (ctx) => ctx.tick.value === 0 ? '#1E293B' : '#E2E8F0', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1 } }, y: { title: { display: true, text: 'Total Volume (Liter)', font: {weight: 'bold'} }, beginAtZero: true } }, plugins: { legend: { position: 'top' }, datalabels: { display: false }, tooltip: { callbacks: { label: function(context) { const d = context.raw; return [ `Area: ${d._area} (Komp: ${context.dataset.label})`, `Volume: ${new Intl.NumberFormat('id-ID').format(d.y)} L`, `Avg Harga Shell: Rp ${new Intl.NumberFormat('id-ID').format(d._avgCPA)}`, `Avg Harga Komp: Rp ${new Intl.NumberFormat('id-ID').format(d._avgKomp)}`, `Selisih: Rp ${new Intl.NumberFormat('id-ID').format(d.x)}` ]; } } } } }
    });
}

export function processAndRenderTrend(provFilter = '') {
    if (state.globalTrendData.length === 0) return;

    let filteredData = state.globalTrendData;
    if (provFilter !== '') {
        filteredData = state.globalTrendData.filter(item => {
            let prov = String(item['Provinsi'] || '').toLowerCase().trim();
            return prov === provFilter.toLowerCase().trim();
        });
    }

    let monthMap = {};
    filteredData.forEach(row => {
        let bulan = row[state.trendHeaders[0]]; 
        if (!bulan) return;
        if (!monthMap[bulan]) {
            monthMap[bulan] = { count: 0, sums: {} };
            for (let j = 2; j < state.trendHeaders.length; j++) { monthMap[bulan].sums[state.trendHeaders[j]] = 0; }
        }
        monthMap[bulan].count++;
        for (let j = 2; j < state.trendHeaders.length; j++) { monthMap[bulan].sums[state.trendHeaders[j]] += parseNum(row[state.trendHeaders[j]]); }
    });

    let labels = Object.keys(monthMap);
    let datasetsObj = {};
    for (let j = 2; j < state.trendHeaders.length; j++) {
        let brand = state.trendHeaders[j];
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
    if(state.chartInstances.line) state.chartInstances.line.destroy();

    const colors = { 'Shell': '#FFD500', 'Pertamina': '#DD0000', 'Castrol': '#10B981', 'Sefas': '#F59E0B', 'Idemitsu': '#3B82F6' };
    const datasets = Object.keys(datasetsObj).map(brand => {
        return { label: brand, data: datasetsObj[brand], borderColor: colors[brand] || '#64748B', backgroundColor: colors[brand] || '#64748B', borderWidth: brand === 'Shell' ? 4 : 2, tension: 0.3, pointRadius: 4, pointHoverRadius: 7 };
    });

    state.chartInstances.line = new Chart(canvas.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } }, datalabels: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== null) { label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(context.parsed.y); } return label; } } } }, scales: { y: { title: { display: true, text: 'Harga Rata-Rata (Rp)', font: {weight: 'bold'} }, beginAtZero: false, grid: { borderDash: [4, 4] } }, x: { grid: { display: false } } } }
    });
}
