"""Local structural validation for report sections.

Validates section structure, chart data, KPI format, and slide density
without requiring a server connection. Use before publishing to catch
issues instantly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from openreporting.capabilities import SECTION_TYPES

ValidationSeverity = Literal["error", "warning"]

_MULTI_DATASET_CHART_TYPES = frozenset(
    {
        "bar-chart",
        "line-chart",
        "area-chart",
        "horizontal-bar-chart",
        "stacked-bar-chart",
    }
)

_PIE_CHART_TYPES = frozenset({"pie-chart", "donut-chart"})


@dataclass
class ValidationIssue:
    severity: ValidationSeverity
    rule_id: str
    message: str
    suggestion: str


def validate_sections(sections: list[dict]) -> list[ValidationIssue]:
    """Validate a list of section dicts locally. Returns issues found."""
    issues: list[ValidationIssue] = []

    for i, section in enumerate(sections):
        if not isinstance(section, dict):
            continue

        section_type = section.get("type", "")
        label = f"Section {i} (type={section_type!r})" if section_type else f"Section {i}"

        # 1. Unknown section type
        if section_type not in SECTION_TYPES:
            issues.append(
                ValidationIssue(
                    severity="error",
                    rule_id="unknown_section_type",
                    message=f"{label}: unknown section type {section_type!r}.",
                    suggestion=(
                        f"Use one of the supported types: {', '.join(SECTION_TYPES)}."
                    ),
                )
            )
            # Skip further checks for unknown types — they may lack expected keys.
            continue

        # 2 & 3. Multi-dataset chart checks (labels/values mismatch, non-numeric values)
        if section_type in _MULTI_DATASET_CHART_TYPES:
            data = section.get("data") or {}
            labels = data.get("labels") or []
            datasets = data.get("datasets") or []
            label_count = len(labels)

            for ds_idx, dataset in enumerate(datasets):
                if not isinstance(dataset, dict):
                    continue
                values = dataset.get("values") or []

                # 2. Labels / values length mismatch
                if len(values) != label_count:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            rule_id="chart_labels_values_mismatch",
                            message=(
                                f"{label}: dataset[{ds_idx}] has {len(values)} value(s) "
                                f"but there are {label_count} label(s)."
                            ),
                            suggestion=(
                                "Ensure every dataset's 'values' list has exactly as "
                                "many entries as the 'labels' list."
                            ),
                        )
                    )

                # 3. Non-numeric values
                for v_idx, v in enumerate(values):
                    if not isinstance(v, (int, float)):
                        issues.append(
                            ValidationIssue(
                                severity="error",
                                rule_id="chart_values_not_numeric",
                                message=(
                                    f"{label}: dataset[{ds_idx}].values[{v_idx}] "
                                    f"is {v!r} (type {type(v).__name__}), expected a number."
                                ),
                                suggestion=(
                                    "Chart values must be plain int or float — "
                                    "remove any '$', '%', or comma formatting."
                                ),
                            )
                        )

        # 9. Pie / donut chart: values must be positive
        if section_type in _PIE_CHART_TYPES:
            data = section.get("data") or {}
            segments = data.get("segments") or []
            for seg_idx, seg in enumerate(segments):
                if not isinstance(seg, dict):
                    continue
                v = seg.get("value")
                if v is None:
                    continue
                if not isinstance(v, (int, float)) or v <= 0:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            rule_id="pie_values_not_positive",
                            message=(
                                f"{label}: segment[{seg_idx}] has value {v!r}, "
                                "which is not a positive number."
                            ),
                            suggestion=(
                                "All pie/donut segment values must be positive numbers "
                                "greater than zero."
                            ),
                        )
                    )

        # 4–6. KPI grid checks
        if section_type == "kpi-grid":
            metrics = section.get("metrics") or []

            # 4. KPI value too long
            for m_idx, metric in enumerate(metrics):
                if not isinstance(metric, dict):
                    continue
                value = metric.get("value", "")
                if isinstance(value, str) and len(value) > 20:
                    issues.append(
                        ValidationIssue(
                            severity="warning",
                            rule_id="kpi_value_too_long",
                            message=(
                                f"{label}: metrics[{m_idx}] value {value!r} "
                                f"is {len(value)} characters (max 20)."
                            ),
                            suggestion=(
                                "KPI value should be a single short number like "
                                "'$34.2M' or '121.9'"
                            ),
                        )
                    )

            # 5. Duplicate dimension (shared key term between labels)
            _check_kpi_duplicate_dimensions(label, metrics, issues)

            # 6. Too many KPIs
            if len(metrics) > 4:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        rule_id="kpi_too_many",
                        message=(
                            f"{label}: has {len(metrics)} metrics (max recommended: 4)."
                        ),
                        suggestion=(
                            "Limit kpi-grid to 4 metrics for readability. "
                            "Split into multiple kpi-grid sections if needed."
                        ),
                    )
                )

        # 7. Empty section
        _check_empty_section(label, section, section_type, issues)

        # 8. Slide too dense
        if section_type == "slide":
            child_sections = section.get("sections") or []
            if len(child_sections) > 2:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        rule_id="slide_too_dense",
                        message=(
                            f"{label}: contains {len(child_sections)} child sections "
                            "(max recommended: 2)."
                        ),
                        suggestion=(
                            "Keep slides to 1 section (2 max for small items like "
                            "kpi-grid + callout). Charts and tables should have their own slide."
                        ),
                    )
                )

    return issues


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _check_empty_section(
    label: str,
    section: dict,
    section_type: str,
    issues: list[ValidationIssue],
) -> None:
    """Append an empty_section warning when there is no meaningful content."""
    empty = False

    if section_type == "text":
        body = section.get("body", "")
        empty = not (isinstance(body, str) and body.strip())

    elif section_type == "kpi-grid":
        empty = not section.get("metrics")

    elif section_type == "table":
        empty = not section.get("rows")

    elif section_type == "timeline":
        empty = not section.get("events")

    elif section_type == "action-items":
        empty = not section.get("items")

    elif section_type in _MULTI_DATASET_CHART_TYPES:
        data = section.get("data") or {}
        datasets = data.get("datasets") or []
        labels = data.get("labels") or []
        empty = not labels and not datasets

    elif section_type in _PIE_CHART_TYPES:
        data = section.get("data") or {}
        empty = not (data.get("segments"))

    if empty:
        issues.append(
            ValidationIssue(
                severity="warning",
                rule_id="empty_section",
                message=f"{label}: section appears to have no meaningful content.",
                suggestion=(
                    "Populate the section with real data before publishing. "
                    "Empty sections are blocked by the authoring coach."
                ),
            )
        )


def _key_terms(label_str: str) -> set[str]:
    """Return a set of significant words from a metric label string."""
    # Split on whitespace and strip common short words / punctuation
    _stop = {"a", "an", "the", "of", "in", "at", "on", "by", "to", "vs", "and", "or"}
    words = label_str.lower().split()
    return {w.strip(".,;:()") for w in words if w.strip(".,;:()") not in _stop and len(w) > 1}


def _check_kpi_duplicate_dimensions(
    label: str,
    metrics: list,
    issues: list[ValidationIssue],
) -> None:
    """Warn when two KPI metrics share a key term, suggesting duplicated dimensions."""
    seen: list[tuple[int, str, set[str]]] = []

    for m_idx, metric in enumerate(metrics):
        if not isinstance(metric, dict):
            continue
        metric_label = metric.get("label", "")
        if not isinstance(metric_label, str) or not metric_label.strip():
            continue

        terms = _key_terms(metric_label)
        if not terms:
            continue

        for prev_idx, prev_label_str, prev_terms in seen:
            shared = terms & prev_terms
            if shared:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        rule_id="kpi_duplicate_dimension",
                        message=(
                            f"{label}: metrics[{prev_idx}] ({prev_label_str!r}) and "
                            f"metrics[{m_idx}] ({metric_label!r}) share term(s): "
                            f"{', '.join(sorted(shared))}."
                        ),
                        suggestion=(
                            "Consider whether these metrics measure the same dimension. "
                            "Use distinct labels to avoid confusing readers."
                        ),
                    )
                )

        seen.append((m_idx, metric_label, terms))
