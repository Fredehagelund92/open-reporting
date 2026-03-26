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
    chart_default_width: str = "100%"
    chart_viewbox_width: int = 760
    number_font: str = "Inter, ui-sans-serif, system-ui, sans-serif"
    density: str = "standard"
    heading_scale: float = 1.333
    kpi_card_min_width: str = "160px"
    table_number_align: str = "left"


CORPORATE_THEME = Theme(
    name="corporate",
    font_stack="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    text_color="#0f172a",
    heading_color="#0f172a",
    accent_color="#1d4ed8",
    border_color="#e2e8f0",
    bg_color="#ffffff",
    card_bg="#f8fafc",
    code_bg="#f1f5f9",
    code_text="#0f172a",
    table_header_bg="#f8fafc",
    table_header_color="#0f172a",
    table_border="#e2e8f0",
    blockquote_border="#1d4ed8",
    blockquote_bg="#eff6ff",
    link_color="#1d4ed8",
    hr_color="#e2e8f0",
    callout_info_bg="#eff6ff",
    callout_info_border="#1d4ed8",
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
        "#1d4ed8", "#06b6d4", "#8b5cf6", "#f59e0b",
        "#60a5fa", "#22d3ee", "#a78bfa", "#fbbf24",
    ),
    chart_grid_color="#e2e8f0",
    chart_axis_color="#64748b",
    number_font="Inter, ui-sans-serif, system-ui, sans-serif",
    density="standard",
    heading_scale=1.333,
    kpi_card_min_width="160px",
    table_number_align="left",
)

DEFAULT_THEME = CORPORATE_THEME

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
    number_font="Inter, ui-sans-serif, system-ui, sans-serif",
    density="standard",
    heading_scale=1.333,
    kpi_card_min_width="160px",
    table_number_align="left",
)

EXECUTIVE_THEME = Theme(
    name="executive",
    font_stack="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    text_color="#1a1a2e",
    heading_color="#1a1a2e",
    accent_color="#2563eb",
    border_color="#e5e7eb",
    bg_color="#ffffff",
    card_bg="#f9fafb",
    code_bg="#f3f4f6",
    code_text="#1a1a2e",
    table_header_bg="#f9fafb",
    table_header_color="#1a1a2e",
    table_border="#e5e7eb",
    blockquote_border="#2563eb",
    blockquote_bg="#eff6ff",
    link_color="#2563eb",
    hr_color="#e5e7eb",
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
    secondary_text="#6b7280",
    line_height="1.75",
    chart_colors=(
        "#1e3a5f", "#2563eb", "#60a5fa", "#93c5fd",
        "#0d9488", "#34d399", "#f59e0b", "#fbbf24",
    ),
    chart_grid_color="#e5e7eb",
    chart_axis_color="#6b7280",
    number_font="Inter, ui-sans-serif, system-ui, sans-serif",
    density="spacious",
    heading_scale=1.5,
    kpi_card_min_width="200px",
    table_number_align="left",
)

FINANCIAL_THEME = Theme(
    name="financial",
    font_stack="'Tabular Mono', ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
    text_color="#0f1923",
    heading_color="#0f1923",
    accent_color="#334e68",
    border_color="#d1d5db",
    bg_color="#ffffff",
    card_bg="#f8f9fa",
    code_bg="#eef0f2",
    code_text="#0f1923",
    table_header_bg="#e9ecef",
    table_header_color="#0f1923",
    table_border="#ced4da",
    blockquote_border="#334e68",
    blockquote_bg="#f0f4f8",
    link_color="#334e68",
    hr_color="#d1d5db",
    callout_info_bg="#f0f4f8",
    callout_info_border="#334e68",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#d97706",
    callout_success_bg="#f0fdf4",
    callout_success_border="#16a34a",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#16a34a",
    kpi_delta_negative="#dc2626",
    secondary_text="#6b7280",
    line_height="1.5",
    chart_colors=(
        "#334e68", "#486581", "#627d98", "#829ab1",
        "#9fb3c8", "#bcccdc", "#d9e2ec", "#f0f4f8",
    ),
    chart_grid_color="#d1d5db",
    chart_axis_color="#6b7280",
    number_font="'Tabular Mono', ui-monospace, monospace",
    density="compact",
    heading_scale=1.25,
    kpi_card_min_width="140px",
    table_number_align="right",
)

CONSULTING_THEME = Theme(
    name="consulting",
    font_stack="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    text_color="#0d1b2a",
    heading_color="#0d1b2a",
    accent_color="#0f4c75",
    border_color="#e2e8f0",
    bg_color="#ffffff",
    card_bg="#f8fafc",
    code_bg="#f1f5f9",
    code_text="#0d1b2a",
    table_header_bg="#f1f5f9",
    table_header_color="#0d1b2a",
    table_border="#e2e8f0",
    blockquote_border="#0f4c75",
    blockquote_bg="#f0f7ff",
    link_color="#0f4c75",
    hr_color="#e2e8f0",
    callout_info_bg="#f0f7ff",
    callout_info_border="#0f4c75",
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
        "#0f4c75", "#1b6ca8", "#15919b", "#1aaf9e",
        "#2dcec9", "#f59e0b", "#ef4444", "#8b5cf6",
    ),
    chart_grid_color="#e2e8f0",
    chart_axis_color="#64748b",
    number_font="Inter, ui-sans-serif, system-ui, sans-serif",
    density="standard",
    heading_scale=1.333,
    kpi_card_min_width="160px",
    table_number_align="left",
)

TECHNICAL_THEME = Theme(
    name="technical",
    font_stack="'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
    text_color="#1c1c1c",
    heading_color="#111111",
    accent_color="#374151",
    border_color="#d1d5db",
    bg_color="#ffffff",
    card_bg="#f9fafb",
    code_bg="#f3f4f6",
    code_text="#1c1c1c",
    table_header_bg="#f3f4f6",
    table_header_color="#111111",
    table_border="#d1d5db",
    blockquote_border="#6b7280",
    blockquote_bg="#f9fafb",
    link_color="#374151",
    hr_color="#d1d5db",
    callout_info_bg="#f3f4f6",
    callout_info_border="#6b7280",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#d97706",
    callout_success_bg="#f0fdf4",
    callout_success_border="#16a34a",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#16a34a",
    kpi_delta_negative="#dc2626",
    secondary_text="#6b7280",
    line_height="1.5",
    chart_colors=(
        "#374151", "#6b7280", "#9ca3af", "#d1d5db",
        "#4b5563", "#111827", "#1f2937", "#e5e7eb",
    ),
    chart_grid_color="#e5e7eb",
    chart_axis_color="#9ca3af",
    number_font="'JetBrains Mono', ui-monospace, monospace",
    density="compact",
    heading_scale=1.25,
    kpi_card_min_width="140px",
    table_number_align="right",
)

EDITORIAL_THEME = Theme(
    name="editorial",
    font_stack="Georgia, Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    text_color="#1a1a1a",
    heading_color="#1a1a1a",
    accent_color="#9b2335",
    border_color="#d6cfc7",
    bg_color="#faf8f5",
    card_bg="#f3ede6",
    code_bg="#ede8e1",
    code_text="#1a1a1a",
    table_header_bg="#ede8e1",
    table_header_color="#1a1a1a",
    table_border="#d6cfc7",
    blockquote_border="#9b2335",
    blockquote_bg="#f3ede6",
    link_color="#9b2335",
    hr_color="#d6cfc7",
    callout_info_bg="#f3ede6",
    callout_info_border="#9b2335",
    callout_warning_bg="#fef9f0",
    callout_warning_border="#c2853a",
    callout_success_bg="#f0fdf4",
    callout_success_border="#16a34a",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#16a34a",
    kpi_delta_negative="#dc2626",
    secondary_text="#6b6560",
    line_height="1.8",
    chart_colors=(
        "#9b2335", "#c2853a", "#4a6741", "#2d5a8e",
        "#7b3f6e", "#b85c38", "#3d7a8a", "#8b7355",
    ),
    chart_grid_color="#d6cfc7",
    chart_axis_color="#8a8078",
    number_font="Georgia, Charter, serif",
    density="spacious",
    heading_scale=1.333,
    kpi_card_min_width="180px",
    table_number_align="left",
)

THEMES: dict[str, Theme] = {
    "default": CORPORATE_THEME,
    "dark": DARK_THEME,
    "executive": EXECUTIVE_THEME,
    "financial": FINANCIAL_THEME,
    "consulting": CONSULTING_THEME,
    "technical": TECHNICAL_THEME,
    "editorial": EDITORIAL_THEME,
}


LAYOUT_WIDTHS: dict[str, str] = {
    "narrow": "680px",
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
