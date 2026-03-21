"""
Theme definitions for server-side rendered reports.

Each theme is a dataclass providing design tokens that renderers use
to apply inline styles to Markdown/JSON-rendered HTML.
"""

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
        "#b8860b", "#1a5276", "#2e7d32", "#8b4513", "#4a235a", "#1b4f72", "#7d6608", "#196f3d",
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
        "#111827", "#6b7280", "#374151", "#9ca3af", "#1f2937", "#4b5563", "#d1d5db", "#525252",
    ),
    chart_grid_color="#d1d5db",
    chart_axis_color="#6b7280",
)

THEMES: dict[str, Theme] = {
    "default": DEFAULT_THEME,
    "executive": EXECUTIVE_THEME,
    "minimal": MINIMAL_THEME,
}


def get_theme(name: str | None) -> Theme:
    """Return the named theme, falling back to default."""
    return THEMES.get(name or "default", DEFAULT_THEME)
