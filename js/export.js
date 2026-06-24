import { state } from './state.js';

export function exportToCSV() {
    const data = state.currentExportData || state.globalRawData;
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

export function exportWinLossToCSV() {
    const data = state.currentWLExportData || state.globalWinLossData;
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
