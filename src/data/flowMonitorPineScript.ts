/**
 * Flow Monitor TradingView Pine Script v6
 * Strictly limited to 39 unique security calls to guarantee staying under TradingView's 40 request.*() limit (RE10137 error fix).
 */

export const FLOW_MONITOR_PINE_SCRIPT = `//@version=6
// ══════════════════════════════════════════════════════════════════════════════
// Indicator: Arah Market & Flow Monitor — TV Edge Sync (Pine Script v6)
// Reference: https://github.com/aideelyst/flowmonitor
// Optimized: Exactly 39 Selected Prime Assets (Guaranteed ≤ 40 request limit safe)
// Includes: Top Crypto (5), High-Volume Commodities (4), Macro & Indices (4), Forex Prime (26)
// ══════════════════════════════════════════════════════════════════════════════

indicator("Arah Market & Flow Monitor — TV Edge Sync (39 Prime)", shorttitle="FlowMonitor 39", overlay = false, max_bars_back = 500)

// ── 1. INPUTS & CONFIGURATIONS ──
grp_feed    = "── Category Feeds & Webhook Dispatch ──"
send_crypto = input.bool(true, "Send Crypto Basket (5 Top Coins)", group = grp_feed)
send_metals = input.bool(true, "Send Metals & Commodities (Gold, Silver, Oil, Gas)", group = grp_feed)
send_macro  = input.bool(true, "Send Macro & Indices (SPX, NDX, DXY, Yield)", group = grp_feed)
send_forex  = input.bool(true, "Send Forex Prime (26 High-Volume Pairs)", group = grp_feed)

grp_alert   = "── Alert Trigger Mode ──"
trigger_mode = input.string("Once Per Bar Close", "Webhook Frequency", options = ["Once Per Bar Close", "Realtime / Every Tick"], group = grp_alert)
show_hud    = input.bool(true, "Show On-Chart HUD Summary Table", group = grp_alert)

// ── 2. DATA EXTRACTION FUNCTION (PRICE + ROC + EMA20) ──
// Uses single bundled tuple to stay strictly under the 40 request calls limit
f_data(sym) =>
    [c, o, h, l, v, c1, ema20] = request.security(sym, timeframe.period, [close, open, high, low, volume, close[1], ta.ema(close, 20)], barmerge.gaps_off, barmerge.lookahead_off)
    chg = c1 != 0 ? math.round(((c - c1) / c1) * 10000) / 100 : 0.0
    [c, o, h, l, v, chg, ema20]

f_item(pair, src, c, o, h, l, v, chg, ema20) =>
    '{"p":"' + pair + '","c":' + str.tostring(c) + ',"o":' + str.tostring(o) + ',"h":' + str.tostring(h) + ',"l":' + str.tostring(l) + ',"v":' + str.tostring(v) + ',"chg":' + str.tostring(chg, "#.##") + ',"ema20":' + str.tostring(ema20, "#.####") + ',"src":"' + src + '"}'

// ── 3. FETCH 39 PRIME ASSETS (EXACTLY 39 UNIQUE REQUEST CALLS < 40) ──
// Crypto Prime (5 Top Liquid Coins)
[btcC, btcO, btcH, btcL, btcV, btcChg, btcEma] = f_data("BINANCE:BTCUSDT")
[ethC, ethO, ethH, ethL, ethV, ethChg, ethEma] = f_data("BINANCE:ETHUSDT")
[solC, solO, solH, solL, solV, solChg, solEma] = f_data("BINANCE:SOLUSDT")
[xrpC, xrpO, xrpH, xrpL, xrpV, xrpChg, xrpEma] = f_data("BINANCE:XRPUSDT")
[bnbC, bnbO, bnbH, bnbL, bnbV, bnbChg, bnbEma] = f_data("BINANCE:BNBUSDT")

// Metals & Commodities Prime (4 Key Assets)
[xauC, xauO, xauH, xauL, xauV, xauChg, xauEma] = f_data("OANDA:XAUUSD")
[xagC, xagO, xagH, xagL, xagV, xagChg, xagEma] = f_data("OANDA:XAGUSD")
[oilC, oilO, oilH, oilL, oilV, oilChg, oilEma] = f_data("TVC:USOIL")
[gasC, gasO, gasH, gasL, gasV, gasChg, gasEma] = f_data("TVC:NATGAS")

// Macro & Indices Prime (4 Core Drivers)
[spxC,   spxO,   spxH,   spxL,   spxV,   spxChg,   spxEma]   = f_data("OANDA:SPX500USD")
[nsxC,   nsxO,   nsxH,   nsxL,   nsxV,   nsxChg,   nsxEma]   = f_data("OANDA:NAS100USD")
[dxyC,   dxyO,   dxyH,   dxyL,   dxyV,   dxyChg,   dxyEma]   = f_data("TVC:DXY")
[us10yC, us10yO, us10yH, us10yL, us10yV, us10yChg, us10yEma] = f_data("TVC:US10Y")

// Forex Majors (7 Pairs)
[eurusdC, eurusdO, eurusdH, eurusdL, eurusdV, eurusdChg, eurusdEma] = f_data("OANDA:EURUSD")
[gbpusdC, gbpusdO, gbpusdH, gbpusdL, gbpusdV, gbpusdChg, gbpusdEma] = f_data("OANDA:GBPUSD")
[usdjpyC, usdjpyO, usdjpyH, usdjpyL, usdjpyV, usdjpyChg, usdjpyEma] = f_data("OANDA:USDJPY")
[audusdC, audusdO, audusdH, audusdL, audusdV, audusdChg, audusdEma] = f_data("OANDA:AUDUSD")
[nzdusdC, nzdusdO, nzdusdH, nzdusdL, nzdusdV, nzdusdChg, nzdusdEma] = f_data("OANDA:NZDUSD")
[usdcadC, usdcadO, usdcadH, usdcadL, usdcadV, usdcadChg, usdcadEma] = f_data("OANDA:USDCAD")
[usdchfC, usdchfO, usdchfH, usdchfL, usdchfV, usdchfChg, usdchfEma] = f_data("OANDA:USDCHF")

// Forex Crosses - EUR & GBP (11 Active Pairs)
[eurgbpC, eurgbpO, eurgbpH, eurgbpL, eurgbpV, eurgbpChg, eurgbpEma] = f_data("OANDA:EURGBP")
[euraudC, euraudO, euraudH, euraudL, euraudV, euraudChg, euraudEma] = f_data("OANDA:EURAUD")
[eurnzdC, eurnzdO, eurnzdH, eurnzdL, eurnzdV, eurnzdChg, eurnzdEma] = f_data("OANDA:EURNZD")
[eurcadC, eurcadO, eurcadH, eurcadL, eurcadV, eurcadChg, eurcadEma] = f_data("OANDA:EURCAD")
[eurchfC, eurchfO, eurchfH, eurchfL, eurchfV, eurchfChg, eurchfEma] = f_data("OANDA:EURCHF")
[eurjpyC, eurjpyO, eurjpyH, eurjpyL, eurjpyV, eurjpyChg, eurjpyEma] = f_data("OANDA:EURJPY")
[gbpaudC, gbpaudO, gbpaudH, gbpaudL, gbpaudV, gbpaudChg, gbpaudEma] = f_data("OANDA:GBPAUD")
[gbpnzdC, gbpnzdO, gbpnzdH, gbpnzdL, gbpnzdV, gbpnzdChg, gbpnzdEma] = f_data("OANDA:GBPNZD")
[gbpcadC, gbpcadO, gbpcadH, gbpcadL, gbpcadV, gbpcadChg, gbpcadEma] = f_data("OANDA:GBPCAD")
[gbpchfC, gbpchfO, gbpchfH, gbpchfL, gbpchfV, gbpchfChg, gbpchfEma] = f_data("OANDA:GBPCHF")
[gbpjpyC, gbpjpyO, gbpjpyH, gbpjpyL, gbpjpyV, gbpjpyChg, gbpjpyEma] = f_data("OANDA:GBPJPY")

// Forex Crosses - JPY, AUD, CAD & Risk Crosses (8 Active Pairs)
[audnzdC, audnzdO, audnzdH, audnzdL, audnzdV, audnzdChg, audnzdEma] = f_data("OANDA:AUDNZD")
[audcadC, audcadO, audcadH, audcadL, audcadV, audcadChg, audcadEma] = f_data("OANDA:AUDCAD")
[audjpyC, audjpyO, audjpyH, audjpyL, audjpyV, audjpyChg, audjpyEma] = f_data("OANDA:AUDJPY")
[nzdcadC, nzdcadO, nzdcadH, nzdcadL, nzdcadV, nzdcadChg, nzdcadEma] = f_data("OANDA:NZDCAD")
[nzdjpyC, nzdjpyO, nzdjpyH, nzdjpyL, nzdjpyV, nzdjpyChg, nzdjpyEma] = f_data("OANDA:NZDJPY")
[cadchfC, cadchfO, cadchfH, cadchfL, cadchfV, cadchfChg, cadchfEma] = f_data("OANDA:CADCHF")
[cadjpyC, cadjpyO, cadjpyH, cadjpyL, cadjpyV, cadjpyChg, cadjpyEma] = f_data("OANDA:CADJPY")
[chfjpyC, chfjpyO, chfjpyH, chfjpyL, chfjpyV, chfjpyChg, chfjpyEma] = f_data("OANDA:CHFJPY")

tf = timeframe.period

// ── 4. PAYLOADS BUILDER ──
// 1. Crypto Prime (5 Coins)
cryptoPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"crypto","data":[' +
     f_item("BTC",    "BINANCE:BTCUSDT",  btcC,  btcO,  btcH,  btcL,  btcV,  btcChg,  btcEma)  + ',' +
     f_item("ETH",    "BINANCE:ETHUSDT",  ethC,  ethO,  ethH,  ethL,  ethV,  ethChg,  ethEma)  + ',' +
     f_item("SOL",    "BINANCE:SOLUSDT",  solC,  solO,  solH,  solL,  solV,  solChg,  solEma)  + ',' +
     f_item("XRP",    "BINANCE:XRPUSDT",  xrpC,  xrpO,  xrpH,  xrpL,  xrpV,  xrpChg,  xrpEma)  + ',' +
     f_item("BNB",    "BINANCE:BNBUSDT",  bnbC,  bnbO,  bnbH,  bnbL,  bnbV,  bnbChg,  bnbEma)  +
     ']}'

// 2. Metals & Commodities Prime (4 Items)
metalsPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"metals","data":[' +
     f_item("XAUUSD", "OANDA:XAUUSD",     xauC,  xauO,  xauH,  xauL,  xauV,  xauChg,  xauEma)  + ',' +
     f_item("XAGUSD", "OANDA:XAGUSD",     xagC,  xagO,  xagH,  xagL,  xagV,  xagChg,  xagEma)  + ',' +
     f_item("USOIL",  "TVC:USOIL",        oilC,  oilO,  oilH,  oilL,  oilV,  oilChg,  oilEma)  + ',' +
     f_item("NATGAS", "TVC:NATGAS",       gasC,  gasO,  gasH,  gasL,  gasV,  gasChg,  gasEma)  +
     ']}'

// 3. Macro & Indices Prime (4 Benchmarks)
macroPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"macro","data":[' +
     f_item("US500",  "OANDA:SPX500USD",  spxC,  spxO,  spxH,  spxL,  spxV,  spxChg,  spxEma)  + ',' +
     f_item("US100",  "OANDA:NAS100USD",  nsxC,  nsxO,  nsxH,  nsxL,  nsxV,  nsxChg,  nsxEma)  + ',' +
     f_item("DXY",    "TVC:DXY",          dxyC,  dxyO,  dxyH,  dxyL,  dxyV,  dxyChg,  dxyEma)  + ',' +
     f_item("US10Y",  "TVC:US10Y",        us10yC,us10yO,us10yH,us10yL,us10yV,us10yChg,us10yEma) +
     ']}'

// 4. Forex Majors (7 Pairs)
forexMajorsPayload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"forex_majors","data":[' +
     f_item("EURUSD", "OANDA:EURUSD",     eurusdC, eurusdO, eurusdH, eurusdL, eurusdV, eurusdChg, eurusdEma) + ',' +
     f_item("GBPUSD", "OANDA:GBPUSD",     gbpusdC, gbpusdO, gbpusdH, gbpusdL, gbpusdV, gbpusdChg, gbpusdEma) + ',' +
     f_item("USDJPY", "OANDA:USDJPY",     usdjpyC, usdjpyO, usdjpyH, usdjpyL, usdjpyV, usdjpyChg, usdjpyEma) + ',' +
     f_item("AUDUSD", "OANDA:AUDUSD",     audusdC, audusdO, audusdH, audusdL, audusdV, audusdChg, audusdEma) + ',' +
     f_item("NZDUSD", "OANDA:NZDUSD",     nzdusdC, nzdusdO, nzdusdH, nzdusdL, nzdusdV, nzdusdChg, nzdusdEma) + ',' +
     f_item("USDCAD", "OANDA:USDCAD",     usdcadC, usdcadO, usdcadH, usdcadL, usdcadV, usdcadChg, usdcadEma) + ',' +
     f_item("USDCHF", "OANDA:USDCHF",     usdchfC, usdchfO, usdchfH, usdchfL, usdchfV, usdchfChg, usdchfEma) +
     ']}'

// 5. Forex Crosses - EUR & GBP (11 Pairs)
forexCrosses1Payload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"forex_crosses_1","data":[' +
     f_item("EURGBP", "OANDA:EURGBP",     eurgbpC, eurgbpO, eurgbpH, eurgbpL, eurgbpV, eurgbpChg, eurgbpEma) + ',' +
     f_item("EURAUD", "OANDA:EURAUD",     euraudC, euraudO, euraudH, euraudL, euraudV, euraudChg, euraudEma) + ',' +
     f_item("EURNZD", "OANDA:EURNZD",     eurnzdC, eurnzdO, eurnzdH, eurnzdL, eurnzdV, eurnzdChg, eurnzdEma) + ',' +
     f_item("EURCAD", "OANDA:EURCAD",     eurcadC, eurcadO, eurcadH, eurcadL, eurcadV, eurcadChg, eurcadEma) + ',' +
     f_item("EURCHF", "OANDA:EURCHF",     eurchfC, eurchfO, eurchfH, eurchfL, eurchfV, eurchfChg, eurchfEma) + ',' +
     f_item("EURJPY", "OANDA:EURJPY",     eurjpyC, eurjpyO, eurjpyH, eurjpyL, eurjpyV, eurjpyChg, eurjpyEma) + ',' +
     f_item("GBPAUD", "OANDA:GBPAUD",     gbpaudC, gbpaudO, gbpaudH, gbpaudL, gbpaudV, gbpaudChg, gbpaudEma) + ',' +
     f_item("GBPNZD", "OANDA:GBPNZD",     gbpnzdC, gbpnzdO, gbpnzdH, gbpnzdL, gbpnzdV, gbpnzdChg, gbpnzdEma) + ',' +
     f_item("GBPCAD", "OANDA:GBPCAD",     gbpcadC, gbpcadO, gbpcadH, gbpcadL, gbpcadV, gbpcadChg, gbpcadEma) + ',' +
     f_item("GBPCHF", "OANDA:GBPCHF",     gbpchfC, gbpchfO, gbpchfH, gbpchfL, gbpchfV, gbpchfChg, gbpchfEma) + ',' +
     f_item("GBPJPY", "OANDA:GBPJPY",     gbpjpyC, gbpjpyO, gbpjpyH, gbpjpyL, gbpjpyV, gbpjpyChg, gbpjpyEma) +
     ']}'

// 6. Forex Crosses - JPY, AUD, CAD & Risk Barometer (8 Pairs)
forexCrosses2Payload = '{"t":' + str.tostring(time) + ',"tf":"' + tf + '","cat":"forex_crosses_2","data":[' +
     f_item("AUDNZD", "OANDA:AUDNZD",     audnzdC, audnzdO, audnzdH, audnzdL, audnzdV, audnzdChg, audnzdEma) + ',' +
     f_item("AUDCAD", "OANDA:AUDCAD",     audcadC, audcadO, audcadH, audcadL, audcadV, audcadChg, audcadEma) + ',' +
     f_item("AUDJPY", "OANDA:AUDJPY",     audjpyC, audjpyO, audjpyH, audjpyL, audjpyV, audjpyChg, audjpyEma) + ',' +
     f_item("NZDCAD", "OANDA:NZDCAD",     nzdcadC, nzdcadO, nzdcadH, nzdcadL, nzdcadV, nzdcadChg, nzdcadEma) + ',' +
     f_item("NZDJPY", "OANDA:NZDJPY",     nzdjpyC, nzdjpyO, nzdjpyH, nzdjpyL, nzdjpyV, nzdjpyChg, nzdjpyEma) + ',' +
     f_item("CADCHF", "OANDA:CADCHF",     cadchfC, cadchfO, cadchfH, cadchfL, cadchfV, cadchfChg, cadchfEma) + ',' +
     f_item("CADJPY", "OANDA:CADJPY",     cadjpyC, cadjpyO, cadjpyH, cadjpyL, cadjpyV, cadjpyChg, cadjpyEma) + ',' +
     f_item("CHFJPY", "OANDA:CHFJPY",     chfjpyC, chfjpyO, chfjpyH, chfjpyL, chfjpyV, chfjpyChg, chfjpyEma) +
     ']}'

// ── 5. WEBHOOK ALERTS DISPATCH ──
is_ready = trigger_mode == "Once Per Bar Close" ? barstate.isconfirmed : barstate.isrealtime

if is_ready
    if send_crypto
        alert(cryptoPayload, alert.freq_once_per_bar)
    if send_metals
        alert(metalsPayload, alert.freq_once_per_bar)
    if send_macro
        alert(macroPayload, alert.freq_once_per_bar)
    if send_forex
        alert(forexMajorsPayload, alert.freq_once_per_bar)
        alert(forexCrosses1Payload, alert.freq_once_per_bar)
        alert(forexCrosses2Payload, alert.freq_once_per_bar)

// ── 6. VISUAL ON-CHART HUD DASHBOARD ──
var table t = table.new(position.bottom_left, 5, 5, bgcolor = color.new(color.black, 20), border_color = color.new(color.gray, 60), border_width = 1)
if show_hud and barstate.islast
    table.cell(t, 0, 0, "FLOW MONITOR 39", bgcolor = color.new(color.blue, 30), text_color = color.white, text_size = size.small)
    table.cell(t, 1, 0, "CRYPTO (24H)",   bgcolor = color.new(#f59e0b, 30),   text_color = color.white, text_size = size.small)
    table.cell(t, 2, 0, "METALS/COMM",   bgcolor = color.new(#10b981, 30),   text_color = color.white, text_size = size.small)
    table.cell(t, 3, 0, "MACRO/INDICES", bgcolor = color.new(#8b5cf6, 30),   text_color = color.white, text_size = size.small)
    table.cell(t, 4, 0, "FOREX MAJORS",  bgcolor = color.new(#06b6d4, 30),   text_color = color.white, text_size = size.small)

    table.cell(t, 0, 1, "TF: " + tf, text_color = color.gray, text_size = size.small)
    table.cell(t, 1, 1, "BTC: " + str.tostring(btcChg, "#.##") + "%", bgcolor = btcChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 1, "Gold: " + str.tostring(xauChg, "#.##") + "%", bgcolor = xauChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 1, "US500: " + str.tostring(spxChg, "#.##") + "%", bgcolor = spxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 4, 1, "EURUSD: " + str.tostring(eurusdChg, "#.##") + "%", bgcolor = eurusdChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 2, "Status: Active", text_color = color.green, text_size = size.small)
    table.cell(t, 1, 2, "ETH: " + str.tostring(ethChg, "#.##") + "%", bgcolor = ethChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 2, "Silver: " + str.tostring(xagChg, "#.##") + "%", bgcolor = xagChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 2, "DXY: " + str.tostring(dxyChg, "#.##") + "%", bgcolor = dxyChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 4, 2, "GBPUSD: " + str.tostring(gbpusdChg, "#.##") + "%", bgcolor = gbpusdChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 3, "Pairs: 39 (≤40 Safe)", text_color = color.yellow, text_size = size.small)
    table.cell(t, 1, 3, "SOL: " + str.tostring(solChg, "#.##") + "%", bgcolor = solChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 3, "USOIL: " + str.tostring(oilChg, "#.##") + "%", bgcolor = oilChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 3, "US10Y: " + str.tostring(us10yChg, "#.##") + "%", bgcolor = us10yChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 4, 3, "USDJPY: " + str.tostring(usdjpyChg, "#.##") + "%", bgcolor = usdjpyChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)

    table.cell(t, 0, 4, "Sync: Ready", text_color = color.cyan, text_size = size.small)
    table.cell(t, 1, 4, "BNB: " + str.tostring(bnbChg, "#.##") + "%", bgcolor = bnbChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 2, 4, "NATGAS: " + str.tostring(gasChg, "#.##") + "%", bgcolor = gasChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 3, 4, "US100: " + str.tostring(nsxChg, "#.##") + "%", bgcolor = nsxChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)
    table.cell(t, 4, 4, "AUDUSD: " + str.tostring(audusdChg, "#.##") + "%", bgcolor = audusdChg >= 0 ? color.new(color.green, 70) : color.new(color.red, 70), text_color = color.white, text_size = size.small)`;
