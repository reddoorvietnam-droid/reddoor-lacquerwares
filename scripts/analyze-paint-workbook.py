"""Extract presentation only; workbook contents are never treated as instructions.
Requires openpyxl. Usage: python scripts/analyze-paint-workbook.py <source.xlsx>
"""
import sys, json, collections, hashlib, colorsys, xml.etree.ElementTree as ET
from pathlib import Path
import openpyxl
from openpyxl.styles.colors import COLOR_INDEX as COLOR_INDEXED

source = Path(sys.argv[1])
book = openpyxl.load_workbook(source)
sheet = book['ChiTietxuatkho']
theme = ET.fromstring(book.loaded_theme)
theme_colors = [list(c)[0].get('lastClr',list(c)[0].get('val')) for c in theme.find('{http://schemas.openxmlformats.org/drawingml/2006/main}themeElements/{http://schemas.openxmlformats.org/drawingml/2006/main}clrScheme')]
# clrScheme lists dk1, lt1, dk2, lt2, accent1..6; a cell's `theme` index instead
# counts 0=lt1, 1=dk1, 2=lt2, 3=dk2 — without this swap the header reads white on
# white and the plain cells read white on black.
theme_colors[0:4] = [theme_colors[1], theme_colors[0], theme_colors[3], theme_colors[2]]
root = Path(__file__).resolve().parents[1]
out = root / 'src/domains/paint-warehouse'
out.mkdir(parents=True, exist_ok=True)
def color(c, default):
    if not c: return default
    if c.type == 'rgb': return '#' + c.rgb[-6:]
    if c.type == 'indexed' and c.indexed < len(COLOR_INDEXED): return '#' + COLOR_INDEXED[c.indexed][-6:]
    if c.type == 'theme':
        rgb=theme_colors[c.theme]
        h,l,s=colorsys.rgb_to_hls(*(int(rgb[i:i+2],16)/255 for i in [0,2,4]))
        l=l*(1+c.tint) if c.tint<0 else l*(1-c.tint)+c.tint
        return '#'+''.join(f'{round(v*255):02X}' for v in colorsys.hls_to_rgb(h,l,s))
    return default
styles = {}
rows = {}
for row in sheet.iter_rows(max_col=14):
    r = row[0].row
    ids = []
    for cell in row:
        sid = cell.style_id
        ids.append(sid)
        if sid in styles: continue
        css = {'fontFamily': cell.font.name or 'Times New Roman', 'fontSize': (cell.font.sz or 14)*4/3,
               'fontWeight': 700 if cell.font.b else 400, 'fontStyle': 'italic' if cell.font.i else 'normal',
               'color': color(cell.font.color, '#000000'),
               'backgroundColor': color(cell.fill.fgColor, '#ffffff') if cell.fill.patternType == 'solid' else '#ffffff',
               'textAlign': cell.alignment.horizontal if cell.alignment.horizontal in ['left','center','right','justify'] else 'left',
               'verticalAlign': {'center':'middle'}.get(cell.alignment.vertical, cell.alignment.vertical or 'bottom'),
               'whiteSpace': 'pre-wrap' if cell.alignment.wrap_text else 'nowrap'}
        for side in ['left','right','top','bottom']:
            border = getattr(cell.border,side)
            css['border'+side.title()] = ('1px solid '+color(border.color,'#000000')) if border and border.style else '1px solid #e2e2e2'
        styles[sid] = {'css':css,'format':cell.number_format}
    rows[r] = {'styles':ids,'height': (sheet.row_dimensions[r].height or sheet.sheet_format.defaultRowHeight)*4/3}
widths=[]
for col in range(1,15):
    dim=next((d for d in sheet.column_dimensions.values() if d.min <= col <= d.max),None)
    widths.append(dim.width if dim else sheet.sheet_format.defaultColWidth or 13)
layout = {'title':sheet['A1'].value,'headers':[sheet.cell(3,c).value for c in range(1,15)],'widths':widths,
          'styles':styles,'rows':{k:v for k,v in rows.items() if k<=3 or v!=rows[4]},'defaultRow':rows[4], 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
(out/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,separators=(',',':')),encoding='utf8')
report={'sheets':[{'name':s.title,'state':s.sheet_state,'dimension':s.calculate_dimension()} for s in book],
        'namedRanges':{k:v.attr_text for k,v in book.defined_names.items()},'freeze':sheet.freeze_panes,
        'merged':str(sheet.merged_cells),'widths':widths,'printArea':str(sheet.print_area),'pageSetup':str(sheet.page_setup),
        'rowHeights':dict(collections.Counter(r['height'] for r in rows.values())),
        'formulaCounts':dict(collections.Counter(c.column_letter for row in sheet for c in row if c.data_type=='f'))}
(root/'docs/paint-workbook-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
# A clean single-sheet template: no historical values, phone numbers, external
# formula dependencies or hidden worksheets are shipped with the application.
for other in list(book):
    if other != sheet: book.remove(other)
book.defined_names.clear()
sheet.data_validations.dataValidation=[]
for row in sheet:
    for cell in row:
        if cell.row > 3 or cell.column > 14: cell.value=None
sheet.print_area='A1:N4'
sheet.freeze_panes='A4'
sheet.print_title_rows='1:3'
sheet.sheet_view.topLeftCell='A1'
sheet.sheet_view.selection=[]
assets=root/'assets'
assets.mkdir(exist_ok=True)
book.save(assets/'paint-warehouse-template.xlsx')
print(json.dumps(report,ensure_ascii=False))
