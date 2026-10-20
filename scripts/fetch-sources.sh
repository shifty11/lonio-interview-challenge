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
# Swissdec payroll guidelines ELM 5.0 (rounding: 4.1.1, tax amount: 9.6) and QST appendix 3.
curl -sSfL -A "Mozilla/5.0" -o "$rules/swissdec-richtlinien-elm-5.0.pdf" \
  "https://www.swissdec.ch/document/share/358/ccfd0c26-59fd-495b-8c20-6b3435a7c383"
curl -sSfL -A "Mozilla/5.0" -o "$rules/swissdec-anhang3-qst-drittparteien.pdf" \
  "https://www.swissdec.ch/document/share/67/351a3561-f9c8-4319-b3b6-cadaabb11146"
