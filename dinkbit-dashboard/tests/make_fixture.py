"""Genera un Excel SINTÉTICO con la misma disposición que 'SALES - dinkbit.xlsx' (para pruebas del parser)."""
import datetime, openpyxl

HDR = ["Fecha", "Nombre", "Origen", "Area", "Proyecto", "Valor", "Status"]

def sheet(wb, title, rows, col0=2, hdr_row=9, total=None, extra_top=True):
    ws = wb.create_sheet(title)
    ws.cell(1, 3, "Propuestas | Listado Completo")
    for j, h in enumerate(HDR):
        ws.cell(hdr_row, col0 + 1 + j, h)
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            ws.cell(hdr_row + 1 + i, col0 + 1 + j, v)
    # bloque resumen a la derecha (L-M): 'Propuestas | General' + Total
    ws.cell(3, 12, "Propuestas | General")
    ws.cell(4, 12, "Total"); ws.cell(4, 13, len(rows) if total is None else total)
    ws.cell(5, 12, "Hit Rate"); ws.cell(5, 13, 0.25)
    # bloque COMISIONES: NO debe leerse
    ws.cell(20, 12, "COMISIONES"); ws.cell(21, 12, "Comisionista Secreto"); ws.cell(21, 13, 99999)
    return ws

def build(path, variant="ok"):
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    wb.create_sheet("Intérvalos").cell(1, 1, "ignorar")
    q1 = [
        ["1.2026", "Cliente Uno", "Network", "Marketing", "Estrategia Digital", 100000, "Ganada"],
        [datetime.datetime(2026, 2, 10), "Cliente Dos", "Existente", "Desarrollo", "Sitio Web", 50000, "Perdida"],
        [2.2026, "Cliente Tres", "Network", "Desarrollo", "Shopify", 80000, "Pendiente"],
        ["03.2026", "Cliente Cuatro", "Contacto", "Marketing", "Branding", 20000, "Ganada"],
    ]
    q2 = [
        ["4.2026", "Cliente Uno", "Active Client", "Design", "Marketing Strategy", 200000, "Pendiente"],
        ["5.2026", "Cliente Cinco", "Network", "Web & App Development", "Website", 300000, "Ganada"],
        ["6.2026", "Cliente Seis", "Direct Contact", "Design", "Branding", 40000, "Perdida"],
        ["6.2026", "Cliente Seis", "Direct Contact", "Design", "Branding", 40000, "Perdida"],  # duplicado legítimo
    ]
    kw = {}
    if variant == "shifted":       # el listado se corre una columna a la derecha y una fila abajo
        kw = dict(col0=3, hdr_row=11)
    if variant == "difiere":
        q2.append([None, "Alguien", "Network", "Design", "Branding", 1, "Ganada"])   # fila sin nombre? no: nombre presente
    sheet(wb, "Q1 | 2026", q1, **kw)
    if variant == "difiere":
        sheet(wb, "Q2 | 2026 ", q2, total=len(q2) + 3, **kw)
    elif variant == "badstatus":
        q2[1][6] = "Ganado"
        sheet(wb, "Q2 | 2026 ", q2, **kw)
    elif variant == "nohdr":
        ws = wb.create_sheet("Q2 | 2026"); ws.cell(1, 1, "hoja rara")
    else:
        sheet(wb, "Q2 | 2026 ", q2, **kw)
    wb.create_sheet("Y | 2026").cell(1, 1, "resumen anual: ignorar")
    wb.save(path)

if __name__ == "__main__":
    import sys; build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "ok")
