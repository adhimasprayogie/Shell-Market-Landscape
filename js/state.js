export const config = {
    spreadsheetId: '1F9UeVxShXE7yNyWiyrJuKAHhZCR-WnCXSXPItte32Io',
    targetSheet: 'Data Input',
    alertSheet: 'Alerts',
    winLossSheet: 'WinLoss',
    trendSheet: 'TrendHarga'
};

export const state = {
    globalRawData: [],
    globalWinLossData: [],
    globalTrendData: [],
    trendHeaders: [],
    currentExportData: [],
    currentWLExportData: [],
    isShowingAll: false,
    currentSort: { column: 'volume', asc: false },
    chartInstances: {},
    wlChartInstances: { pie: null, bar: null }
};