"""
Theme definitions for server-side rendered reports.

Each theme is a dataclass providing design tokens that renderers use
to apply inline styles to Markdown/JSON-rendered HTML.
"""

import dataclasses
from dataclasses import dataclass


@dataclass(frozen=True)
class Theme:
    name: str
    font_stack: str
    text_color: str
    heading_color: str
    accent_color: str
    border_color: str
    bg_color: str
    card_bg: str
    code_bg: str
    code_text: str
    table_header_bg: str
    table_header_color: str
    table_border: str
    blockquote_border: str
    blockquote_bg: str
    link_color: str
    hr_color: str
    callout_info_bg: str
    callout_info_border: str
    callout_warning_bg: str
    callout_warning_border: str
    callout_success_bg: str
    callout_success_border: str
    callout_error_bg: str
    callout_error_border: str
    kpi_delta_positive: str
    kpi_delta_negative: str
    secondary_text: str
    line_height: str
    chart_colors: tuple[str, ...] = (
        "#4f46e5", "#818cf8", "#c7d2fe", "#0891b2", "#67e8f9", "#d4a017", "#fbbf24", "#fde68a",
    )
    chart_grid_color: str = "#e2e8f0"
    chart_axis_color: str = "#64748b"


DEFAULT_THEME = Theme(
    name="default",
    font_stack="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    text_color="#0f172a",
    heading_color="#0f172a",
    accent_color="#2563eb",
    border_color="#e2e8f0",
    bg_color="#ffffff",
    card_bg="#f8fafc",
    code_bg="#f1f5f9",
    code_text="#0f172a",
    table_header_bg="#f8fafc",
    table_header_color="#0f172a",
    table_border="#e2e8f0",
    blockquote_border="#2563eb",
    blockquote_bg="#eff6ff",
    link_color="#2563eb",
    hr_color="#e2e8f0",
    callout_info_bg="#eff6ff",
    callout_info_border="#2563eb",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#f59e0b",
    callout_success_bg="#f0fdf4",
    callout_success_border="#22c55e",
    callout_error_bg="#fef2f2",
    callout_error_border="#ef4444",
    kpi_delta_positive="#16a34a",
    kpi_delta_negative="#dc2626",
    secondary_text="#64748b",
    line_height="1.6",
    chart_colors=(
        "#2563eb", "#06b6d4", "#8b5cf6", "#f59e0b",
        "#60a5fa", "#22d3ee", "#a78bfa", "#fbbf24",
    ),
    chart_grid_color="#e2e8f0",
    chart_axis_color="#64748b",
)

DARK_THEME = Theme(
    name="dark",
    font_stack="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    text_color="#e2e8f0",
    heading_color="#f8fafc",
    accent_color="#3b82f6",
    border_color="#334155",
    bg_color="#0f172a",
    card_bg="#1e293b",
    code_bg="#1e293b",
    code_text="#e2e8f0",
    table_header_bg="#1e293b",
    table_header_color="#94a3b8",
    table_border="#334155",
    blockquote_border="#3b82f6",
    blockquote_bg="#1e293b",
    link_color="#60a5fa",
    hr_color="#334155",
    callout_info_bg="#0c4a6e",
    callout_info_border="#0ea5e9",
    callout_warning_bg="#451a03",
    callout_warning_border="#f59e0b",
    callout_success_bg="#052e16",
    callout_success_border="#22c55e",
    callout_error_bg="#450a0a",
    callout_error_border="#ef4444",
    kpi_delta_positive="#22c55e",
    kpi_delta_negative="#ef4444",
    secondary_text="#94a3b8",
    line_height="1.6",
    chart_colors=(
        "#3b82f6", "#22d3ee", "#a78bfa", "#fbbf24",
        "#60a5fa", "#67e8f9", "#c4b5fd", "#fde68a",
    ),
    chart_grid_color="#334155",
    chart_axis_color="#94a3b8",
)

THEMES: dict[str, Theme] = {
    "default": DEFAULT_THEME,
    "dark": DARK_THEME,
}


LAYOUT_WIDTHS: dict[str, str] = {
    "narrow": "720px",
    "standard": "960px",
    "wide": "1200px",
    "full": "100%",
}


def get_theme(name: str | None) -> Theme:
    """Return the named theme, falling back to default."""
    return THEMES.get(name or "default", DEFAULT_THEME)


def get_layout_width(layout: str | None) -> str:
    """Return the CSS max-width for a layout name, defaulting to standard."""
    return LAYOUT_WIDTHS.get(layout or "standard", LAYOUT_WIDTHS["standard"])


def apply_brand_overrides(theme: Theme, overrides: dict) -> Theme:
    """Return a new Theme with brand overrides applied.

    Only keys that exist on the Theme dataclass and have non-None values
    in *overrides* are replaced.
    """
    valid_keys = {f.name for f in dataclasses.fields(Theme)}
    filtered = {k: v for k, v in overrides.items() if k in valid_keys and v is not None}
    if not filtered:
        return theme
    return dataclasses.replace(theme, **filtered)
