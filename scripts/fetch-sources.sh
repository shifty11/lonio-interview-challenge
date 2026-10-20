#!/usr/bin/env bash
# Download the 2026 source-tax sources for the canton of Zurich into sources/.
# Usage: scripts/fetch-sources.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
estv="$root/sources/estv"
zh="$root/sources/zh"
mkdir -p "$estv" "$zh"

# ESTV: tariff file for import into payroll systems, and its record-format spec.
# Index page: https://www.estv.admin.ch/de/quellensteuertarife-import-in-lohnbuchhaltungssysteme
curl -sSfL -A "Mozilla/5.0" -o "$estv/tar26zh.zip" \
  "https://www.estv2.admin.ch/qst/2026/loehne/tar26zh.zip"
unzip -o -q "$estv/tar26zh.zip" -d "$estv"
curl -sSfL -A "Mozilla/5.0" -o "$estv/qst-tarife-recordformate-loehne-2025-de.pdf" \
  "https://www.estv.admin.ch/dam/de/sd-web/AvojuyFCZY95/qst-tarife-recordformate-loehne-2025-de.pdf"

# Canton of Zurich: readable tariff tables and calculation parameters.
# Index page: https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuer-tarife.html
base="https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/quellensteuer/quellensteuertarif/2026"
curl -sSfL -o "$zh/grundlagen_und_berechnungsparameter_2026.pdf" \
  "$base/grundlagen_und_berechnungsparameter_2026.pdf"
for tariff in A B C H; do
  for church in mit ohne; do
    curl -sSfL -o "$zh/${tariff}_${church}.pdf" \
      "$base/p208840_QuellensteuerTarif_${tariff}_${church}_KS_ENT1.pdf"
  done
done
# Tariff G exists only without church tax. The file name contains a space.
curl -sSfL -o "$zh/G_ohne.pdf" "$base/p208840_QuellensteuerTarif_G_ohne_KS_ENT1%201.pdf"

# The official tariff calculator: an Angular app. The snippet names the current bundle.
calc="$zh/calculator"
mkdir -p "$calc"
curl -sSfL -A "Mozilla/5.0" -o "$calc/snippet.html" \
  "https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuer-tarife/_jcr_content/main/singlepageapplicatio.zhweb-spa-snippet.zhweb-cache.html"
bundle_url="$(grep -oE 'https://[^"]+/main\.[0-9a-f]+\.js' "$calc/snippet.html")"
curl -sSfL -A "Mozilla/5.0" -o "$calc/$(basename "$bundle_url")" "$bundle_url"
# Readable copy for review. Prettier only parses the file; it does not run it.
bunx --bun prettier@3.3.3 --parser babel "$calc/$(basename "$bundle_url")" > "$calc/main.pretty.js"

# Rules: how to find the rate-defining salary and how to round the tax amount.
rules="$root/sources/rules"
mkdir -p "$rules"
# ZH employer guidance sheet (Zürcher Steuerbuch Nr. 87.3).
curl -sSfL -A "Mozilla/5.0" -o "$rules/zstb-87-3.pdf" \
  "https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-87-3/zstb-nr-87-3.pdf"
# ZH source-tax ordinance (Quellensteuerverordnung I, LS 631.41).
curl -sSfL -A "Mozilla/5.0" -o "$rules/zh-qvo1-631.41.pdf" \
  'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/9EDC05C94963A7B0C1258645002A79AE/$File/631.41_2.2.94_111.pdf'
# ESTV circular 45 (monthly model: section 6).
curl -sSfL -A "Mozilla/5.0" -o "$rules/estv-ks45-quellenbesteuerung.pdf" \
  "https://www.estv2.admin.ch/dvs/kreisschreiben/dbst-ks-2019-1-045-d-de.pdf"
# Tax scales for the formula: ZH tariff 2026 (§ 35 StG) and federal tariff 2026 (Art. 36 DBG).
curl -sSfL -A "Mozilla/5.0" -o "$rules/zh-kalte-progression-2026-631.1.pdf" \
  'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/46D70B70E90D0F52C1258D110033A244/$File/631.1.pdf'
curl -sSfL -A "Mozilla/5.0" -o "$rules/estv-dbst-tarif-2026-2-215-D-2025.pdf" \
  "https://www.estv.admin.ch/dam/de/sd-web/vFK3ntWLQ4s4/2-215-D-2025-d.pdf"
# Swissdec payroll guidelines ELM 6.0, edition 06.03.2026 (rounding: 5.1.1, tax amount: 10.6).
# Index page: https://www.swissdec.ch/de/elm
curl -sSfL -A "Mozilla/5.0" -o "$rules/swissdec-richtlinien-elm-6.0.pdf" \
  "https://swissdec.ch/document/share/488/b481b57f-e7af-409a-abf6-c4fc46142c3a"
# Appendix 1: QST calculation examples (a zip with two xlsx workbooks).
tmp="$(mktemp -d)"
curl -sSfL -A "Mozilla/5.0" -o "$tmp/anhang1.zip" \
  "https://swissdec.ch/document/share/489/ca74c9ef-be62-49bf-a7c6-37a41f33c9ae"
unzip -o -q -j "$tmp/anhang1.zip" '*.xlsx' -d "$rules"
rm -rf "$tmp"
