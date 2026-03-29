"""
Chart data validation and normalization.

Central validation called from both the renderer and the authoring coach.
Catches common LLM mistakes: mismatched array lengths, string values,
empty data, etc.
"""

import math
from copy import deepcopy
from dataclasses import dataclass
from typing import Literal


@dataclass
class ChartValidationError:
    field: str  # e.g. "data.datasets[0].values"
    message: str  # human-readable
    severity: Literal["error", "warning"]


def _is_numeric(v: object) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _try_coerce_number(v: object) -> object:
    """Attempt to coerce a string to a number. Returns original if not safe."""
    if isinstance(v, str):
        stripped = v.strip()
        try:
            if "." in stripped:
                return float(stripped)
            return int(stripped)
        except (ValueError, OverflowError):
            return v
    return v


def normalize_chart_values(section: dict) -> dict:
    """Attempt to coerce string numbers ("100" -> 100). Returns cleaned copy.

    Only plain numeric strings are coerced. Strings like "$100" or "1,000"
    are left as-is so they fail validation with a clear message.
    """
    section = deepcopy(section)
    chart_type = section.get("type", "")
    data = section.get("data")
    if not isinstance(data, dict):
        return section

    if chart_type in ("pie-chart", "donut-chart"):
        segments = data.get("segments")
        if isinstance(segments, list):
            for seg in segments:
                if isinstance(seg, dict) and "value" in seg:
                    seg["value"] = _try_coerce_number(seg["value"])
    elif chart_type == "sparkline":
        values = data.get("values")
        if isinstance(values, list):
            data["values"] = [_try_coerce_number(v) for v in values]
    elif chart_type == "heatmap-chart":
        values = data.get("values")
        if isinstance(values, list):
            data["values"] = [
                [_try_coerce_number(v) for v in row] if isinstance(row, list) else row
                for row in values
            ]
    else:
        datasets = data.get("datasets")
        if isinstance(datasets, list):
            for ds in datasets:
                if isinstance(ds, dict) and isinstance(ds.get("values"), list):
                    ds["values"] = [_try_coerce_number(v) for v in ds["values"]]

    return section


def validate_chart_section(section: dict) -> list[ChartValidationError]:
    """Validate a single chart section. Empty list = valid."""
    errors: list[ChartValidationError] = []
    chart_type = section.get("type", "")

    data = section.get("data")
    if not isinstance(data, dict):
        errors.append(
            ChartValidationError(
                field="data",
                message="'data' key is missing or not a dict.",
                severity="error",
            )
        )
        return errors

    if chart_type in ("pie-chart", "donut-chart"):
        _validate_pie(data, errors)
    elif chart_type == "sparkline":
        _validate_sparkline(data, errors)
    elif chart_type == "heatmap-chart":
        _validate_heatmap(data, errors)
    else:
        _validate_bar_line_area(data, errors, chart_type)

    return errors


def _validate_pie(data: dict, errors: list[ChartValidationError]) -> None:
    segments = data.get("segments")
    if not isinstance(segments, list) or len(segments) == 0:
        errors.append(
            ChartValidationError(
                field="data.segments",
                message="'data.segments' must be a non-empty list.",
                severity="error",
            )
        )
        return

    total = 0.0
    for i, seg in enumerate(segments):
        if not isinstance(seg, dict):
            errors.append(
                ChartValidationError(
                    field=f"data.segments[{i}]",
                    message=f"Segment {i} is not a dict.",
                    severity="error",
                )
            )
            continue
        if not isinstance(seg.get("label"), str):
            errors.append(
                ChartValidationError(
                    field=f"data.segments[{i}].label",
                    message=f"Segment {i} is missing a string 'label'.",
                    severity="error",
                )
            )
        val = seg.get("value")
        if not _is_numeric(val):
            errors.append(
                ChartValidationError(
                    field=f"data.segments[{i}].value",
                    message=f"Segment {i} value ({val!r}) is not a valid number. Use plain numbers (no currency symbols or commas).",
                    severity="error",
                )
            )
        else:
            total += float(val)

    if not any(e.severity == "error" for e in errors) and total <= 0:
        errors.append(
            ChartValidationError(
                field="data.segments",
                message="Sum of segment values is zero or negative.",
                severity="error",
            )
        )

    if len(segments) < 2 and not any(e.severity == "error" for e in errors):
        errors.append(
            ChartValidationError(
                field="data.segments",
                message="Single-slice pie chart is likely an error.",
                severity="warning",
            )
        )


def _validate_bar_line_area(
    data: dict, errors: list[ChartValidationError], chart_type: str
) -> None:
    labels = data.get("labels")
    if not isinstance(labels, list) or len(labels) == 0:
        errors.append(
            ChartValidationError(
                field="data.labels",
                message="'data.labels' must be a non-empty list.",
                severity="error",
            )
        )
        return

    datasets = data.get("datasets")
    if not isinstance(datasets, list) or len(datasets) == 0:
        errors.append(
            ChartValidationError(
                field="data.datasets",
                message="'data.datasets' must be a non-empty list.",
                severity="error",
            )
        )
        return

    all_zero = True
    n_labels = len(labels)

    for i, ds in enumerate(datasets):
        if not isinstance(ds, dict):
            errors.append(
                ChartValidationError(
                    field=f"data.datasets[{i}]",
                    message=f"Dataset {i} is not a dict.",
                    severity="error",
                )
            )
            continue

        name = ds.get("name")
        if not isinstance(name, str) or not name.strip():
            errors.append(
                ChartValidationError(
                    field=f"data.datasets[{i}].name",
                    message=f"Dataset {i} is missing a non-empty string 'name'.",
                    severity="error",
                )
            )

        values = ds.get("values")
        if not isinstance(values, list):
            errors.append(
                ChartValidationError(
                    field=f"data.datasets[{i}].values",
                    message=f"Dataset {i} 'values' must be a list.",
                    severity="error",
                )
            )
            continue

        ds_name = ds.get("name", f"Dataset {i}")
        if len(values) != n_labels:
            errors.append(
                ChartValidationError(
                    field=f"data.datasets[{i}].values",
                    message=f"labels has {n_labels} items but '{ds_name}' values has {len(values)} items. They must match.",
                    severity="error",
                )
            )

        for vi, val in enumerate(values):
            if not _is_numeric(val):
                errors.append(
                    ChartValidationError(
                        field=f"data.datasets[{i}].values[{vi}]",
                        message=f"'{ds_name}' value at index {vi} ({val!r}) is not a valid number. Use plain numbers (no currency symbols or commas).",
                        severity="error",
                    )
                )
            elif val != 0:
                all_zero = False

    if len(labels) < 2 and not any(e.severity == "error" for e in errors):
        errors.append(
            ChartValidationError(
                field="data.labels",
                message="Single-point chart — this is usually an error.",
                severity="warning",
            )
        )

    if all_zero and not any(e.severity == "error" for e in errors):
        errors.append(
            ChartValidationError(
                field="data.datasets",
                message="All values are zero — likely placeholder data.",
                severity="warning",
            )
        )


def _validate_heatmap(data: dict, errors: list[ChartValidationError]) -> None:
    x_labels = data.get("x_labels")
    if not isinstance(x_labels, list) or len(x_labels) == 0:
        errors.append(
            ChartValidationError(
                field="data.x_labels",
                message="'data.x_labels' must be a non-empty list of strings.",
                severity="error",
            )
        )
    elif not all(isinstance(l, str) for l in x_labels):
        errors.append(
            ChartValidationError(
                field="data.x_labels",
                message="All x_labels must be strings.",
                severity="error",
            )
        )

    y_labels = data.get("y_labels")
    if not isinstance(y_labels, list) or len(y_labels) == 0:
        errors.append(
            ChartValidationError(
                field="data.y_labels",
                message="'data.y_labels' must be a non-empty list of strings.",
                severity="error",
            )
        )
    elif not all(isinstance(l, str) for l in y_labels):
        errors.append(
            ChartValidationError(
                field="data.y_labels",
                message="All y_labels must be strings.",
                severity="error",
            )
        )

    values = data.get("values")
    if not isinstance(values, list) or len(values) == 0:
        errors.append(
            ChartValidationError(
                field="data.values",
                message="'data.values' must be a non-empty 2D list.",
                severity="error",
            )
        )
        return

    if isinstance(y_labels, list) and len(values) != len(y_labels):
        errors.append(
            ChartValidationError(
                field="data.values",
                message=f"values has {len(values)} rows but y_labels has {len(y_labels)} items. They must match.",
                severity="error",
            )
        )

    n_cols = len(x_labels) if isinstance(x_labels, list) else 0
    all_identical = True
    first_val = None
    for ri, row in enumerate(values):
        if not isinstance(row, list):
            errors.append(
                ChartValidationError(
                    field=f"data.values[{ri}]",
                    message=f"Row {ri} is not a list.",
                    severity="error",
                )
            )
            continue
        if n_cols and len(row) != n_cols:
            errors.append(
                ChartValidationError(
                    field=f"data.values[{ri}]",
                    message=f"Row {ri} has {len(row)} values but x_labels has {n_cols} items. They must match.",
                    severity="error",
                )
            )
        for ci, val in enumerate(row):
            if not _is_numeric(val):
                errors.append(
                    ChartValidationError(
                        field=f"data.values[{ri}][{ci}]",
                        message=f"Value at row {ri}, col {ci} ({val!r}) is not a valid number.",
                        severity="error",
                    )
                )
            else:
                if first_val is None:
                    first_val = val
                elif val != first_val:
                    all_identical = False

    scale = data.get("scale")
    if scale is not None and scale not in ("sequential", "diverging", "red-yellow-green"):
        errors.append(
            ChartValidationError(
                field="data.scale",
                message=f"Unknown scale '{scale}'. Must be 'sequential', 'diverging', or 'red-yellow-green'.",
                severity="error",
            )
        )

    if not any(e.severity == "error" for e in errors):
        if all_identical and first_val is not None:
            errors.append(
                ChartValidationError(
                    field="data.values",
                    message="All values are identical — heatmap will show a single color.",
                    severity="warning",
                )
            )
        if isinstance(y_labels, list) and len(y_labels) == 1:
            errors.append(
                ChartValidationError(
                    field="data.y_labels",
                    message="Single-row heatmap — consider using a bar chart instead.",
                    severity="warning",
                )
            )
        if isinstance(x_labels, list) and len(x_labels) == 1:
            errors.append(
                ChartValidationError(
                    field="data.x_labels",
                    message="Single-column heatmap — consider using a horizontal bar chart instead.",
                    severity="warning",
                )
            )


def _validate_sparkline(data: dict, errors: list[ChartValidationError]) -> None:
    values = data.get("values")
    if not isinstance(values, list) or len(values) == 0:
        errors.append(
            ChartValidationError(
                field="data.values",
                message="'data.values' must be a non-empty list.",
                severity="error",
            )
        )
        return

    for i, val in enumerate(values):
        if not _is_numeric(val):
            errors.append(
                ChartValidationError(
                    field=f"data.values[{i}]",
                    message=f"Value at index {i} ({val!r}) is not a valid number.",
                    severity="error",
                )
            )


def extract_chart_blocks_from_markdown(markdown: str) -> list[dict]:
    """Extract chart JSON blocks from markdown ```chart fenced code blocks."""
    import json
    import re

    blocks: list[dict] = []
    for m in re.finditer(r"```chart\s*\n(.*?)```", markdown, re.DOTALL | re.IGNORECASE):
        try:
            spec = json.loads(m.group(1))
            if isinstance(spec, dict) and spec.get("type", "").endswith("-chart"):
                blocks.append(
                    {
                        "type": spec["type"],
                        "data": spec.get("data", {}),
                        "heading": spec.get("heading", ""),
                    }
                )
        except (json.JSONDecodeError, ValueError):
            pass
    return blocks
