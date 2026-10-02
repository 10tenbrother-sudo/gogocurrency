/**
 * Flow Monitor TradingView Pine Script v6
 * Optimized strictly for 15 Top Prime Assets:
 * - 5 Top Indeks Ekuitas Global (US500, NAS100, US30, GER40, JP225)
 * - 5 Top Crypto (BTC, ETH, SOL, BNB, XRP)
 * - 5 Top Komoditas & Energi (GOLD, SILVER, USOIL, UKOIL, NATGAS)
 * Single unified alert payload, zero NaN errors, 100% compliant with TradingView limits.
 */

export const FLOW_MONITOR_PINE_SCRIPT = `//@version=6
// ══════════════════════════════════════════════════════════════════════════════
// Indicator: Arah Market & Flow Monitor — 15 Prime Assets (Indeks, Crypto, Komoditas)
// Author: Flow Monitor System
// Architecture: Single Unified Webhook Payload (Top 5 Indeks, 5 Crypto, 5 Komoditas)
// Guaranteed Safe: Exactly 15 request.security calls (jauh di bawah batas TV 40)
// Anti-Error: Zero NaN sanitization, 1 single alert() call per candle close
// ══════════════════════════════════════════════════════════════════════════════

indicator("Arah Market & Flow Monitor — 15 Prime Assets (Indeks, Crypto, Komoditas)", shorttitle="FlowMonitor 15 Prime", overlay = false, max_bars_back = 500)

// ── 1. INPUT PENGATURAN TICKER (Fleksibel jika ingin ganti broker/feed) ──
grp_idx = "── 5 Indeks Teratas ──"
sym_spx = input.symbol("OANDA:SPX500USD", "1. US500 (S&P 500)", group = grp_idx)
sym_nsx = input.symbol("OANDA:NAS100USD", "2. NAS100 (Nasdaq 100)", group = grp_idx)
sym_dji = input.symbol("OANDA:US30USD",   "3. US30 (Dow Jones)", group = grp_idx)
sym_dax = input.symbol("OANDA:DE40EUR",   "4. GER40 (DAX 40)", group = grp_idx)
sym_nik = input.symbol("OANDA:JP225USD",  "5. JP225 (Nikkei 225)", group = grp_idx)

grp_cry = "── 5 Crypto Teratas ──"
sym_btc = input.symbol("BINANCE:BTCUSDT", "1. Bitcoin (BTC)", group = grp_cry)
sym_eth = input.symbol("BINANCE:ETHUSDT", "2. Ethereum (ETH)", group = grp_cry)
sym_sol = input.symbol("BINANCE:SOLUSDT", "3. Solana (SOL)", group = grp_cry)
sym_bnb = input.symbol("BINANCE:BNBUSDT", "4. BNB Chain (BNB)", group = grp_cry)
sym_xrp = input.symbol("BINANCE:XRPUSDT", "5. Ripple (XRP)", group = grp_cry)

grp_cmd = "── 5 Komoditas Teratas ──"
sym_xau = input.symbol("OANDA:XAUUSD", "1. Emas (GOLD)", group = grp_cmd)
sym_xag = input.symbol("OANDA:XAGUSD", "2. Perak (SILVER)", group = grp_cmd)
sym_oil = input.symbol("TVC:USOIL",    "3. Minyak WTI (USOIL)", group = grp_cmd)
sym_bco = input.symbol("TVC:UKOIL",    "4. Minyak Brent (UKOIL)", group = grp_cmd)
sym_gas = input.symbol("TVC:NATGAS",   "5. Gas Alam (NATGAS)", group = grp_cmd)

grp_cfg = "── Pengaturan Alert & Tampilan ──"
trigger_mode = input.string("Once Per Bar Close", "Frekuensi Webhook", options = ["Once Per Bar Close", "Realtime / Every Tick"], group = grp_cfg)
show_hud     = input.bool(true, "Tampilkan Tabel HUD On-Chart", group = grp_cfg)

// ── 2. FUNGSI EKSTRAKSI DATA (AMAN DARI NaN) ──
f_data(sym) =>
    [c, c1] = request.security(sym, timeframe.period, [close, close[1]], barmerge.gaps_off, barmerge.lookahead_off)
    safeC = na(c) ? 0.0 : c
    safeC1 = na(c1) ? 0.0 : c1
    chg = safeC1 > 0 and safeC > 0 ? math.round(((safeC - safeC1) / safeC1) * 10000) / 100 : 0.0
    dir = chg >= 0 ? "LONG" : "SHORT"
    [safeC, chg, dir]

f_item(pair, price, chg, dir) =>
    '{"pair":"' + pair + '","pct":' + str.tostring(chg, "#.##") + ',"price":' + str.tostring(price, "#.####") + ',"dir":"' + dir + '"}'

// ── 3. FETCH DATA (PERSIS 15 CALLS) ──
// Indeks (5)
[spxP, spxChg, spxDir] = f_data(sym_spx)
[nsxP, nsxChg, nsxDir] = f_data(sym_nsx)
[djiP, djiChg, djiDir] = f_data(sym_dji)
[daxP, daxChg, daxDir] = f_data(sym_dax)
[nikP, nikChg, nikDir] = f_data(sym_nik)

// Crypto (5)
[btcP, btcChg, btcDir] = f_data(sym_btc)
[ethP, ethChg, ethDir] = f_data(sym_eth)
[solP, solChg, solDir] = f_data(sym_sol)
[bnbP, bnbChg, bnbDir] = f_data(sym_bnb)
[xrpP, xrpChg, xrpDir] = f_data(sym_xrp)

// Komoditas (5)
[xauP, xauChg, xauDir] = f_data(sym_xau)
[xagP, xagChg, xagDir] = f_data(sym_xag)
[oilP, oilChg, oilDir] = f_data(sym_oil)
[bcoP, bcoChg, bcoDir] = f_data(sym_bco)
[gasP, gasChg, gasDir] = f_data(sym_gas)

// ── 4. BANGUN PAYLOAD TUNGGAL (SATU KALI ALERT PER CANDLE) ──
indeksJson = '[' +
     f_item("US500",  spxP, spxChg, spxDir) + ',' +
     f_item("NAS100", nsxP, nsxChg, nsxDir) + ',' +
     f_item("US30",   djiP, djiChg, djiDir) + ',' +
     f_item("GER40",  daxP, daxChg, daxDir) + ',' +
     f_item("JP225",  nikP, nikChg, nikDir) + ']'

cryptoJson = '[' +
     f_item("BTC", btcP, btcChg, btcDir) + ',' +
     f_item("ETH", ethP, ethChg, ethDir) + ',' +
     f_item("SOL", solP, solChg, solDir) + ',' +
     f_item("BNB", bnbP, bnbChg, bnbDir) + ',' +
     f_item("XRP", xrpP, xrpChg, xrpDir) + ']'

metalsJson = '[' +
     f_item("GOLD",   xauP, xauChg, xauDir) + ',' +
     f_item("SILVER", xagP, xagChg, xagDir) + ',' +
     f_item("USOIL",  oilP, oilChg, oilDir) + ',' +
     f_item("UKOIL",  bcoP, bcoChg, bcoDir) + ',' +
     f_item("NATGAS", gasP, gasChg, gasDir) + ']'

timeStr = str.format_time(time, "yyyy-MM-dd HH:mm:ss", "UTC")
unifiedPayload = '{"time":"' + timeStr + '","tf":"' + timeframe.period + '","source":"tv_pinescript_15","inst":' + indeksJson + ',"crypto":' + cryptoJson + ',"metals":' + metalsJson + '}'

// ── 5. PENGIRIMAN ALERT TUNGGAL KE CLOUDFLARE WORKER ──
is_ready = trigger_mode == "Once Per Bar Close" ? barstate.isconfirmed : barstate.isrealtime
if is_ready
    alert(unifiedPayload, alert.freq_once_per_bar)

// ── 6. TABEL HUD ON-CHART (Ringkasan 15 Prime Aset) ──
var table hud = table.new(position.bottom_left, 4, 7, bgcolor = color.new(color.black, 20), border_color = color.new(color.gray, 60), border_width = 1)
if show_hud and barstate.islast
    table.cell(hud, 0, 0, "FLOW MONITOR",   bgcolor = color.new(#0f766e, 20), text_color = color.white, text_size = size.small)
    table.cell(hud, 1, 0, "INDEKS (5)",     bgcolor = color.new(#6366f1, 20), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 0, "CRYPTO (5)",     bgcolor = color.new(#f59e0b, 20), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 0, "KOMODITAS (5)",  bgcolor = color.new(#10b981, 20), text_color = color.white, text_size = size.small)

    table.cell(hud, 0, 1, "Timeframe", text_color = color.gray, text_size = size.small)
    table.cell(hud, 1, 1, "US500: " + str.tostring(spxChg, "#.##") + "%", bgcolor = spxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 1, "BTC: " + str.tostring(btcChg, "#.##") + "%",   bgcolor = btcChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 1, "GOLD: " + str.tostring(xauChg, "#.##") + "%",  bgcolor = xauChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(hud, 0, 2, timeframe.period, text_color = color.white, text_size = size.small)
    table.cell(hud, 1, 2, "NAS100: " + str.tostring(nsxChg, "#.##") + "%", bgcolor = nsxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 2, "ETH: " + str.tostring(ethChg, "#.##") + "%",   bgcolor = ethChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 2, "SILVER: " + str.tostring(xagChg, "#.##") + "%", bgcolor = xagChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(hud, 0, 3, "Pairs: 15 Safe", text_color = color.yellow, text_size = size.small)
    table.cell(hud, 1, 3, "US30: " + str.tostring(djiChg, "#.##") + "%", bgcolor = djiChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 3, "SOL: " + str.tostring(solChg, "#.##") + "%",   bgcolor = solChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 3, "USOIL: " + str.tostring(oilChg, "#.##") + "%",  bgcolor = oilChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(hud, 0, 4, "Webhook: Ready", text_color = color.cyan, text_size = size.small)
    table.cell(hud, 1, 4, "GER40: " + str.tostring(daxChg, "#.##") + "%", bgcolor = daxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 4, "BNB: " + str.tostring(bnbChg, "#.##") + "%",   bgcolor = bnbChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 4, "UKOIL: " + str.tostring(bcoChg, "#.##") + "%",  bgcolor = bcoChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(hud, 0, 5, "Forex: via CS", text_color = color.gray, text_size = size.small)
    table.cell(hud, 1, 5, "JP225: " + str.tostring(nikChg, "#.##") + "%", bgcolor = nikChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 2, 5, "XRP: " + str.tostring(xrpChg, "#.##") + "%",   bgcolor = xrpChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(hud, 3, 5, "NATGAS: " + str.tostring(gasChg, "#.##") + "%", bgcolor = gasChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)`;
