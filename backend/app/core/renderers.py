"""
Server-side renderers for Markdown and structured JSON content.

Converts agent-submitted Markdown or JSON sections into fully inline-styled
HTML that the frontend can render identically to hand-crafted HTML reports.
"""

import json
from html import escape
from html.parser import HTMLParser

import mistune

from app.core.chart_validation import normalize_chart_values, validate_chart_section
from app.core.svg_charts import svg_area_chart, svg_bar_chart, svg_line_chart, svg_pie_chart
from app.core.themes import Theme, get_theme


# ---------------------------------------------------------------------------
# Markdown → HTML
# ---------------------------------------------------------------------------


_CHART_RENDERERS = {
    "bar-chart": svg_bar_chart,
    "line-chart": svg_line_chart,
    "area-chart": svg_area_chart,
    "pie-chart": svg_pie_chart,
}


def _try_render_chart_block(code: str, theme: Theme) -> str | None:
    """Try to render a ```chart fenced code block. Returns None if not a chart block."""
    try:
        spec = json.loads(code)
    except (json.JSONDecodeError, ValueError):
        return f'<pre style="color:#dc2626;">Invalid chart JSON</pre>'

    chart_type = spec.get("type", "")
    svg_fn = _CHART_RENDERERS.get(chart_type)
    if not svg_fn:
        return f'<pre style="color:#dc2626;">Unknown chart type: {escape(chart_type)}</pre>'

    section = {"type": chart_type, "data": spec.get("data", {}), "heading": spec.get("heading", "")}
    return _render_chart_section(section, theme, svg_fn)


def _create_markdown_renderer(theme: Theme):
    """Create a mistune Markdown instance with chart code block support."""
    md = mistune.create_markdown(plugins=["table", "strikethrough"])

    # Wrap the default renderer's block_code to intercept chart blocks
    original_block_code = md.renderer.block_code

    def patched_block_code(code, info=None, **attrs):
        if info and info.strip().lower() == "chart":
            result = _try_render_chart_block(code, theme)
            if result is not None:
                return result
        return original_block_code(code, info=info, **attrs)

    md.renderer.block_code = patched_block_code
    return md


def render_markdown_to_html(markdown: str, theme: str | None = "default") -> str:
    """Render Markdown (GFM) to themed, inline-styled HTML."""
    t = get_theme(theme)
    md = _create_markdown_renderer(t)
    raw_html = md(markdown)
    styled = _apply_inline_styles(raw_html, t)
    return _wrap_container(styled, t)


# ---------------------------------------------------------------------------
# Structured JSON → HTML
# ---------------------------------------------------------------------------

# Section type → renderer function
_SECTION_RENDERERS: dict[str, "_SectionRenderer"] = {}


class _SectionRenderer:
    """Registry decorator for section type renderers."""


def _section(section_type: str):
    """Decorator to register a section renderer."""
    def decorator(fn):
        _SECTION_RENDERERS[section_type] = fn
        return fn
    return decorator


def render_structured_to_html(
    sections: list[dict], theme: str | None = "default"
) -> str:
    """Render a list of typed section dicts to themed HTML."""
    t = get_theme(theme)
    fragments: list[str] = []
    for section in sections:
        sec_type = section.get("type", "text")
        renderer = _SECTION_RENDERERS.get(sec_type)
        if renderer:
            fragments.append(renderer(section, t))
        else:
            fragments.append(
                f'<p style="color:{t.text_color};">'
                f"Unknown section type: {escape(sec_type)}</p>"
            )
    return _wrap_container("\n".join(fragments), t)


# --- Section renderers ---


@_section("text")
def _render_text(section: dict, t: Theme) -> str:
    heading = section.get("heading", "")
    body = section.get("body", "")
    parts: list[str] = []
    if heading:
        parts.append(
            f'<h2 style="font-size:22px; font-weight:700; color:{t.heading_color}; '
            f'border-bottom:2px solid {t.border_color}; padding-bottom:8px; '
            f'margin:24px 0 12px;">{escape(heading)}</h2>'
        )
    # Body can contain markdown
    if body:
        rendered = mistune.html(body)
        parts.append(_apply_inline_styles(rendered, t))
    return "\n".join(parts)


@_section("kpi-grid")
def _render_kpi_grid(section: dict, t: Theme) -> str:
    metrics = section.get("metrics", [])
    cards: list[str] = []
    for m in metrics:
        label = escape(str(m.get("label", "")))
        value = escape(str(m.get("value", "")))
        delta = m.get("delta", "")
        trend = m.get("trend", "")

        delta_color = t.kpi_delta_positive
        if trend == "down" or (isinstance(delta, str) and delta.startswith("-")):
            delta_color = t.kpi_delta_negative

        delta_html = ""
        if delta:
            delta_html = (
                f'<div style="margin-top:4px; font-size:13px; color:{delta_color}; '
                f'font-weight:600;">{escape(str(delta))}</div>'
            )

        cards.append(
            f'<div style="flex:1 1 180px; background:{t.card_bg}; border:1px solid {t.border_color}; '
            f'border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">'
            f'<div style="margin:0 0 8px; font-size:14px; text-transform:uppercase; '
            f'letter-spacing:0.05em; color:{t.secondary_text};">{label}</div>'
            f'<div style="font-size:32px; font-weight:800; color:{t.heading_color};">{value}</div>'
            f'{delta_html}'
            f'</div>'
        )
    return (
        f'<div style="display:flex; gap:20px; flex-wrap:wrap; margin:20px 0;">'
        f'{"".join(cards)}'
        f'</div>'
    )


@_section("table")
def _render_table(section: dict, t: Theme) -> str:
    headers = section.get("headers", [])
    rows = section.get("rows", [])
    caption = section.get("caption", "")

    header_cells = "".join(
        f'<th style="text-align:left; padding:10px 12px; font-weight:600; '
        f'background:{t.table_header_bg}; color:{t.table_header_color}; '
        f'border-bottom:2px solid {t.table_border};">{escape(str(h))}</th>'
        for h in headers
    )

    body_rows: list[str] = []
    for row in rows:
        cells = "".join(
            f'<td style="padding:10px 12px; border-bottom:1px solid {t.table_border}; '
            f'color:{t.text_color};">{escape(str(cell))}</td>'
            for cell in row
        )
        body_rows.append(f"<tr>{cells}</tr>")

    caption_html = ""
    if caption:
        caption_html = (
            f'<caption style="caption-side:bottom; text-align:left; padding:8px 0; '
            f'font-size:13px; color:{t.secondary_text};">{escape(caption)}</caption>'
        )

    return (
        f'<table style="width:100%; border-collapse:collapse; margin:16px 0;">'
        f'{caption_html}'
        f'<thead><tr>{header_cells}</tr></thead>'
        f'<tbody>{"".join(body_rows)}</tbody>'
        f'</table>'
    )


@_section("callout")
def _render_callout(section: dict, t: Theme) -> str:
    callout_type = section.get("callout_type", section.get("type_detail", "info"))
    message = section.get("message", "")

    color_map = {
        "info": (t.callout_info_bg, t.callout_info_border),
        "warning": (t.callout_warning_bg, t.callout_warning_border),
        "success": (t.callout_success_bg, t.callout_success_border),
        "error": (t.callout_error_bg, t.callout_error_border),
    }
    bg, border = color_map.get(callout_type, color_map["info"])

    label_map = {
        "info": "Info",
        "warning": "Warning",
        "success": "Success",
        "error": "Error",
    }
    label = label_map.get(callout_type, "Note")

    return (
        f'<div style="padding:16px; border-left:4px solid {border}; background:{bg}; '
        f'border-radius:8px; margin:16px 0; color:{t.text_color};">'
        f'<strong>{label}:</strong> {escape(message)}'
        f'</div>'
    )


def _render_chart_section(section: dict, t: Theme, svg_fn) -> str:
    """Shared renderer for all chart section types.

    Produces a ``<div data-or-chart="...">`` wrapper containing the themed SVG.
    """
    section = normalize_chart_values(section)
    validation_errors = [e for e in validate_chart_section(section) if e.severity == "error"]

    if validation_errors:
        messages = "; ".join(e.message for e in validation_errors)
        heading = section.get("heading", "")
        heading_html = ""
        if heading:
            heading_html = (
                f'<h3 style="font-size:18px; font-weight:600; color:{t.heading_color}; '
                f'margin:24px 0 8px;">{escape(heading)}</h3>'
            )
        return (
            f'{heading_html}'
            f'<div style="padding:16px; border:2px dashed {t.callout_error_border}; '
            f'border-radius:8px; margin:16px 0; color:{t.text_color}; background:{t.callout_error_bg};">'
            f'<strong>Chart data error:</strong> {escape(messages)}</div>'
        )

    heading = section.get("heading", "")
    chart_json = json.dumps({"type": section["type"], "data": section.get("data", {})})
    svg_fallback = svg_fn(section.get("data", {}), t)

    heading_html = ""
    if heading:
        heading_html = (
            f'<h3 style="font-size:18px; font-weight:600; color:{t.heading_color}; '
            f'margin:24px 0 8px;">{escape(heading)}</h3>'
        )

    return (
        f'{heading_html}'
        f'<div data-or-chart=\'{escape(chart_json, quote=False)}\' '
        f'style="width:100%; min-height:250px; margin:16px 0;">'
        f'{svg_fallback}'
        f'</div>'
    )


@_section("bar-chart")
def _render_bar_chart(section: dict, t: Theme) -> str:
    # Support legacy flat schema: {labels, values, color} → new {data: {labels, datasets}}
    if "data" not in section and "values" in section:
        section = {
            **section,
            "data": {
                "labels": section.get("labels", []),
                "datasets": [{"name": "Value", "values": section.get("values", [])}],
            },
        }
    return _render_chart_section(section, t, svg_bar_chart)


@_section("line-chart")
def _render_line_chart(section: dict, t: Theme) -> str:
    return _render_chart_section(section, t, svg_line_chart)


@_section("area-chart")
def _render_area_chart(section: dict, t: Theme) -> str:
    return _render_chart_section(section, t, svg_area_chart)


@_section("pie-chart")
def _render_pie_chart(section: dict, t: Theme) -> str:
    return _render_chart_section(section, t, svg_pie_chart)


@_section("timeline")
def _render_timeline(section: dict, t: Theme) -> str:
    events = section.get("events", [])
    items: list[str] = []
    for event in events:
        date = escape(str(event.get("date", "")))
        title = escape(str(event.get("title", "")))
        desc = event.get("description", "")
        desc_html = f'<p style="margin:4px 0 0; color:{t.secondary_text}; font-size:14px;">{escape(desc)}</p>' if desc else ""

        items.append(
            f'<div style="display:flex; gap:16px; margin-bottom:20px;">'
            f'<div style="display:flex; flex-direction:column; align-items:center; min-width:20px;">'
            f'<div style="width:12px; height:12px; border-radius:50%; background:{t.accent_color}; flex-shrink:0;"></div>'
            f'<div style="width:2px; flex:1; background:{t.border_color};"></div>'
            f'</div>'
            f'<div style="padding-bottom:4px;">'
            f'<div style="font-size:12px; color:{t.secondary_text}; text-transform:uppercase; letter-spacing:0.05em;">{date}</div>'
            f'<div style="font-weight:600; color:{t.heading_color}; margin-top:2px;">{title}</div>'
            f'{desc_html}'
            f'</div>'
            f'</div>'
        )
    return f'<div style="margin:20px 0;">{"".join(items)}</div>'


@_section("action-items")
def _render_action_items(section: dict, t: Theme) -> str:
    items = section.get("items", [])
    headers = ["Action", "Owner", "Due", "Impact"]
    rows = []
    for item in items:
        rows.append([
            item.get("action", ""),
            item.get("owner", ""),
            item.get("due", ""),
            item.get("impact", ""),
        ])
    return _render_table({"headers": headers, "rows": rows}, t)


# ---------------------------------------------------------------------------
# Inline style post-processor
# ---------------------------------------------------------------------------


class _InlineStyler(HTMLParser):
    """Post-processes rendered HTML to add inline styles from a theme."""

    def __init__(self, theme: Theme) -> None:
        super().__init__()
        self.t = theme
        self.output: list[str] = []

    def _style_map(self) -> dict[str, str]:
        t = self.t
        return {
            "h1": (
                f"font-size:34px; font-weight:800; color:{t.heading_color}; "
                f"margin:0 0 16px; letter-spacing:-0.025em; line-height:1.2;"
            ),
            "h2": (
                f"font-size:22px; font-weight:700; color:{t.heading_color}; "
                f"border-bottom:2px solid {t.border_color}; padding-bottom:8px; "
                f"margin:28px 0 12px;"
            ),
            "h3": (
                f"font-size:18px; font-weight:600; color:{t.heading_color}; "
                f"margin:24px 0 8px;"
            ),
            "h4": (
                f"font-size:16px; font-weight:600; color:{t.heading_color}; "
                f"margin:20px 0 8px;"
            ),
            "p": f"font-size:16px; color:{t.text_color}; margin:0 0 12px; line-height:{t.line_height};",
            "ul": f"color:{t.text_color}; margin:0 0 16px; padding-left:24px; list-style-type:disc;",
            "ol": f"color:{t.text_color}; margin:0 0 16px; padding-left:24px; list-style-type:decimal;",
            "li": f"margin-bottom:6px; line-height:{t.line_height}; display:list-item;",
            "a": f"color:{t.link_color}; text-decoration:underline;",
            "blockquote": (
                f"border-left:4px solid {t.blockquote_border}; background:{t.blockquote_bg}; "
                f"margin:16px 0; padding:12px 16px; border-radius:0 8px 8px 0;"
            ),
            "code": (
                f"background:{t.code_bg}; color:{t.code_text}; padding:2px 6px; "
                f"border-radius:4px; font-size:14px;"
            ),
            "pre": (
                f"background:{t.code_bg}; color:{t.code_text}; padding:16px; "
                f"border-radius:8px; overflow-x:auto; margin:16px 0; font-size:14px; "
                f"line-height:1.5;"
            ),
            "table": (
                f"width:100%; border-collapse:collapse; margin:16px 0;"
            ),
            "th": (
                f"text-align:left; padding:10px 12px; font-weight:600; "
                f"background:{t.table_header_bg}; color:{t.table_header_color}; "
                f"border-bottom:2px solid {t.table_border};"
            ),
            "td": (
                f"padding:10px 12px; border-bottom:1px solid {t.table_border}; "
                f"color:{t.text_color};"
            ),
            "hr": (
                f"border:none; border-top:1px solid {t.hr_color}; margin:32px 0;"
            ),
            "img": "max-width:100%; height:auto; border-radius:8px; margin:12px 0;",
            "strong": f"font-weight:700; color:{t.heading_color};",
        }

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        style_map = self._style_map()

        attr_dict = dict(attrs)
        existing_style = attr_dict.get("style", "")

        theme_style = style_map.get(tag_lower, "")

        # For <code> inside <pre>, skip the inline code style
        # (pre already has its own styling)
        if tag_lower == "code" and existing_style:
            theme_style = ""

        # Merge: theme styles first, then existing (so existing overrides)
        if theme_style and existing_style:
            merged = f"{theme_style} {existing_style}"
        elif theme_style:
            merged = theme_style
        else:
            merged = existing_style

        # Rebuild attrs
        new_attrs: list[str] = []
        style_written = False
        for key, val in attrs:
            if key.lower() == "style":
                new_attrs.append(f'style="{merged}"')
                style_written = True
            else:
                if val is None:
                    new_attrs.append(key)
                else:
                    new_attrs.append(f'{key}="{val}"')

        if merged and not style_written:
            new_attrs.append(f'style="{merged}"')

        attr_str = " " + " ".join(new_attrs) if new_attrs else ""
        self.output.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag: str) -> None:
        self.output.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.output.append(data)

    def handle_entityref(self, name: str) -> None:
        self.output.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.output.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.output.append(f"<!--{data}-->")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # Self-closing tags: <hr/>, <br/>, <img/>, and SVG elements
        # like <line/>, <rect/>, <circle/>.  Must preserve the self-closing
        # form so SVG elements don't become unclosed opening tags.
        self.handle_starttag(tag, attrs)
        if self.output and self.output[-1].endswith(">"):
            self.output[-1] = self.output[-1][:-1] + " />"


def _apply_inline_styles(html: str, theme: Theme) -> str:
    """Post-process rendered HTML to add theme inline styles to every element."""
    styler = _InlineStyler(theme)
    styler.feed(html)
    return "".join(styler.output)


def _wrap_container(inner_html: str, theme: Theme) -> str:
    """Wrap rendered content in a themed container div."""
    return (
        f'<div style="font-family:{theme.font_stack}; color:{theme.text_color}; '
        f'line-height:{theme.line_height}; max-width:800px; margin:0 auto;">'
        f'{inner_html}'
        f'</div>'
    )
