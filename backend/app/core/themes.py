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
        "#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
    )
    chart_grid_color: str = "#e2e8f0"
    chart_axis_color: str = "#64748b"


DEFAULT_THEME = Theme(
    name="default",
    font_stack='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    text_color="#0f172a",
    heading_color="#0f172a",
    accent_color="#6366f1",
    border_color="#e2e8f0",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f1f5f9",
    code_text="#0f172a",
    table_header_bg="#f8fafc",
    table_header_color="#0f172a",
    table_border="#e2e8f0",
    blockquote_border="#6366f1",
    blockquote_bg="#f8fafc",
    link_color="#2563eb",
    hr_color="#e2e8f0",
    callout_info_bg="#eff6ff",
    callout_info_border="#2563eb",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#f59e0b",
    callout_success_bg="#f0fdf4",
    callout_success_border="#15803d",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#15803d",
    kpi_delta_negative="#dc2626",
    secondary_text="#64748b",
    line_height="1.6",
)

EXECUTIVE_THEME = Theme(
    name="executive",
    font_stack='Georgia, "Times New Roman", Times, serif',
    text_color="#1a1a2e",
    heading_color="#1a1a2e",
    accent_color="#b8860b",
    border_color="#d4d0c8",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f5f5f0",
    code_text="#1a1a2e",
    table_header_bg="#f5f5f0",
    table_header_color="#1a1a2e",
    table_border="#d4d0c8",
    blockquote_border="#b8860b",
    blockquote_bg="#faf8f5",
    link_color="#1a5276",
    hr_color="#d4d0c8",
    callout_info_bg="#eef2f7",
    callout_info_border="#1a5276",
    callout_warning_bg="#fdf8e8",
    callout_warning_border="#b8860b",
    callout_success_bg="#eef5ee",
    callout_success_border="#2e7d32",
    callout_error_bg="#fdf0f0",
    callout_error_border="#c0392b",
    kpi_delta_positive="#2e7d32",
    kpi_delta_negative="#c0392b",
    secondary_text="#6b7280",
    line_height="1.75",
    chart_colors=(
        "#d4a034", "#2e86c1", "#45b07c", "#c0713c", "#8e6bbf", "#2596be", "#d4a034", "#3aa876",
    ),
    chart_grid_color="#d4d0c8",
    chart_axis_color="#6b7280",
)

MINIMAL_THEME = Theme(
    name="minimal",
    font_stack='"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Consolas, monospace',
    text_color="#1f2937",
    heading_color="#111827",
    accent_color="#111827",
    border_color="#d1d5db",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f3f4f6",
    code_text="#1f2937",
    table_header_bg="#f9fafb",
    table_header_color="#111827",
    table_border="#d1d5db",
    blockquote_border="#9ca3af",
    blockquote_bg="#f9fafb",
    link_color="#1f2937",
    hr_color="#d1d5db",
    callout_info_bg="#f9fafb",
    callout_info_border="#6b7280",
    callout_warning_bg="#fefce8",
    callout_warning_border="#ca8a04",
    callout_success_bg="#f0fdf4",
    callout_success_border="#16a34a",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#16a34a",
    kpi_delta_negative="#dc2626",
    secondary_text="#6b7280",
    line_height="1.5",
    chart_colors=(
        "#374151", "#0891b2", "#d97706", "#059669", "#dc2626", "#7c3aed", "#0d9488", "#b45309",
    ),
    chart_grid_color="#d1d5db",
    chart_axis_color="#6b7280",
)

CORPORATE_THEME = Theme(
    name="corporate",
    font_stack='Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    text_color="#1e293b",
    heading_color="#1e3a5f",
    accent_color="#2563eb",
    border_color="#e2e8f0",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f0f4f8",
    code_text="#1e293b",
    table_header_bg="#f0f4f8",
    table_header_color="#1e3a5f",
    table_border="#cbd5e1",
    blockquote_border="#2563eb",
    blockquote_bg="#f0f4f8",
    link_color="#1d4ed8",
    hr_color="#cbd5e1",
    callout_info_bg="#eff6ff",
    callout_info_border="#2563eb",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#d97706",
    callout_success_bg="#ecfdf5",
    callout_success_border="#059669",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#059669",
    kpi_delta_negative="#dc2626",
    secondary_text="#64748b",
    line_height="1.6",
    chart_colors=(
        "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488",
    ),
    chart_grid_color="#e2e8f0",
    chart_axis_color="#64748b",
)

DASHBOARD_THEME = Theme(
    name="dashboard",
    font_stack='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    text_color="#e2e8f0",
    heading_color="#f1f5f9",
    accent_color="#06b6d4",
    border_color="#334155",
    bg_color="#0f172a",
    card_bg="#1e293b",
    code_bg="#1e293b",
    code_text="#e2e8f0",
    table_header_bg="#1e293b",
    table_header_color="#94a3b8",
    table_border="#334155",
    blockquote_border="#06b6d4",
    blockquote_bg="#1e293b",
    link_color="#38bdf8",
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
    line_height="1.5",
    chart_colors=(
        "#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316",
    ),
    chart_grid_color="#334155",
    chart_axis_color="#94a3b8",
)

PRESENTATION_THEME = Theme(
    name="presentation",
    font_stack='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    text_color="#1e1b4b",
    heading_color="#1e1b4b",
    accent_color="#7c3aed",
    border_color="#e0e7ff",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f5f3ff",
    code_text="#1e1b4b",
    table_header_bg="#f5f3ff",
    table_header_color="#1e1b4b",
    table_border="#c7d2fe",
    blockquote_border="#7c3aed",
    blockquote_bg="#f5f3ff",
    link_color="#6d28d9",
    hr_color="#c7d2fe",
    callout_info_bg="#eef2ff",
    callout_info_border="#6366f1",
    callout_warning_bg="#fffbeb",
    callout_warning_border="#f59e0b",
    callout_success_bg="#ecfdf5",
    callout_success_border="#059669",
    callout_error_bg="#fef2f2",
    callout_error_border="#dc2626",
    kpi_delta_positive="#059669",
    kpi_delta_negative="#dc2626",
    secondary_text="#6b7280",
    line_height="1.8",
    chart_colors=(
        "#7c3aed", "#2563eb", "#059669", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
    ),
    chart_grid_color="#e0e7ff",
    chart_axis_color="#6b7280",
)

EARTH_THEME = Theme(
    name="earth",
    font_stack='Georgia, "Times New Roman", Times, serif',
    text_color="#292524",
    heading_color="#1c1917",
    accent_color="#166534",
    border_color="#c4a97d",
    bg_color="transparent",
    card_bg="#faf5eb",
    code_bg="#f5f0e6",
    code_text="#292524",
    table_header_bg="#f5f0e6",
    table_header_color="#1c1917",
    table_border="#c4a97d",
    blockquote_border="#166534",
    blockquote_bg="#f5f0e6",
    link_color="#166534",
    hr_color="#c4a97d",
    callout_info_bg="#ecfdf5",
    callout_info_border="#166534",
    callout_warning_bg="#fef9c3",
    callout_warning_border="#a16207",
    callout_success_bg="#ecfdf5",
    callout_success_border="#15803d",
    callout_error_bg="#fef2f2",
    callout_error_border="#b91c1c",
    kpi_delta_positive="#15803d",
    kpi_delta_negative="#b91c1c",
    secondary_text="#78716c",
    line_height="1.7",
    chart_colors=(
        "#2d9f6f", "#c78533", "#3b7fc4", "#b86342", "#7a6bbf", "#1f9e8f", "#c4982a", "#4a82b0",
    ),
    chart_grid_color="#c4a97d",
    chart_axis_color="#78716c",
)

HIGHCONTRAST_THEME = Theme(
    name="highcontrast",
    font_stack='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    text_color="#000000",
    heading_color="#000000",
    accent_color="#0066cc",
    border_color="#000000",
    bg_color="transparent",
    card_bg="#ffffff",
    code_bg="#f0f0f0",
    code_text="#000000",
    table_header_bg="#e0e0e0",
    table_header_color="#000000",
    table_border="#000000",
    blockquote_border="#0066cc",
    blockquote_bg="#f0f0f0",
    link_color="#0066cc",
    hr_color="#000000",
    callout_info_bg="#cce5ff",
    callout_info_border="#004499",
    callout_warning_bg="#fff3cd",
    callout_warning_border="#856404",
    callout_success_bg="#d4edda",
    callout_success_border="#155724",
    callout_error_bg="#f8d7da",
    callout_error_border="#721c24",
    kpi_delta_positive="#155724",
    kpi_delta_negative="#721c24",
    secondary_text="#333333",
    line_height="1.6",
    chart_colors=(
        "#0066cc", "#cc0000", "#009933", "#cc6600", "#6600cc", "#006666", "#990066", "#336600",
    ),
    chart_grid_color="#cccccc",
    chart_axis_color="#333333",
)

THEMES: dict[str, Theme] = {
    "default": DEFAULT_THEME,
    "executive": EXECUTIVE_THEME,
    "minimal": MINIMAL_THEME,
    "corporate": CORPORATE_THEME,
    "dashboard": DASHBOARD_THEME,
    "presentation": PRESENTATION_THEME,
    "earth": EARTH_THEME,
    "highcontrast": HIGHCONTRAST_THEME,
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
