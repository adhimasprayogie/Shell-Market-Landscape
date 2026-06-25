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
        // WinLoss memakai Header kembali
        let row = [ clean(item['Nama Customer']), clean(item['Provinsi']), clean(item['Status Pipeline'] || item['Status']), clean(item['Kompetitor']), clean(item['Volume (L)']), clean(item['Status Remarketing'] || item['Remarketing']), clean(item['Keterangan / Alasan'] || item['Keterangan']) ];
        csvContent += row.join(",") + "\n";
    });
    triggerDownload(csvContent, 'WinLoss_Tracker_CPA');
}

export function exportOpsToCSV() {
    const data = state.globalOpsData;
    if (!data || data.length === 0) { 
        alert("Tidak ada data operasional untuk diekspor."); 
        return; 
    }

    let csvContent = "Bulan,Provinsi,Segmen,DSR Name,Nama Customer,Sektor,Brand Produk,Tier Produk,No PO,No DO,No Invoice,Volume PO (L),Volume Delivered (L),Remarks\n";
    data.forEach(item => {
        let cols = Object.values(item);
        if(cols.length < 13) return; 
        
        const clean = (str) => `"${String(str || '-').replace(/"/g, '""')}"`;
        // Ops tetap pakai Index
        let row = [
            clean(cols[0]), clean(cols[1]), clean(cols[2]), clean(cols[3]), clean(cols[4]), 
            clean(cols[5]), clean(cols[6]), clean(cols[7]), clean(cols[8]), clean(cols[9]), 
            clean(cols[10]), clean(cols[11]), clean(cols[12]), clean(cols[13])
        ];
        csvContent += row.join(",") + "\n";
    });
    triggerDownload(csvContent, 'Operational_Tracker_CPA');
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
