"""
Static SVG chart generators for server-side rendering.

Each function produces a self-contained SVG string suitable for embedding
in HTML. These serve as fallbacks that display without JavaScript.
"""

import math
from html import escape

from app.core.themes import Theme


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _fmt_val(val: float) -> str:
    """Format a chart value label with precision scaled to magnitude."""
    if abs(val) >= 1_000_000:
        return f"{val / 1_000_000:.1f}M"
    if abs(val) >= 1_000:
        return f"{val / 1_000:.1f}K"
    if val == int(val):
        return str(int(val))
    if abs(val) < 1:
        return f"{val:.3f}"
    if abs(val) < 10:
        return f"{val:.2f}"
    return f"{val:.1f}"


_CHART_WIDTH = 760
_CHART_HEIGHT = 380
_PAD_LEFT = 8
_PAD_RIGHT = 32
_PAD_TOP = 40
_PAD_BOTTOM = 60


def _smart_baseline(min_val: float, max_val: float) -> float:
    """Return a non-zero baseline when values are clustered far from 0."""
    if min_val <= 0 or min_val <= max_val * 0.6:
        return 0.0
    span = max_val - min_val
    if span <= 0:
        return 0.0
    magnitude = 10 ** math.floor(math.log10(span))
    return math.floor(min_val / magnitude) * magnitude


def _nice_ticks(max_val: float, count: int = 5, min_val: float = 0.0) -> list[float]:
    """Generate evenly-spaced round tick values from min_val to >= max_val."""
    if max_val <= min_val:
        return [min_val]
    raw_step = (max_val - min_val) / count
    magnitude = 10 ** math.floor(math.log10(raw_step)) if raw_step > 0 else 1
    nice_step = math.ceil(raw_step / magnitude) * magnitude
    return [min_val + i * nice_step for i in range(count + 1)]


def _y_axis_and_grid(ticks: list[float], plot_top: float, plot_bottom: float, theme: Theme) -> str:
    """Render horizontal grid lines (y-axis number labels removed for alignment)."""
    parts: list[str] = []
    min_tick = ticks[0] if ticks else 0
    max_tick = ticks[-1] if ticks else 1
    tick_range = max_tick - min_tick
    for tick in ticks:
        if tick_range == 0:
            y = plot_bottom
        else:
            y = plot_bottom - ((tick - min_tick) / tick_range) * (plot_bottom - plot_top)
        parts.append(
            f'<line x1="{_PAD_LEFT}" y1="{y:.1f}" x2="{_CHART_WIDTH - _PAD_RIGHT}" '
            f'y2="{y:.1f}" stroke="{theme.chart_grid_color}" stroke-dasharray="4,4" stroke-opacity="0.5" />'
        )
    return "\n".join(parts)


def _legend(names: list[str], colors: list[str], theme: Theme) -> str:
    """Render a horizontal legend below the chart area."""
    if len(names) <= 1:
        return ""
    parts: list[str] = []
    x = _PAD_LEFT
    y = _CHART_HEIGHT - 5
    for i, name in enumerate(names):
        c = colors[i % len(colors)]
        parts.append(
            f'<rect x="{x}" y="{y - 8}" width="12" height="12" rx="2" fill="{c}" />'
        )
        parts.append(
            f'<text x="{x + 16}" y="{y}" fill="{theme.chart_axis_color}" '
            f'style="font-size:12px;">{escape(name)}</text>'
        )
        x += int(12 * 0.6 * len(name)) + 32  # font_size * char_width_ratio * chars + gap
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Bar chart
# ---------------------------------------------------------------------------


def svg_bar_chart(data: dict, theme: Theme) -> str:
    labels = data.get("labels", [])
    datasets = data.get("datasets", [])

    if not datasets:
        return ""

    all_values = [v for ds in datasets for v in ds.get("values", [])]
    if not all_values:
        return ""

    max_val = max(abs(v) for v in all_values)
    min_val = min(abs(v) for v in all_values if v != 0) if any(v != 0 for v in all_values) else 0
    baseline = _smart_baseline(min_val, max_val)
    ticks = _nice_ticks(max_val, min_val=baseline)
    max_tick = ticks[-1] if ticks else 1
    tick_range = max_tick - baseline

    plot_top = _PAD_TOP
    plot_bottom = _CHART_HEIGHT - _PAD_BOTTOM
    plot_height = plot_bottom - plot_top

    n_labels = len(labels)
    n_datasets = len(datasets)
    group_width = (_CHART_WIDTH - _PAD_LEFT - _PAD_RIGHT) / max(n_labels, 1)
    bar_width = max(group_width / (n_datasets + 1), 8)
    gap = bar_width * 0.2

    colors = list(theme.chart_colors)
    bars: list[str] = []

    for li, label in enumerate(labels):
        group_x = _PAD_LEFT + li * group_width
        # X-axis label
        label_x = group_x + group_width / 2
        bars.append(
            f'<text x="{label_x:.1f}" y="{plot_bottom + 18}" text-anchor="middle" '
            f'fill="{theme.chart_axis_color}" style="font-size:12px;">{escape(str(label))}</text>'
        )
        for di, ds in enumerate(datasets):
            vals = ds.get("values", [])
            val = vals[li] if li < len(vals) else 0
            h = ((abs(val) - baseline) / tick_range * plot_height) if tick_range else 0
            h = max(h, 0)
            x = group_x + (di + 0.5) * (bar_width + gap)
            y = plot_bottom - h
            c = colors[li % len(colors)] if n_datasets == 1 else colors[di % len(colors)]
            bars.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_width:.1f}" '
                f'height="{h:.1f}" rx="3" fill="{c}" />'
            )
            # Value label above bar
            if h > 8 and bar_width > 18:
                label_color = theme.kpi_delta_negative if val < 0 else theme.text_color
                bars.append(
                    f'<text x="{x + bar_width / 2:.1f}" y="{y - 4:.1f}" text-anchor="middle" '
                    f'fill="{label_color}" style="font-size:11px;">{_fmt_val(val)}</text>'
                )

    legend = _legend([ds.get("name", f"Series {i+1}") for i, ds in enumerate(datasets)], colors, theme)
    grid = _y_axis_and_grid(ticks, plot_top, plot_bottom, theme)

    return (
        f'<svg viewBox="0 0 {_CHART_WIDTH} {_CHART_HEIGHT}" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bar chart" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{grid}\n{"".join(bars)}\n{legend}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Line chart
# ---------------------------------------------------------------------------


def svg_line_chart(data: dict, theme: Theme, fill: bool = False) -> str:
    labels = data.get("labels", [])
    datasets = data.get("datasets", [])

    if not datasets:
        return ""

    all_values = [v for ds in datasets for v in ds.get("values", [])]
    if not all_values:
        return ""

    max_val = max(abs(v) for v in all_values)
    ticks = _nice_ticks(max_val)
    max_tick = ticks[-1] if ticks else 1

    plot_top = _PAD_TOP
    plot_bottom = _CHART_HEIGHT - _PAD_BOTTOM
    plot_height = plot_bottom - plot_top
    plot_left = _PAD_LEFT
    plot_right = _CHART_WIDTH - _PAD_RIGHT
    plot_width = plot_right - plot_left

    n_labels = len(labels)
    colors = list(theme.chart_colors)
    lines: list[str] = []

    # X-axis labels
    for li, label in enumerate(labels):
        x = plot_left + (li / max(n_labels - 1, 1)) * plot_width
        lines.append(
            f'<text x="{x:.1f}" y="{plot_bottom + 18}" text-anchor="middle" '
            f'fill="{theme.chart_axis_color}" style="font-size:12px;">{escape(str(label))}</text>'
        )

    for di, ds in enumerate(datasets):
        vals = ds.get("values", [])
        c = colors[di % len(colors)]
        points: list[str] = []

        for vi, val in enumerate(vals):
            x = plot_left + (vi / max(len(vals) - 1, 1)) * plot_width
            y = plot_bottom - (abs(val) / max_tick * plot_height) if max_tick else plot_bottom
            points.append(f"{x:.1f},{y:.1f}")

        points_str = " ".join(points)

        if fill and points:
            # Area fill: close the polygon along the bottom axis
            first_x = plot_left
            last_x = plot_left + ((len(vals) - 1) / max(len(vals) - 1, 1)) * plot_width
            area_points = f"{first_x:.1f},{plot_bottom:.1f} {points_str} {last_x:.1f},{plot_bottom:.1f}"
            lines.append(
                f'<polygon points="{area_points}" fill="{c}" fill-opacity="0.15" />'
            )

        lines.append(
            f'<polyline points="{points_str}" fill="none" stroke="{c}" stroke-width="2.5" />'
        )
        # Dots + value labels
        for vi, val in enumerate(vals):
            x = plot_left + (vi / max(len(vals) - 1, 1)) * plot_width
            y = plot_bottom - (abs(val) / max_tick * plot_height) if max_tick else plot_bottom
            lines.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="{c}" />'
            )
            if len(vals) <= 15:
                lines.append(
                    f'<text x="{x:.1f}" y="{y - 8:.1f}" text-anchor="middle" '
                    f'fill="{theme.text_color}" style="font-size:11px;">{_fmt_val(val)}</text>'
                )

    legend = _legend([ds.get("name", f"Series {i+1}") for i, ds in enumerate(datasets)], colors, theme)
    grid = _y_axis_and_grid(ticks, plot_top, plot_bottom, theme)
    chart_label = "Area chart" if fill else "Line chart"

    return (
        f'<svg viewBox="0 0 {_CHART_WIDTH} {_CHART_HEIGHT}" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{chart_label}" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{grid}\n{"".join(lines)}\n{legend}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Area chart (delegates to line chart with fill=True)
# ---------------------------------------------------------------------------


def svg_area_chart(data: dict, theme: Theme) -> str:
    return svg_line_chart(data, theme, fill=True)


# ---------------------------------------------------------------------------
# Pie chart
# ---------------------------------------------------------------------------


def _label_backdrop(x: float, y: float, text: str, theme: Theme) -> str:
    """Render a text label with a frosted background pill for contrast."""
    char_width = 6.2
    text_width = len(text) * char_width
    pad_x, pad_y = 6, 4
    rx = x - text_width / 2 - pad_x
    ry = y - 7 - pad_y
    rw = text_width + pad_x * 2
    rh = 14 + pad_y * 2
    bg = theme.card_bg if theme.card_bg != "transparent" else "#ffffff"
    return (
        f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
        f'rx="4" fill="{bg}" fill-opacity="0.88" />'
        f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" '
        f'dominant-baseline="middle" fill="{theme.heading_color}" '
        f'style="font-size:11px;">{text}</text>'
    )


def svg_pie_chart(data: dict, theme: Theme) -> str:
    segments = [s for s in data.get("segments", []) if s.get("value", 0) > 0]
    if not segments:
        return ""

    total = sum(s.get("value", 0) for s in segments)
    if total <= 0:
        return ""

    cx, cy = 240, 180
    r = 110
    colors = list(theme.chart_colors)
    slices: list[str] = []
    labels: list[str] = []

    angle = -math.pi / 2  # Start at top

    for i, seg in enumerate(segments):
        val = seg.get("value", 0)
        if val <= 0:
            continue
        sweep = (val / total) * 2 * math.pi
        x1 = cx + r * math.cos(angle)
        y1 = cy + r * math.sin(angle)
        x2 = cx + r * math.cos(angle + sweep)
        y2 = cy + r * math.sin(angle + sweep)
        large_arc = 1 if sweep > math.pi else 0
        c = colors[i % len(colors)]

        slices.append(
            f'<path d="M{cx},{cy} L{x1:.1f},{y1:.1f} '
            f'A{r},{r} 0 {large_arc},1 {x2:.1f},{y2:.1f} Z" fill="{c}" />'
        )

        # Label at midpoint of arc, with background pill for contrast
        mid_angle = angle + sweep / 2
        label_r = r + 20
        lx = cx + label_r * math.cos(mid_angle)
        ly = cy + label_r * math.sin(mid_angle)
        label_text = escape(str(seg.get("label", "")))
        pct = f"{val / total * 100:.0f}%"
        formatted_val = _fmt_val(val)
        full_label = f"{label_text} ({pct}, {formatted_val})"
        labels.append(_label_backdrop(lx, ly, full_label, theme))

        angle += sweep

    return (
        f'<svg viewBox="0 0 480 360" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pie chart" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{"".join(slices)}\n{"".join(labels)}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Horizontal bar chart
# ---------------------------------------------------------------------------


def svg_horizontal_bar_chart(data: dict, theme: Theme) -> str:
    labels = data.get("labels", [])
    datasets = data.get("datasets", [])

    if not datasets:
        return ""

    all_values = [v for ds in datasets for v in ds.get("values", [])]
    if not all_values:
        return ""

    max_val = max(abs(v) for v in all_values)
    min_val = min(abs(v) for v in all_values if v != 0) if any(v != 0 for v in all_values) else 0
    baseline = _smart_baseline(min_val, max_val)
    val_range = max_val - baseline
    if val_range == 0:
        val_range = 1

    pad_left = 140
    pad_right = 60
    pad_top = 20
    pad_bottom = 30

    n_labels = len(labels)
    n_datasets = len(datasets)
    plot_width = _CHART_WIDTH - pad_left - pad_right
    group_height = (_CHART_HEIGHT - pad_top - pad_bottom) / max(n_labels, 1)
    bar_height = max(group_height / (n_datasets + 1), 8)
    gap = bar_height * 0.2

    colors = list(theme.chart_colors)
    bars: list[str] = []

    for li, label in enumerate(labels):
        group_y = pad_top + li * group_height
        label_y = group_y + group_height / 2
        bars.append(
            f'<text x="{pad_left - 8}" y="{label_y:.1f}" text-anchor="end" '
            f'dominant-baseline="middle" fill="{theme.chart_axis_color}" '
            f'style="font-size:12px;">{escape(str(label))}</text>'
        )
        for di, ds in enumerate(datasets):
            vals = ds.get("values", [])
            val = vals[li] if li < len(vals) else 0
            w = ((abs(val) - baseline) / val_range * plot_width) if val_range else 0
            w = max(w, 0)
            y = group_y + (di + 0.5) * (bar_height + gap)
            c = colors[li % len(colors)] if n_datasets == 1 else colors[di % len(colors)]
            bars.append(
                f'<rect x="{pad_left}" y="{y:.1f}" width="{w:.1f}" '
                f'height="{bar_height:.1f}" rx="3" fill="{c}" />'
            )
            if w > 30:
                bars.append(
                    f'<text x="{pad_left + w + 4:.1f}" y="{y + bar_height / 2:.1f}" '
                    f'dominant-baseline="middle" fill="{theme.text_color}" '
                    f'style="font-size:11px;">{_fmt_val(val)}</text>'
                )

    legend = _legend(
        [ds.get("name", f"Series {i+1}") for i, ds in enumerate(datasets)], colors, theme
    )

    return (
        f'<svg viewBox="0 0 {_CHART_WIDTH} {_CHART_HEIGHT}" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horizontal bar chart" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{"".join(bars)}\n{legend}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Stacked bar chart
# ---------------------------------------------------------------------------


def svg_stacked_bar_chart(data: dict, theme: Theme) -> str:
    labels = data.get("labels", [])
    datasets = data.get("datasets", [])

    if not datasets:
        return ""

    n_labels = len(labels)
    # Compute stacked totals per label
    stacked_totals = []
    for li in range(n_labels):
        total = sum(
            abs(ds.get("values", [])[li]) if li < len(ds.get("values", [])) else 0
            for ds in datasets
        )
        stacked_totals.append(total)

    max_val = max(stacked_totals) if stacked_totals else 0
    ticks = _nice_ticks(max_val)
    max_tick = ticks[-1] if ticks else 1

    plot_top = _PAD_TOP
    plot_bottom = _CHART_HEIGHT - _PAD_BOTTOM
    plot_height = plot_bottom - plot_top

    group_width = (_CHART_WIDTH - _PAD_LEFT - _PAD_RIGHT) / max(n_labels, 1)
    bar_width = group_width * 0.6
    colors = list(theme.chart_colors)
    bars: list[str] = []

    for li, label in enumerate(labels):
        group_x = _PAD_LEFT + li * group_width
        label_x = group_x + group_width / 2
        bars.append(
            f'<text x="{label_x:.1f}" y="{plot_bottom + 18}" text-anchor="middle" '
            f'fill="{theme.chart_axis_color}" style="font-size:12px;">{escape(str(label))}</text>'
        )
        bar_x = group_x + (group_width - bar_width) / 2
        cum_height = 0.0
        for di, ds in enumerate(datasets):
            vals = ds.get("values", [])
            val = abs(vals[li]) if li < len(vals) else 0
            h = (val / max_tick * plot_height) if max_tick else 0
            y = plot_bottom - cum_height - h
            c = colors[di % len(colors)]
            bars.append(
                f'<rect x="{bar_x:.1f}" y="{y:.1f}" width="{bar_width:.1f}" '
                f'height="{h:.1f}" fill="{c}" />'
            )
            cum_height += h

    legend = _legend(
        [ds.get("name", f"Series {i+1}") for i, ds in enumerate(datasets)], colors, theme
    )
    grid = _y_axis_and_grid(ticks, plot_top, plot_bottom, theme)

    return (
        f'<svg viewBox="0 0 {_CHART_WIDTH} {_CHART_HEIGHT}" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stacked bar chart" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{grid}\n{"".join(bars)}\n{legend}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Donut chart
# ---------------------------------------------------------------------------


def svg_donut_chart(data: dict, theme: Theme) -> str:
    segments = [s for s in data.get("segments", []) if s.get("value", 0) > 0]
    if not segments:
        return ""

    total = sum(s.get("value", 0) for s in segments)
    if total <= 0:
        return ""

    cx, cy = 240, 180
    outer_r = 110
    inner_r = 65
    colors = list(theme.chart_colors)
    slices: list[str] = []
    labels: list[str] = []

    angle = -math.pi / 2

    for i, seg in enumerate(segments):
        val = seg.get("value", 0)
        if val <= 0:
            continue
        sweep = (val / total) * 2 * math.pi
        # Outer arc
        ox1 = cx + outer_r * math.cos(angle)
        oy1 = cy + outer_r * math.sin(angle)
        ox2 = cx + outer_r * math.cos(angle + sweep)
        oy2 = cy + outer_r * math.sin(angle + sweep)
        # Inner arc (reversed)
        ix1 = cx + inner_r * math.cos(angle + sweep)
        iy1 = cy + inner_r * math.sin(angle + sweep)
        ix2 = cx + inner_r * math.cos(angle)
        iy2 = cy + inner_r * math.sin(angle)
        large_arc = 1 if sweep > math.pi else 0
        c = colors[i % len(colors)]

        slices.append(
            f'<path d="M{ox1:.1f},{oy1:.1f} '
            f'A{outer_r},{outer_r} 0 {large_arc},1 {ox2:.1f},{oy2:.1f} '
            f'L{ix1:.1f},{iy1:.1f} '
            f'A{inner_r},{inner_r} 0 {large_arc},0 {ix2:.1f},{iy2:.1f} Z" '
            f'fill="{c}" />'
        )

        mid_angle = angle + sweep / 2
        label_r = outer_r + 20
        lx = cx + label_r * math.cos(mid_angle)
        ly = cy + label_r * math.sin(mid_angle)
        label_text = escape(str(seg.get("label", "")))
        pct = f"{val / total * 100:.0f}%"
        full_label = f"{label_text} ({pct})"
        labels.append(_label_backdrop(lx, ly, full_label, theme))

        angle += sweep

    # Center label
    center_label = data.get("center_label", "")
    center_html = ""
    if center_label:
        center_html = (
            f'<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="middle" '
            f'fill="{theme.heading_color}" style="font-size:16px; font-weight:700;">'
            f'{escape(str(center_label))}</text>'
        )

    return (
        f'<svg viewBox="0 0 480 360" width="100%" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Donut chart" '
        f'style="display:block; font-family:{theme.font_stack};">'
        f'\n{"".join(slices)}\n{"".join(labels)}\n{center_html}'
        f'\n</svg>'
    )


# ---------------------------------------------------------------------------
# Sparkline
# ---------------------------------------------------------------------------


def svg_sparkline(data: dict, theme: Theme) -> str:
    values = data.get("values", [])
    if not values or not any(isinstance(v, (int, float)) for v in values):
        return ""

    width, height = 150, 40
    pad = 4
    plot_w = width - 2 * pad
    plot_h = height - 2 * pad

    min_val = min(values)
    max_val = max(values)
    val_range = max_val - min_val if max_val != min_val else 1

    points: list[str] = []
    n = len(values)
    for i, v in enumerate(values):
        x = pad + (i / max(n - 1, 1)) * plot_w
        y = pad + plot_h - ((v - min_val) / val_range) * plot_h
        points.append(f"{x:.1f},{y:.1f}")

    color = theme.chart_colors[0] if theme.chart_colors else theme.accent_color
    points_str = " ".join(points)

    return (
        f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sparkline" '
        f'style="display:inline-block; vertical-align:middle;">'
        f'<polyline points="{points_str}" fill="none" stroke="{color}" stroke-width="1.5" />'
        f'</svg>'
    )
