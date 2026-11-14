#!/usr/bin/env python3
"""Fixtures of the parseXlsx test (tests/phase4-parity-dev9.test.tsx) — XLSX files written by INDEPENDENT producers:

- openpyxl-inline.xlsx (this script, openpyxl 3.1): DEFLATED entries, inline strings, numbers, booleans, an empty cell
  and an empty row. Run: python3 make-fixture.py
- libreoffice-shared-strings.xlsx: LibreOffice Calc's own XLSX export (DEFLATED entries, xl/sharedStrings.xml) of
  libreoffice-shared-strings.csv, made with
    soffice --headless --infilter="CSV:44,34,76,1" --convert-to xlsx:"Calc MS Excel 2007 XML" libreoffice-shared-strings.csv
"""
import os, zipfile, openpyxl
here = os.path.dirname(os.path.abspath(__file__))
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Records"
ws.append(["ID", "Title", "Amount", "Done", "Note"])
ws.append(["R-1", "Pump check", 12.5, True, "first"])
ws.append(["R-2", "فحص المضخة", 7, False, None])
ws.append(["R-3", "Repeat", 12.5, None, "first"])  # "first" again: one shared string, used twice
ws["B6"] = "after a blank row"
out = os.path.join(here, "openpyxl-inline.xlsx")
wb.save(out)
z = zipfile.ZipFile(out)
for i in z.infolist():
    print(i.filename, "deflated" if i.compress_type == zipfile.ZIP_DEFLATED else "stored")
