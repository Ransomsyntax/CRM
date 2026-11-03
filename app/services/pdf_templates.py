"""Access-controlled CRM PDF presentation. Authorization remains in the calling route."""
from io import BytesIO
from decimal import Decimal, InvalidOperation
from html import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

TEMPLATES = {
    "classic": ("Formal Corporate", "#152741", "#F1F5F9"),
    "modern": ("Executive Blue", "#0F2180", "#EBF2FA"),
    "minimal": ("Executive Minimal", "#27313F", "#F7F8FA"),
}
SUPPORTED = {"quotes", "invoices", "products", "price_books", "vendors",
             "sales_orders", "purchase_orders", "payments"}


def _as_decimal(value):
    try:
        return Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def _plain(value):
    if value is None or value == "":
        return "—"
    if isinstance(value, (list, dict)):
        return str(value)
    return str(value)


def _text(value):
    return escape(_plain(value)).replace("\n", "<br/>")


def render_record_pdf(resource, data, fields, template="classic", paper="a4",
                      orientation="portrait"):
    if resource not in SUPPORTED:
        raise ValueError("Unsupported PDF resource")
    if template not in TEMPLATES:
        raise ValueError("Unknown PDF template")
    if paper not in ("a4", "letter") or orientation not in ("portrait", "landscape"):
        raise ValueError("Unsupported PDF layout")
    pagesize = A4 if paper == "a4" else letter
    if orientation == "landscape":
        pagesize = landscape(pagesize)
    title_color, shaded = (colors.HexColor(x) for x in TEMPLATES[template][1:])
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=pagesize, leftMargin=17*mm,
                            rightMargin=17*mm, topMargin=19*mm, bottomMargin=17*mm,
                            title=f"{resource.replace('_', ' ').title()} PDF")
    usable = pagesize[0] - 34*mm
    base = dict(fontName="Helvetica", fontSize=9, leading=13, spaceAfter=5,
                textColor=colors.HexColor("#26364D"))
    normal = ParagraphStyle("Body", **base)
    heading = ParagraphStyle("Heading", parent=normal, fontName="Times-Bold",
                             fontSize=22 if template != "minimal" else 16,
                             leading=27, textColor=title_color, alignment=TA_RIGHT, spaceAfter=10)
    section = ParagraphStyle("Section", parent=normal, fontName="Helvetica-Bold",
                             fontSize=11, leading=16, textColor=title_color,
                             spaceBefore=14, spaceAfter=9)
    small = ParagraphStyle("Small", parent=normal, fontSize=8, leading=11)
    document_name = {"quotes": "QUOTATION", "invoices": "TAX INVOICE", "sales_orders": "SALES ORDER",
                     "purchase_orders": "PURCHASE ORDER", "price_books": "PRICE BOOK",
                     "payments": "PAYMENT RECEIPT"}.get(resource,resource.replace("_"," ").upper())
    masthead = Table([[Paragraph("<b>CONVOSIS CRM</b>", ParagraphStyle("Brand", parent=section, fontName="Times-Bold", fontSize=16, leading=21)),
                       Paragraph(document_name, heading)]],colWidths=[usable*.48,usable*.52])
    masthead.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                                 ("LINEBELOW",(0,0),(-1,-1),1.8,title_color),
                                 ("BOTTOMPADDING",(0,0),(-1,-1),13)]))
    story = [masthead,Spacer(1,12)]
    number = data.get(f"{resource.rstrip('s')}_number") or data.get("record_number") or data.get("invoice_number") or data.get("quote_number")
    if number:
        ref = Table([[Paragraph("<b>DOCUMENT REFERENCE</b>",small),Paragraph(_text(number),normal)]], colWidths=[usable*.28,usable*.72])
        ref.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),shaded),("BOX",(0,0),(-1,-1),.7,colors.HexColor("#CBD5E1")),("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10)]))
        story.append(ref)
    if data.get("name"):
        story.append(Paragraph(f"<b>Subject:</b> {_text(data['name'])}", normal))
    skip = {"line_items", "name", "record_number", "id", "organization_id",
            "amount", "subtotal", "discount_percent", "tax_percent", "adjustment", "terms", "notes",
            "created_by", "owner_id", "modified_by", "archived", "data"}
    pairs = []
    seen = set()
    for field in fields:
        key = field.get("key")
        if not key or key in skip or field.get("type") == "file":
            continue
        value = data.get(key)
        if value is None or value == "" or isinstance(value, (list, dict)):
            continue
        seen.add(key)
        label = field.get("label") or key.replace("_", " ").title()
        if key.endswith("_id") and str(value).isdigit():
            value = data.get(key[:-3] + "_name") or data.get(key[:-3] + "_display") or value
            label = label.replace(" ID", "")
        if key.endswith("_date") or key in ("valid_until","due_date"):
            try:
                from datetime import date
                value = date.fromisoformat(str(value)[:10]).strftime("%d %b %Y")
            except ValueError:
                pass
        pairs.append((label, value))
    for key in ("invoice_number", "quote_number"):
        if key not in seen and key not in skip and data.get(key) not in (None, ""):
            pairs.append((key.replace("_", " ").title(), data[key]))
    if resource in ("quotes","invoices","sales_orders","purchase_orders"):
        address_groups = [("BILL TO", "billing"), ("SHIP TO", "shipping")]
        boxes = []
        for title, prefix in address_groups:
            address = [data.get(prefix + "_" + key) for key in ("street","city","state","code","country")]
            address = [str(v) for v in address if v]
            customer = data.get("account_name") or data.get("customer_name") or ""
            lines_text = [customer] + address if prefix == "billing" else address
            content = "<br/>".join(escape(line) for line in lines_text if line) or "Not provided"
            boxes.append([Paragraph(f"<b>{title}</b>", section), Paragraph(content, normal)])
        address_rows = [[Table([[boxes[0][0]],[boxes[0][1]]],colWidths=[usable*.45]),
                         Table([[boxes[1][0]],[boxes[1][1]]],colWidths=[usable*.45])]]
        addresses = Table(address_rows,colWidths=[usable*.5,usable*.5])
        addresses.setStyle(TableStyle([("BOX",(0,0),(-1,-1),.55,colors.HexColor("#CAD5E3")),
                                      ("INNERGRID",(0,0),(-1,-1),.55,colors.HexColor("#CAD5E3")),
                                      ("VALIGN",(0,0),(-1,-1),"TOP"),
                                      ("LEFTPADDING",(0,0),(-1,-1),11),
                                      ("TOPPADDING",(0,0),(-1,-1),8),
                                      ("BOTTOMPADDING",(0,0),(-1,-1),10)]))
        story.extend([Spacer(1,12),addresses])
    if pairs:
        story.append(Paragraph("DOCUMENT DETAILS", section))
        rows = [[Paragraph(f"<b>{_text(label)}</b>", small),
                 Paragraph(_text(value), small)] for label, value in pairs]
        table = Table(rows, colWidths=[usable*.32, usable*.68], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BOX",(0,0),(-1,-1),.7,colors.HexColor("#CBD5E1")),
            ("INNERGRID",(0,0),(-1,-1),.35,colors.HexColor("#E2E8F0")),
            ("VALIGN", (0,0),(-1,-1),"TOP"),
            ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white,shaded]),
            ("LEFTPADDING",(0,0),(-1,-1),9),
            ("RIGHTPADDING",(0,0),(-1,-1),9),
            ("TOPPADDING",(0,0),(-1,-1),7),
            ("BOTTOMPADDING",(0,0),(-1,-1),7),
            ("LINEBELOW",(0,-1),(-1,-1),.5,colors.HexColor("#CFD8E4")),
        ]))
        story.append(table)
    lines = data.get("line_items") or []
    if isinstance(lines, list) and lines:
        story.append(Paragraph("PRODUCTS & SERVICES", section))
        headers = ["#","Product / Description","Qty","Unit Price","Discount","Tax","Total"]
        widths = [usable*.05,usable*.35,usable*.08,usable*.14,usable*.12,usable*.10,usable*.16]
        rows = [[Paragraph(f'<font color="white"><b>{h}</b></font>', small) for h in headers]]
        for index, line in enumerate(lines,1):
            if not isinstance(line,dict):
                continue
            values = [index, line.get("name") or line.get("product_name") or "Item",
                      line.get("quantity"), line.get("unit_price"),
                      str(line.get("discount_percent") or 0)+"%",
                      str(line.get("tax_percent") or 0)+"%",
                      line.get("total")]
            rows.append([Paragraph(_text(v),small) for v in values])
        table = Table(rows,colWidths=widths,repeatRows=1,hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),title_color),
            ("BOX",(0,0),(-1,-1),.7,colors.HexColor("#CBD5E1")),
            ("INNERGRID",(0,1),(-1,-1),.35,colors.HexColor("#E2E8F0")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.white),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,shaded]),
            ("VALIGN",(0,0),(-1,-1),"TOP"),
            ("TOPPADDING",(0,0),(-1,-1),8),
            ("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),5),
            ("RIGHTPADDING",(0,0),(-1,-1),5),
            ("LINEBELOW",(0,-1),(-1,-1),.5,colors.HexColor("#B8C5D6")),
        ]))
        story.append(table)
    if resource in ("quotes","invoices","sales_orders","purchase_orders"):
        story.append(Paragraph("PAYMENT SUMMARY", section))
        subtotal = _as_decimal(data.get("subtotal"))
        if data.get("subtotal") is None:
            subtotal = sum((_as_decimal(l.get("quantity"))*_as_decimal(l.get("unit_price"))
                            for l in lines if isinstance(l,dict)),Decimal(0))
        discount = subtotal*_as_decimal(data.get("discount_percent"))/100
        tax = (subtotal-discount)*_as_decimal(data.get("tax_percent"))/100
        adjustment = _as_decimal(data.get("adjustment"))
        grand = _as_decimal(data.get("amount")) if data.get("amount") is not None else subtotal-discount+tax+adjustment
        currency = data.get("currency") or "INR"
        totals = [("Subtotal",subtotal),("Discount",-discount),("Tax",tax),
                  ("Adjustment",adjustment),("Grand Total",grand)]
        rows = [[Paragraph(_text(label),small),
                 Paragraph(f"{value:,.2f} {_text(currency)}",small)] for label,value in totals]
        table = Table(rows,colWidths=[usable*.25,usable*.25],hAlign="RIGHT")
        table.setStyle(TableStyle([
            ("BOX",(0,0),(-1,-1),.7,colors.HexColor("#CBD5E1")),
            ("INNERGRID",(0,0),(-1,-1),.35,colors.HexColor("#E2E8F0")),
            ("LINEABOVE",(0,-1),(-1,-1),1.3,title_color),
            ("BACKGROUND",(0,-1),(-1,-1),shaded),
            ("TOPPADDING",(0,0),(-1,-1),7),
            ("BOTTOMPADDING",(0,0),(-1,-1),7),
        ]))
        story.append(table)
    for label,key in (("TERMS & CONDITIONS","terms"),("NOTES","notes")):
        if data.get(key):
            story.append(Paragraph(label,section))
            story.append(Paragraph(_text(data[key]),normal))
    def footer(canvas, document):
        canvas.setFont("Helvetica",8)
        canvas.setFillColor(colors.HexColor("#60718D"))
        canvas.drawString(17*mm,12*mm,"CONVOSIS CRM  |  " + TEMPLATES[template][0])
        canvas.drawRightString(pagesize[0]-17*mm,12*mm,str(document.page))
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return output.getvalue()
