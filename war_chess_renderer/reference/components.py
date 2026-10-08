"""Pure War Chess component eligibility, brief, and obligation compilers."""

from __future__ import annotations

import copy
from collections.abc import Mapping, Sequence
from typing import Any

from production_core.assembly import AssemblyError, validate_selected_set
from production_core.canonical import canonical_hash

from .chess_truth import motif_for_id, validate_wc06_engine_receipt


COMPONENT_PACKET_SCHEMA = "war-chess-component-brief-packet.v1"
COMPONENT_RESPONSE_SCHEMA = "war-chess-component-brief-response.v1"
FROZEN_COMPONENT_BRIEF_SCHEMA = "war-chess-frozen-component-brief.v1"
COMPONENT_OBLIGATIONS_SCHEMA = "war-chess-component-obligations.v1"
COMPONENT_ASSET_REVIEW_PACKET_SCHEMA = "war-chess-component-asset-review-packet.v1"
COMPONENT_ASSET_REVIEW_RESPONSE_SCHEMA = "war-chess-component-asset-review-response.v1"
FROZEN_COMPONENT_ASSET_REVIEW_SCHEMA = "war-chess-frozen-component-asset-review.v1"
COMPONENT_DISPLAY_COPY_REPAIR_PACKET_SCHEMA = (
    "war-chess-component-display-copy-repair-packet.v1"
)
COMPONENT_DISPLAY_COPY_REPAIR_RESPONSE_SCHEMA = (
    "war-chess-component-display-copy-repair-response.v1"
)
FROZEN_COMPONENT_DISPLAY_COPY_REPAIR_SCHEMA = (
    "war-chess-frozen-component-display-copy-repair.v1"
)
COMPONENT_QC_REVIEW_PACKET_SCHEMA = "war-chess-component-qc-review-packet.v1"
COMPONENT_QC_REVIEW_RESPONSE_SCHEMA = "war-chess-component-qc-review-response.v1"
FROZEN_COMPONENT_QC_REVIEW_SCHEMA = "war-chess-frozen-component-qc-review.v1"
COMPONENT_MANIFEST_SCHEMA = "war-chess-component-manifest.v1"
COMPONENT_QC_SCHEMA = "war-chess-component-qc.v1"
DISPLAY_COPY_LIMITS = {"viewer_title": 48, "viewer_takeaway": 120}

PNG_ASSET_ROLES = frozenset(
    {
        "map_plate",
        "named_person_cutout",
        "force_identity_left",
        "force_identity_right",
        "subject_1",
        "subject_2",
        "subject_3",
        "subject_image",
        "subject_cutout",
    }
)
REVIEWED_IMAGE_ASSET_ROLES = frozenset(
    {
        "short_overlay_still",
        "editorial_card_still",
        "whole_word_highlight_still",
        "number_only_year_still",
        "document_full",
        "document_detail",
        "archival_full",
        "contrast_source_left",
        "contrast_source_right",
    }
)


WC02_PERSON_MARGINALIA_VARIANT = "person_marginalia_v3"


def _wc02_person_marginalia(evidence: Mapping[str, Any]) -> bool:
    points = evidence.get("progression_points")
    return evidence.get("anchor_kind") == "person" and isinstance(points, list) and len(points) == 3


def _requires_png_asset(asset_role: str) -> bool:
    return (
        asset_role in PNG_ASSET_ROLES
        or asset_role.startswith("progression_item_")
    )


def _requires_reviewed_image(asset_role: str) -> bool:
    return (
        asset_role in REVIEWED_IMAGE_ASSET_ROLES
        or asset_role.startswith("archival_detail_")
    )


def _asset_media_type_allowed(
    asset_role: str, media_type: str, *, fixture_only: bool
) -> bool:
    if asset_role in {"subject_1", "subject_2", "subject_3"} and not fixture_only:
        return media_type in {"image/png", "image/jpeg"}
    if _requires_png_asset(asset_role):
        return media_type == "image/png"
    if _requires_reviewed_image(asset_role):
        return media_type in {"image/png", "image/jpeg"}
    return True

REJECTED_COMPONENT_IDS = frozenset({"WC03", "WC05"})
P01_SPECIALIST_COMPONENT_IDS = frozenset(
    {
        "WC01", "WC02", "WC04", "WC06", "WC07", "WC08", "WC09",
        "WC10", "WC11", "WC12", "WC13", "WC14", "WC15",
        "P14",
    }
)
# These are the component families whose owner-approved Remotion implementation
# can currently be fed by the web-native evidence and asset contracts without
# inventing missing facts. WC10 uses an abstract decision surface, and WC11
# uses code-owned sequence numbers. Remaining library modes stay transferred and
# hash-locked, but the component planner retains ordinary media until their
# richer evidence contracts are implemented.
CANONICAL_RUNTIME_READY_COMPONENT_IDS = frozenset(
    {"P01", "P02", "P03", "P14", "WC01", "WC02", "WC06", "WC07", "WC08", "WC09", "WC10", "WC11", "WC12", "WC13", "WC14", "WC15"}
)
def is_runtime_ready_component(component_type: str, *, map_story_mode: str | None = None) -> bool:
    canonical_type = "WC06" if component_type == "WB01" else component_type
    return canonical_type in CANONICAL_RUNTIME_READY_COMPONENT_IDS or (
        canonical_type == "WC04" and map_story_mode == "orientation"
    )


COMPONENT_SPECS: dict[str, dict[str, Any]] = {
    "P01": {
        "variant": "short_overlay_emphasis_v2",
        "layer": "full_screen",
        "minimum_frames": 90,
        "maximum_frames": 150,
        "asset_roles": ("short_overlay_still",),
    },
    "P02": {
        "variant": "compact_editorial_card_v2",
        "layer": "full_screen",
        "minimum_frames": 120,
        "maximum_frames": 150,
        "asset_roles": ("editorial_card_still",),
    },
    "P03": {
        "variant": "whole_word_highlight_v2",
        "layer": "full_screen",
        "minimum_frames": 90,
        "maximum_frames": 150,
        "asset_roles": ("whole_word_highlight_still",),
    },
    "P14": {
        "variant": "number_only_year_v1",
        "layer": "full_screen",
        "minimum_frames": 90,
        "maximum_frames": 150,
        "asset_roles": ("number_only_year_still",),
    },
    "WC01": {
        "variant": "force_comparison_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 150,
        "asset_roles": ("force_identity_left", "force_identity_right"),
    },
    "WC02": {
        "variant": "anchored_progression_v2",
        "layer": "full_screen",
        "minimum_frames": 240,
        "maximum_frames": 600,
        "asset_roles": ("subject_image", "subject_cutout"),
    },
    "WC04": {
        "variant": "adaptive_tactical_map_v2",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 450,
        "asset_roles": ("map_plate",),
    },
    "WC06": {
        "variant": "pivotal_chess_v1",
        "layer": "full_screen",
        "minimum_frames": 240,
        "maximum_frames": 600,
        "asset_roles": (),
    },
    "WB01": {
        "variant": "pivotal_chess_v1",
        "layer": "full_screen",
        "minimum_frames": 240,
        "maximum_frames": 600,
        "asset_roles": (),
    },
    "WC07": {
        "variant": "three_subject_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 450,
        "asset_roles": ("subject_1", "subject_2", "subject_3"),
    },
    "WC08": {
        "variant": "identity_place_overlay_v1",
        "layer": "overlay",
        "minimum_frames": 90,
        "maximum_frames": 150,
        "asset_roles": (),
    },
    "WC09": {
        "variant": "verified_statistic_overlay_v1",
        "layer": "overlay",
        "minimum_frames": 90,
        "maximum_frames": 150,
        "asset_roles": (),
    },
    "WC10": {
        "variant": "strategic_choice_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 450,
        "asset_roles": (),
    },
    "WC11": {
        "variant": "campaign_chronology_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 450,
        "asset_roles": (),
    },
    "WC12": {
        "variant": "named_person_overlay_v1",
        "layer": "overlay",
        "minimum_frames": 150,
        "maximum_frames": 180,
        "asset_roles": ("named_person_portrait", "named_person_cutout"),
    },
    "WC13": {
        "variant": "document_evidence_reveal_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 300,
        "asset_roles": ("document_full", "document_detail"),
    },
    "WC14": {
        "variant": "archival_detail_sequence_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        # Full-screen components must cover whole 150-frame ordinary units.
        # Two units preserve that invariant while still admitting 2-4 details.
        "maximum_frames": 300,
        "asset_roles": ("archival_full",),
    },
    "WC15": {
        "variant": "two_source_contrast_v1",
        "layer": "full_screen",
        "minimum_frames": 150,
        "maximum_frames": 300,
        "asset_roles": ("contrast_source_left", "contrast_source_right"),
    },
}


class ComponentValidationError(ValueError):
    """A component packet or response is stale, malformed, or ineligible."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _p01_pair_index(index: int, evidence: Mapping[str, Any], count: int) -> int | None:
    role = evidence.get("coordination_role")
    if role == "standalone_emphasis":
        return None
    if role == "hook_before_specialist":
        pair_index = index + 1
    elif role == "takeaway_after_specialist":
        pair_index = index - 1
    else:
        raise ComponentValidationError("p01_coordination_role_invalid")
    if not 0 <= pair_index < count:
        raise ComponentValidationError("p01_paired_specialist_missing")
    return pair_index


def _mapping(value: Any, code: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ComponentValidationError(code)
    return value


def _text(value: Any, code: str, *, maximum: int = 200) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ComponentValidationError(code)
    return value.strip()


def _hex64(value: Any, code: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ComponentValidationError(code)
    return value


def _self_hash(value: Mapping[str, Any], field: str, code: str) -> str:
    declared = value.get(field)
    expected = canonical_hash(
        {key: copy.deepcopy(item) for key, item in value.items() if key != field}
    )
    if not isinstance(declared, str) or declared != expected:
        raise ComponentValidationError(code)
    return declared


def _selected_spans(selected_set: Mapping[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    try:
        selected_hash, _, spans = validate_selected_set(selected_set)
    except AssemblyError as exc:
        raise ComponentValidationError(str(exc)) from exc
    return selected_hash, [copy.deepcopy(dict(span)) for span in spans]


def _plan_units(plan: Mapping[str, Any]) -> tuple[str, dict[str, dict[str, Any]]]:
    plan_hash = _self_hash(
        plan,
        "initial_visual_plan_hash",
        "component_plan_hash_mismatch",
    )
    units = plan.get("units")
    if not isinstance(units, list) or not units:
        raise ComponentValidationError("component_plan_units_missing")
    result: dict[str, dict[str, Any]] = {}
    cursor = 0
    for index, raw in enumerate(units):
        unit = _mapping(raw, f"component_plan_unit_invalid:{index}")
        unit_id = _text(unit.get("unit_id"), f"component_plan_unit_id_invalid:{index}")
        start = unit.get("start_frame")
        end = unit.get("end_frame_exclusive")
        if (
            unit_id in result
            or isinstance(start, bool)
            or not isinstance(start, int)
            or isinstance(end, bool)
            or not isinstance(end, int)
            or start != cursor
            or end <= start
        ):
            raise ComponentValidationError(f"component_plan_unit_range_invalid:{index}")
        result[unit_id] = copy.deepcopy(dict(unit))
        cursor = end
    if cursor != plan.get("duration_frames"):
        raise ComponentValidationError("component_plan_duration_mismatch")
    return plan_hash, result


def _overlap_span_ids(
    spans: Sequence[Mapping[str, Any]], start: int, end: int
) -> list[str]:
    return [
        str(span["span_id"])
        for span in spans
        if int(span["start_frame"]) < end
        and int(span["end_frame_exclusive"]) > start
    ]


def _target_range(
    component_type: str,
    ordinary_unit_ids: list[str],
    units: Mapping[str, Mapping[str, Any]],
    spans: Sequence[Mapping[str, Any]],
    *, measured_policy: bool = False,
) -> tuple[int, int, str | None]:
    spec = COMPONENT_SPECS[component_type]
    selected_units = [units[unit_id] for unit_id in ordinary_unit_ids]
    if component_type in {"P01", "P02", "P03", "P14"}:
        allowed = set(ordinary_unit_ids)
        minimum_frames = 120 if component_type == "P02" else 90
        for span in spans:
            duration = int(span["end_frame_exclusive"]) - int(span["start_frame"])
            if (
                span.get("parent_unit_id") in allowed
                and span.get("outcome") == "selected_media"
                and span.get("media_family") == "animated_still"
                and minimum_frames <= duration <= 150
            ):
                return int(span["start_frame"]), int(span["end_frame_exclusive"]), None
        code = {
            "P01": "p01_reviewed_three_to_five_second_still_unavailable",
            "P02": "p02_reviewed_four_to_five_second_still_unavailable",
            "P03": "p03_reviewed_three_to_five_second_still_unavailable",
            "P14": "p14_reviewed_three_to_five_second_still_unavailable",
        }[component_type]
        return (
            int(selected_units[0]["start_frame"]),
            int(selected_units[-1]["end_frame_exclusive"]),
            code,
        )
    if component_type == "WC01":
        for unit in selected_units:
            if int(unit["end_frame_exclusive"]) - int(unit["start_frame"]) == 150:
                return int(unit["start_frame"]), int(unit["end_frame_exclusive"]), None
        return (
            int(selected_units[0]["start_frame"]),
            int(selected_units[-1]["end_frame_exclusive"]),
            "wc01_exact_150_frame_unit_unavailable",
        )
    if component_type == "WC12":
        allowed = set(ordinary_unit_ids)
        for span in spans:
            duration = int(span["end_frame_exclusive"]) - int(span["start_frame"])
            if (
                span.get("parent_unit_id") in allowed
                and span.get("outcome") == "selected_media"
                and (150 <= duration <= 180 if measured_policy else duration == 150)
            ):
                return int(span["start_frame"]), int(span["end_frame_exclusive"]), None
        return (
            int(selected_units[0]["start_frame"]),
            int(selected_units[-1]["end_frame_exclusive"]),
            "wc12_reviewed_five_to_six_second_base_unavailable" if measured_policy else "wc12_reviewed_5_second_base_unavailable",
        )
    if spec["layer"] == "overlay":
        allowed = set(ordinary_unit_ids)
        for span in spans:
            duration = int(span["end_frame_exclusive"]) - int(span["start_frame"])
            if (
                span.get("parent_unit_id") in allowed
                and span.get("outcome") == "selected_media"
                and duration >= int(spec["minimum_frames"])
            ):
                start = int(span["start_frame"])
                return start, min(
                    int(span["end_frame_exclusive"]),
                    start + int(spec["maximum_frames"]),
                ), None
        return (
            int(selected_units[0]["start_frame"]),
            int(selected_units[-1]["end_frame_exclusive"]),
            "overlay_reviewed_base_unavailable",
        )
    start = int(selected_units[0]["start_frame"])
    available_end = int(selected_units[-1]["end_frame_exclusive"])
    if measured_policy and component_type in {"WC10", "WC11"}:
        if not int(spec["minimum_frames"]) <= available_end - start <= int(spec["maximum_frames"]):
            return start, available_end, "component_duration_ineligible"
        covered = [span for span in spans if int(span["start_frame"]) < available_end and int(span["end_frame_exclusive"]) > start]
        if (not covered or covered[0]["start_frame"] != start
            or covered[-1]["end_frame_exclusive"] != available_end
            or any(row.get("outcome") != "selected_media" for row in covered)
            or any(a["end_frame_exclusive"] != b["start_frame"] for a, b in zip(covered, covered[1:]))):
            return start, available_end, "component_exact_ordinary_backup_unavailable"
        return start, available_end, None
    end = min(available_end, start + int(spec["maximum_frames"]))
    if end - start < int(spec["minimum_frames"]):
        return start, available_end, "component_duration_ineligible"
    return start, end, None


def build_component_brief_packet(
    initial_plan: Mapping[str, Any], selected_set: Mapping[str, Any], *, alignment: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Build the closed editorial choice packet without external work."""

    plan = _mapping(initial_plan, "component_plan_required")
    selected = _mapping(selected_set, "component_selected_set_required")
    plan_hash, units = _plan_units(plan)
    selected_hash, spans = _selected_spans(selected)
    if plan.get("duration_frames") != selected.get("duration_frames"):
        raise ComponentValidationError("component_handoff_duration_mismatch")
    opportunities = plan.get("component_opportunities")
    if not isinstance(opportunities, list):
        raise ComponentValidationError("component_opportunities_invalid")
    items: list[dict[str, Any]] = []
    occupied_full_screen: list[tuple[int, int, str]] = []
    for index, raw in enumerate(opportunities):
        opportunity = _mapping(raw, f"component_opportunity_invalid:{index}")
        inner = _mapping(
            opportunity.get("opportunity"),
            f"component_opportunity_payload_invalid:{index}",
        )
        component_type = _text(
            inner.get("component_type"),
            f"component_type_invalid:{index}",
            maximum=12,
        )
        if component_type in REJECTED_COMPONENT_IDS or component_type not in COMPONENT_SPECS:
            raise ComponentValidationError(f"component_type_not_admitted:{component_type}")
        canonical_type = "WC06" if component_type == "WB01" else component_type
        ordinary_ids = opportunity.get("ordinary_unit_ids")
        if (
            not isinstance(ordinary_ids, list)
            or not ordinary_ids
            or any(not isinstance(item, str) or item not in units for item in ordinary_ids)
            or len(ordinary_ids) != len(set(ordinary_ids))
        ):
            raise ComponentValidationError(f"component_unit_ids_invalid:{index}")
        selected_units = [units[item] for item in ordinary_ids]
        if any(
            left["end_frame_exclusive"] != right["start_frame"]
            for left, right in zip(selected_units, selected_units[1:])
        ):
            raise ComponentValidationError(f"component_units_not_contiguous:{index}")
        start, end, skip_reason = _target_range(
            canonical_type, ordinary_ids, units, spans,
            measured_policy=plan.get("component_timing_policy") == "measured-component-cues.v1",
        )
        evidence = _mapping(inner.get("evidence"), f"component_evidence_invalid:{index}")
        runtime_ready = is_runtime_ready_component(
            canonical_type, map_story_mode=evidence.get("map_story_mode")
        )
        if canonical_type in {"WC10", "WC11"}:
            if plan.get("component_timing_policy") != "measured-component-cues.v1":
                runtime_ready = False
            else:
                rows = evidence.get("options" if canonical_type == "WC10" else "events")
                key = "option_id" if canonical_type == "WC10" else "event_id"
                maximum = 4 if canonical_type == "WC10" else 6
                if (not isinstance(rows, list) or not 2 <= len(rows) <= maximum
                    or any(not isinstance(row, Mapping) or not isinstance(row.get(key), str) or not row[key].strip()
                           or not isinstance(row.get("label"), str) or not row["label"].strip()
                           or len(row["label"]) > (100 if canonical_type == "WC10" else 120) for row in rows)
                    or len({row[key] for row in rows}) != len(rows)
                    or (canonical_type == "WC10" and evidence.get("chosen_option_id") not in {row[key] for row in rows})):
                    skip_reason = "component_evidence_invalid"
        if canonical_type == "WC06" and skip_reason is None:
            motif_id = evidence.get("motif_id")
            if not isinstance(motif_id, str) or not motif_id:
                # Legacy chess_claim/legal_position_evidence briefs remain
                # replayable, but cannot enter the engine-backed path.
                skip_reason = "wc06_motif_id_required"
            else:
                if motif_for_id(motif_id) is None:
                    skip_reason = "wc06_motif_not_admitted"
        if skip_reason is None and not runtime_ready:
            skip_reason = "canonical_visual_evidence_contract_pending"
        spec = COMPONENT_SPECS[canonical_type]
        if skip_reason is None and spec["layer"] == "full_screen":
            if any(start < prior_end and end > prior_start for prior_start, prior_end, _ in occupied_full_screen):
                skip_reason = "full_screen_component_overlap"

        required_asset_roles = list(spec["asset_roles"])
        variant = spec["variant"]
        if canonical_type == "WC02":
            progression_rows = inner.get("evidence", {}).get("progression_points")
            if not isinstance(progression_rows, list) or not 2 <= len(progression_rows) <= 5:
                raise ComponentValidationError(f"component_wc02_progression_invalid:{index}")
            minimum_duration = 90 + len(progression_rows) * 60
            if skip_reason is None and end - start < minimum_duration:
                skip_reason = "wc02_progression_duration_ineligible"
            if _wc02_person_marginalia(inner.get("evidence", {})):
                # Owner-approved layout: text marginalia around the person, no step stills.
                variant = WC02_PERSON_MARGINALIA_VARIANT
            else:
                required_asset_roles.extend(
                    f"progression_item_{item_index}"
                    for item_index in range(1, len(progression_rows) + 1)
                )
        elif canonical_type == "WC14":
            detail_rows = inner.get("evidence", {}).get("details")
            if not isinstance(detail_rows, list) or not 2 <= len(detail_rows) <= 4:
                raise ComponentValidationError(
                    f"component_wc14_details_invalid:{index}"
                )
            # The owner-approved three-detail proof is legible at 180 frames.
            # Retain a bounded 40-frame allowance per detail plus the 60-frame
            # source-establish/title envelope instead of requiring 225 frames.
            minimum_duration = 60 + len(detail_rows) * 40
            if skip_reason is None and end - start < minimum_duration:
                skip_reason = "wc14_detail_duration_ineligible"
            required_asset_roles.extend(
                f"archival_detail_{item_index}"
                for item_index in range(1, len(detail_rows) + 1)
            )
        item: dict[str, Any] = {
            "opportunity_id": "component_opportunity." + canonical_hash(
                {
                    "plan_hash": plan_hash,
                    "selected_set_hash": selected_hash,
                    "index": index,
                    "beat_id": opportunity.get("beat_id"),
                    "component_type": canonical_type,
                }
            ),
            "ordinal": index + 1,
            "beat_id": opportunity.get("beat_id"),
            "section_id": opportunity.get("section_id"),
            "component_type": canonical_type,
            "component_variant": variant,
            "layer": spec["layer"],
            "start_frame": start,
            "end_frame_exclusive": end,
            "ordinary_unit_ids": copy.deepcopy(ordinary_ids),
            "ordinary_fallback_span_ids": _overlap_span_ids(spans, start, end),
            "reason": inner.get("reason"),
            "placement_requirement": inner.get("placement_requirement"),
            "evidence_ids": copy.deepcopy(inner.get("evidence_ids") or []),
            "evidence": copy.deepcopy(dict(evidence)),
            "eligible": skip_reason is None,
            "skip_reason": skip_reason,
            "required_asset_roles": required_asset_roles,
        }
        if plan.get("component_timing_policy") == "measured-component-cues.v1":
            from .component_timing import resolve_cues
            try:
                item["narration_timing"] = resolve_cues(
                    inner.get("phrase_cues"), component_type=canonical_type, evidence=evidence,
                    alignment=alignment, alignment_hash=plan.get("alignment_hash"), start=start, end=end,
                )
            except ValueError as exc:
                raise ComponentValidationError(str(exc)) from exc
            if item["narration_timing"]["status"] == "unsupported":
                item["eligible"] = False
                item["skip_reason"] = item["narration_timing"]["reason"]
        if item["eligible"] and spec["layer"] == "full_screen":
            occupied_full_screen.append((start, end, str(variant)))
        item["opportunity_hash"] = canonical_hash(item)
        items.append(item)
    for index, item in enumerate(items):
        if item.get("component_type") != "P01":
            continue
        evidence = _mapping(
            item.get("evidence"), f"p01_coordination_evidence_invalid:{index}"
        )
        pair_index = _p01_pair_index(index, evidence, len(items))
        if pair_index is None:
            continue
        paired = items[pair_index]
        if paired.get("component_type") not in P01_SPECIALIST_COMPONENT_IDS:
            raise ComponentValidationError("p01_paired_specialist_invalid")
        if item.get("eligible") is True and paired.get("eligible") is not True:
            item["eligible"] = False
            item["skip_reason"] = "p01_paired_specialist_ineligible"
            item["opportunity_hash"] = canonical_hash(
                {key: value for key, value in item.items() if key != "opportunity_hash"}
            )
    packet: dict[str, Any] = {
        "schema_version": COMPONENT_PACKET_SCHEMA,
        "initial_visual_plan_hash": plan_hash,
        "selected_set_hash": selected_hash,
        "duration_frames": plan["duration_frames"],
        "items": items,
        "choice_policy": {
            "ordinary_fallback_always_retained": True,
            "one_choice_per_opportunity": True,
            "rejected_component_ids": sorted(REJECTED_COMPONENT_IDS),
        },
    }
    packet["packet_hash"] = canonical_hash(packet)
    return packet


def build_fixture_component_brief_response(
    packet: Mapping[str, Any], *, reject_ordinals: Sequence[int] = ()
) -> dict[str, Any]:
    """Create visible test-only choices; it is never a production adapter."""

    source = _mapping(packet, "component_packet_required")
    packet_hash = _self_hash(source, "packet_hash", "component_packet_hash_mismatch")
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_packet_items_invalid")
    rejected = set(reject_ordinals)
    if any(isinstance(item, bool) or not isinstance(item, int) or item < 1 for item in rejected):
        raise ComponentValidationError("fixture_component_reject_ordinals_invalid")
    decisions: list[dict[str, Any]] = []
    for raw in items:
        item = _mapping(raw, "component_packet_item_invalid")
        use_component = (
            item.get("eligible") is True and item.get("ordinal") not in rejected
        )
        decisions.append(
            {
                "opportunity_id": item["opportunity_id"],
                "opportunity_hash": item["opportunity_hash"],
                "decision": "use_component" if use_component else "use_ordinary_fallback",
                "component_type": item["component_type"],
                "viewer_title": (
                    f"War Chess — {item['component_type']}" if use_component else None
                ),
                "viewer_takeaway": (
                    str(item.get("reason") or "Explain the accepted evidence clearly.")[:160]
                    if use_component
                    else None
                ),
            }
        )
    return {
        "schema_version": COMPONENT_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def build_original_graphics_component_brief_response(
    packet: Mapping[str, Any],
) -> dict[str, Any]:
    """Choose only evidence-safe first-party components requiring no source assets.

    This is a code-owned fallback for a production job whose complete ordinary
    selection was explicitly routed to original graphics.  It does not pretend
    to be an editorial/model response and it never invents an identity, map,
    portrait, flag, or other externally evidenced asset.
    """

    source = _mapping(packet, "component_packet_required")
    packet_hash = _self_hash(source, "packet_hash", "component_packet_hash_mismatch")
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_packet_items_invalid")
    decisions: list[dict[str, Any]] = []
    titles = {
        "WC02": "Opening · Middlegame · Endgame",
        "WC06": "Move · Reply · Consequence",
    }
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_packet_item_invalid:{index}")
        roles = item.get("required_asset_roles")
        if not isinstance(roles, list):
            raise ComponentValidationError(
                f"component_required_asset_roles_invalid:{index}"
            )
        use_component = (
            item.get("eligible") is True
            and not roles
            and item.get("component_type") in titles
        )
        evidence = _mapping(
            item.get("evidence"), f"component_evidence_invalid:{index}"
        )
        takeaway = None
        if use_component:
            source_text = (
                "Chess analogy"
                if item.get("component_type") == "WC06"
                else evidence.get("central_subject") or evidence.get("chess_claim")
            )
            compact = " ".join(str(source_text or "").split()).strip()
            if len(compact) > DISPLAY_COPY_LIMITS["viewer_takeaway"]:
                clipped = compact[: DISPLAY_COPY_LIMITS["viewer_takeaway"] - 1]
                compact = (clipped.rsplit(" ", 1)[0] or clipped).rstrip(" ,.;:-") + "…"
            takeaway = _text(
                compact,
                f"component_first_party_takeaway_invalid:{index}",
                maximum=DISPLAY_COPY_LIMITS["viewer_takeaway"],
            )
        decisions.append(
            {
                "opportunity_id": item["opportunity_id"],
                "opportunity_hash": item["opportunity_hash"],
                "decision": "use_component" if use_component else "use_ordinary_fallback",
                "component_type": item["component_type"],
                "viewer_title": titles[str(item["component_type"])] if use_component else None,
                "viewer_takeaway": takeaway,
            }
        )
    return {
        "schema_version": COMPONENT_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def build_selected_media_component_brief_response(
    packet: Mapping[str, Any],
) -> dict[str, Any]:
    """Carry a reviewed R2 component opportunity into the live media pipeline.

    The semantic choice was already made in the frozen military-beat decision.
    This compiler adds no facts: it admits the exact eligible opportunity and
    derives short display copy only from its frozen evidence and reason.
    """

    source = _mapping(packet, "component_packet_required")
    packet_hash = _self_hash(source, "packet_hash", "component_packet_hash_mismatch")
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_packet_items_invalid")

    def compact(value: Any, maximum: int, fallback: str) -> str:
        text = " ".join(str(value or fallback).split()).strip()
        if len(text) > maximum:
            clipped = text[: maximum - 1]
            text = (clipped.rsplit(" ", 1)[0] or clipped).rstrip(" ,.;:-") + "…"
        return _text(text, "component_display_copy_invalid", maximum=maximum)

    decisions: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_packet_item_invalid:{index}")
        evidence = _mapping(
            item.get("evidence"), f"component_evidence_invalid:{index}"
        )
        component_type = str(item.get("component_type"))
        use_component = item.get("eligible") is True
        title_sources = {
            "P01": evidence.get("headline"),
            "P02": evidence.get("headline"),
            "P03": evidence.get("headline"),
            "P14": evidence.get("year"),
            "WC02": evidence.get("central_subject"),
            "WC06": "Chess analogy",
            "WC08": evidence.get("identity"),
            "WC09": " ".join(
                str(value) for value in (evidence.get("statistic"), evidence.get("unit"))
                if value
            ),
            "WC10": "Strategic choice",
            "WC11": "Chronology",
            "WC12": evidence.get("named_person"),
            "WC13": evidence.get("document_label"),
            "WC14": evidence.get("source_title"),
            "WC15": evidence.get("relationship_label"),
        }
        title = (
            compact(title_sources.get(component_type), 80, "War Chess")
            if use_component
            else None
        )
        takeaway = (
            compact(item.get("reason"), 160, "Show the reviewed evidence clearly.")
            if use_component
            else None
        )
        decisions.append(
            {
                "opportunity_id": item["opportunity_id"],
                "opportunity_hash": item["opportunity_hash"],
                "decision": "use_component" if use_component else "use_ordinary_fallback",
                "component_type": component_type,
                "viewer_title": title,
                "viewer_takeaway": takeaway,
            }
        )
    return {
        "schema_version": COMPONENT_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def freeze_component_brief_response(
    packet: Mapping[str, Any], response: Mapping[str, Any]
) -> dict[str, Any]:
    """Validate one complete atomic response and freeze its exact meaning."""

    packet_value = _mapping(packet, "component_packet_required")
    response_value = _mapping(response, "component_response_required")
    packet_hash = _self_hash(
        packet_value, "packet_hash", "component_packet_hash_mismatch"
    )
    if set(response_value) != {"schema_version", "packet_hash", "decisions"}:
        raise ComponentValidationError("component_response_fields_invalid")
    if (
        response_value.get("schema_version") != COMPONENT_RESPONSE_SCHEMA
        or response_value.get("packet_hash") != packet_hash
    ):
        raise ComponentValidationError("component_response_binding_mismatch")
    packet_items = packet_value.get("items")
    decisions = response_value.get("decisions")
    if not isinstance(packet_items, list) or not isinstance(decisions, list):
        raise ComponentValidationError("component_response_decisions_invalid")
    if len(packet_items) != len(decisions):
        raise ComponentValidationError("component_response_incomplete")
    frozen_items: list[dict[str, Any]] = []
    for index, (packet_raw, response_raw) in enumerate(
        zip(packet_items, decisions, strict=True)
    ):
        item = _mapping(packet_raw, f"component_packet_item_invalid:{index}")
        decision = _mapping(response_raw, f"component_decision_invalid:{index}")
        if set(decision) != {
            "opportunity_id",
            "opportunity_hash",
            "decision",
            "component_type",
            "viewer_title",
            "viewer_takeaway",
        }:
            raise ComponentValidationError(f"component_decision_fields_invalid:{index}")
        if (
            decision.get("opportunity_id") != item.get("opportunity_id")
            or decision.get("opportunity_hash") != item.get("opportunity_hash")
            or decision.get("component_type") != item.get("component_type")
        ):
            raise ComponentValidationError(f"component_decision_binding_mismatch:{index}")
        choice = decision.get("decision")
        if choice not in {"use_component", "use_ordinary_fallback"}:
            raise ComponentValidationError(f"component_decision_choice_invalid:{index}")
        if choice == "use_component":
            if item.get("eligible") is not True:
                raise ComponentValidationError(f"component_decision_ineligible:{index}")
            title = _text(
                decision.get("viewer_title"),
                f"component_viewer_title_invalid:{index}",
                maximum=80,
            )
            takeaway = _text(
                decision.get("viewer_takeaway"),
                f"component_viewer_takeaway_invalid:{index}",
                maximum=160,
            )
        else:
            if decision.get("viewer_title") is not None or decision.get("viewer_takeaway") is not None:
                raise ComponentValidationError(f"component_fallback_copy_forbidden:{index}")
            title = None
            takeaway = None
        frozen_items.append(
            {
                "opportunity": copy.deepcopy(dict(item)),
                "decision": choice,
                "viewer_title": title,
                "viewer_takeaway": takeaway,
                "decision_hash": canonical_hash(copy.deepcopy(dict(decision))),
            }
        )
    for index, row in enumerate(frozen_items):
        opportunity = _mapping(
            row.get("opportunity"), f"frozen_component_opportunity_invalid:{index}"
        )
        if opportunity.get("component_type") != "P01" or row.get("decision") != "use_component":
            continue
        evidence = _mapping(
            opportunity.get("evidence"), f"p01_coordination_evidence_invalid:{index}"
        )
        pair_index = _p01_pair_index(index, evidence, len(frozen_items))
        if pair_index is None:
            continue
        paired = frozen_items[pair_index]
        paired_opportunity = _mapping(
            paired.get("opportunity"),
            f"frozen_component_opportunity_invalid:{pair_index}",
        )
        if (
            paired_opportunity.get("component_type")
            not in P01_SPECIALIST_COMPONENT_IDS
            or paired.get("decision") != "use_component"
        ):
            raise ComponentValidationError("p01_paired_specialist_not_selected")
    frozen: dict[str, Any] = {
        "schema_version": FROZEN_COMPONENT_BRIEF_SCHEMA,
        "packet_hash": packet_hash,
        "initial_visual_plan_hash": packet_value["initial_visual_plan_hash"],
        "selected_set_hash": packet_value["selected_set_hash"],
        "items": frozen_items,
    }
    frozen["frozen_brief_hash"] = canonical_hash(frozen)
    return frozen


def build_component_display_copy_repair_packet(
    frozen_brief: Mapping[str, Any],
) -> dict[str, Any]:
    """Identify only display fields that exceed the code-owned render budget."""

    frozen = _mapping(frozen_brief, "frozen_component_brief_required")
    frozen_hash = _self_hash(
        frozen, "frozen_brief_hash", "frozen_component_brief_hash_mismatch"
    )
    rows = frozen.get("items")
    if not isinstance(rows, list):
        raise ComponentValidationError("frozen_component_items_invalid")
    items: list[dict[str, Any]] = []
    for index, raw in enumerate(rows):
        row = _mapping(raw, f"frozen_component_item_invalid:{index}")
        opportunity = _mapping(
            row.get("opportunity"), f"frozen_component_opportunity_invalid:{index}"
        )
        if row.get("decision") != "use_component":
            continue
        for field, maximum in DISPLAY_COPY_LIMITS.items():
            value = row.get(field)
            if not isinstance(value, str):
                raise ComponentValidationError(
                    f"component_display_copy_field_invalid:{index}:{field}"
                )
            if len(value) <= maximum:
                continue
            item = {
                "opportunity_id": opportunity.get("opportunity_id"),
                "opportunity_hash": opportunity.get("opportunity_hash"),
                "field": field,
                "current_value": value,
                "maximum_characters": maximum,
            }
            item["item_hash"] = canonical_hash(item)
            items.append(item)
    packet: dict[str, Any] = {
        "schema_version": COMPONENT_DISPLAY_COPY_REPAIR_PACKET_SCHEMA,
        "frozen_brief_hash": frozen_hash,
        "items": items,
        "repair_policy": {
            "field_scoped_only": True,
            "facts_immutable": True,
            "frame_ownership_immutable": True,
            "asset_bindings_immutable": True,
        },
    }
    packet["packet_hash"] = canonical_hash(packet)
    return packet


def build_fixture_component_display_copy_repair_response(
    packet: Mapping[str, Any],
) -> dict[str, Any]:
    """Return deterministic fixture copy within each served field budget."""

    source = _mapping(packet, "component_display_copy_repair_packet_required")
    packet_hash = _self_hash(
        source,
        "packet_hash",
        "component_display_copy_repair_packet_hash_mismatch",
    )
    items = source.get("items")
    if not isinstance(items, list) or not items:
        raise ComponentValidationError("component_display_copy_repair_items_invalid")
    repairs: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_display_copy_repair_item_invalid:{index}")
        maximum = item.get("maximum_characters")
        current = item.get("current_value")
        if (
            isinstance(maximum, bool)
            or not isinstance(maximum, int)
            or not isinstance(current, str)
        ):
            raise ComponentValidationError(
                f"component_display_copy_repair_item_invalid:{index}"
            )
        replacement = current[:maximum].rstrip(" ,.;:-")
        if not replacement:
            replacement = current[:maximum]
        repairs.append(
            {
                "opportunity_id": item["opportunity_id"],
                "item_hash": item["item_hash"],
                "field": item["field"],
                "replacement": replacement,
            }
        )
    return {
        "schema_version": COMPONENT_DISPLAY_COPY_REPAIR_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "repairs": repairs,
    }


def freeze_component_display_copy_repair_response(
    packet: Mapping[str, Any], response: Mapping[str, Any]
) -> dict[str, Any]:
    """Freeze a complete field-only repair without accepting component facts."""

    packet_value = _mapping(packet, "component_display_copy_repair_packet_required")
    response_value = _mapping(response, "component_display_copy_repair_response_required")
    packet_hash = _self_hash(
        packet_value,
        "packet_hash",
        "component_display_copy_repair_packet_hash_mismatch",
    )
    if set(response_value) != {"schema_version", "packet_hash", "repairs"}:
        raise ComponentValidationError("component_display_copy_repair_response_fields_invalid")
    if (
        response_value.get("schema_version")
        != COMPONENT_DISPLAY_COPY_REPAIR_RESPONSE_SCHEMA
        or response_value.get("packet_hash") != packet_hash
    ):
        raise ComponentValidationError("component_display_copy_repair_response_binding_mismatch")
    items = packet_value.get("items")
    repairs = response_value.get("repairs")
    if not isinstance(items, list) or not isinstance(repairs, list):
        raise ComponentValidationError("component_display_copy_repair_response_invalid")
    if not items or len(items) != len(repairs):
        raise ComponentValidationError("component_display_copy_repair_response_incomplete")
    frozen_repairs: list[dict[str, Any]] = []
    for index, (raw_item, raw_repair) in enumerate(zip(items, repairs, strict=True)):
        item = _mapping(raw_item, f"component_display_copy_repair_item_invalid:{index}")
        repair = _mapping(
            raw_repair, f"component_display_copy_repair_decision_invalid:{index}"
        )
        if set(repair) != {"opportunity_id", "item_hash", "field", "replacement"}:
            raise ComponentValidationError(
                f"component_display_copy_repair_decision_fields_invalid:{index}"
            )
        if (
            repair.get("opportunity_id") != item.get("opportunity_id")
            or repair.get("item_hash") != item.get("item_hash")
            or repair.get("field") != item.get("field")
        ):
            raise ComponentValidationError(
                f"component_display_copy_repair_decision_binding_mismatch:{index}"
            )
        maximum = item.get("maximum_characters")
        replacement = _text(
            repair.get("replacement"),
            f"component_display_copy_repair_replacement_invalid:{index}",
            maximum=maximum if isinstance(maximum, int) else 0,
        )
        frozen_repairs.append(
            {
                "item": copy.deepcopy(dict(item)),
                "replacement": replacement,
                "repair_hash": canonical_hash(copy.deepcopy(dict(repair))),
            }
        )
    frozen: dict[str, Any] = {
        "schema_version": FROZEN_COMPONENT_DISPLAY_COPY_REPAIR_SCHEMA,
        "packet_hash": packet_hash,
        "frozen_brief_hash": packet_value["frozen_brief_hash"],
        "repairs": frozen_repairs,
    }
    frozen["frozen_display_copy_repair_hash"] = canonical_hash(frozen)
    return frozen


def apply_component_display_copy_repairs(
    frozen_brief: Mapping[str, Any], frozen_repair: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply only the exact served copy fields and retain immutable lineage."""

    source = _mapping(frozen_brief, "frozen_component_brief_required")
    source_hash = _self_hash(
        source, "frozen_brief_hash", "frozen_component_brief_hash_mismatch"
    )
    repair = _mapping(frozen_repair, "frozen_component_display_copy_repair_required")
    repair_hash = _self_hash(
        repair,
        "frozen_display_copy_repair_hash",
        "frozen_component_display_copy_repair_hash_mismatch",
    )
    if repair.get("frozen_brief_hash") != source_hash:
        raise ComponentValidationError("component_display_copy_repair_brief_mismatch")
    rows = source.get("items")
    repairs = repair.get("repairs")
    if not isinstance(rows, list) or not isinstance(repairs, list) or not repairs:
        raise ComponentValidationError("component_display_copy_repair_shape_invalid")
    by_opportunity = {
        str(_mapping(row, "frozen_component_item_invalid")["opportunity"]["opportunity_id"]): row
        for row in rows
    }
    effective = copy.deepcopy(dict(source))
    effective_rows = {
        str(row["opportunity"]["opportunity_id"]): row for row in effective["items"]
    }
    seen: set[tuple[str, str]] = set()
    for index, raw in enumerate(repairs):
        frozen_row = _mapping(raw, f"frozen_component_display_copy_repair_invalid:{index}")
        item = _mapping(
            frozen_row.get("item"), f"component_display_copy_repair_item_invalid:{index}"
        )
        opportunity_id = str(item.get("opportunity_id"))
        field = str(item.get("field"))
        key = (opportunity_id, field)
        if key in seen or opportunity_id not in by_opportunity or field not in DISPLAY_COPY_LIMITS:
            raise ComponentValidationError("component_display_copy_repair_scope_invalid")
        seen.add(key)
        authoritative = by_opportunity[opportunity_id]
        if (
            authoritative.get(field) != item.get("current_value")
            or authoritative["opportunity"].get("opportunity_hash")
            != item.get("opportunity_hash")
            or DISPLAY_COPY_LIMITS[field] != item.get("maximum_characters")
        ):
            raise ComponentValidationError("component_display_copy_repair_authority_changed")
        target = effective_rows[opportunity_id]
        target[field] = frozen_row["replacement"]
        target.setdefault("display_copy_repairs", {})[field] = frozen_row["repair_hash"]
    del effective["frozen_brief_hash"]
    effective["source_frozen_brief_hash"] = source_hash
    effective["display_copy_repair_hash"] = repair_hash
    effective["frozen_brief_hash"] = canonical_hash(effective)
    return effective


def compile_component_obligations(
    frozen_brief: Mapping[str, Any], *, fixture_only: bool
) -> dict[str, Any]:
    """Translate chosen briefs into typed offline obligations."""

    frozen = _mapping(frozen_brief, "frozen_component_brief_required")
    frozen_hash = _self_hash(
        frozen, "frozen_brief_hash", "frozen_component_brief_hash_mismatch"
    )
    items = frozen.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("frozen_component_items_invalid")
    obligations: list[dict[str, Any]] = []
    selected_components: list[dict[str, Any]] = []
    for item_index, raw in enumerate(items):
        row = _mapping(raw, f"frozen_component_item_invalid:{item_index}")
        opportunity = _mapping(
            row.get("opportunity"), f"frozen_component_opportunity_invalid:{item_index}"
        )
        decision = row.get("decision")
        if decision not in {"use_component", "use_ordinary_fallback"}:
            raise ComponentValidationError(
                f"frozen_component_decision_invalid:{item_index}"
            )
        component_type = str(opportunity["component_type"])
        component_id = f"component.{opportunity['opportunity_id'].split('.')[-1]}"
        fallback_reason = None
        if decision == "use_ordinary_fallback":
            fallback_reason = str(
                opportunity.get("skip_reason") or "editorial_fallback"
            )
        component = {
            "component_id": component_id,
            "opportunity_id": opportunity["opportunity_id"],
            "component_type": component_type,
            "component_variant": opportunity["component_variant"],
            "layer": opportunity["layer"],
            "start_frame": opportunity["start_frame"],
            "end_frame_exclusive": opportunity["end_frame_exclusive"],
            "ordinary_fallback_span_ids": copy.deepcopy(
                opportunity["ordinary_fallback_span_ids"]
            ),
            "viewer_title": row["viewer_title"],
            "viewer_takeaway": row["viewer_takeaway"],
            "evidence": copy.deepcopy(opportunity["evidence"]),
            "evidence_ids": copy.deepcopy(opportunity["evidence_ids"]),
            "evidence_hash": canonical_hash(opportunity["evidence"]),
            "decision": decision,
            "fallback_reason": fallback_reason,
            "fixture_only": fixture_only,
        }
        if "narration_timing" in opportunity:
            component["narration_timing"] = copy.deepcopy(opportunity["narration_timing"])
        component["component_brief_hash"] = canonical_hash(component)
        selected_components.append(component)
        if decision != "use_component":
            continue
        for role_index, role in enumerate(opportunity["required_asset_roles"]):
            obligation = {
                "obligation_id": "component_obligation." + canonical_hash(
                    {
                        "frozen_brief_hash": frozen_hash,
                        "component_id": component_id,
                        "role": role,
                        "role_index": role_index,
                    }
                ),
                "component_id": component_id,
                "component_type": component_type,
                "asset_role": role,
                "primary_limit": 1,
                "reserve_limit": 1,
                "metadata_candidate_limit": 5,
                "materialization_limit": 2,
                "rights_required": True,
                "fixture_only": fixture_only,
                "fallback": "ordinary_media",
            }
            obligation["obligation_hash"] = canonical_hash(obligation)
            obligations.append(obligation)
    result: dict[str, Any] = {
        "schema_version": COMPONENT_OBLIGATIONS_SCHEMA,
        "frozen_brief_hash": frozen_hash,
        "selected_set_hash": frozen["selected_set_hash"],
        "fixture_only": fixture_only,
        "components": selected_components,
        "obligations": obligations,
        "network_calls": 0,
        "provider_calls": 0,
        "provider_cost_micro_usd": 0,
    }
    result["obligations_hash"] = canonical_hash(result)
    return result


def build_component_asset_binding(
    obligation: Mapping[str, Any],
    *,
    artifact_id: str,
    sha256: str,
    size_bytes: int,
    media_type: str,
    producer: str,
    source_lineage_hash: str,
    rights_state: str,
    fixture_only: bool,
) -> dict[str, Any]:
    """Bind one reviewed, rights-eligible asset to one exact obligation."""

    row = _mapping(obligation, "component_asset_obligation_required")
    _self_hash(row, "obligation_hash", "component_asset_obligation_hash_mismatch")
    obligation_id = _text(
        row.get("obligation_id"), "component_asset_obligation_id_invalid"
    )
    component_id = _text(
        row.get("component_id"), "component_asset_component_id_invalid"
    )
    asset_role = _text(row.get("asset_role"), "component_asset_role_invalid")
    artifact = _text(artifact_id, "component_asset_artifact_id_invalid")
    digest = _hex64(sha256, "component_asset_sha256_invalid")
    if (
        isinstance(size_bytes, bool)
        or not isinstance(size_bytes, int)
        or not 0 < size_bytes <= 25 * 1024 * 1024
    ):
        raise ComponentValidationError("component_asset_size_invalid")
    media = _text(media_type, "component_asset_media_type_invalid")
    expected_fixture = row.get("fixture_only") is True
    if not _asset_media_type_allowed(
        asset_role, media, fixture_only=expected_fixture
    ):
        raise ComponentValidationError("component_asset_media_type_mismatch")
    if fixture_only is not expected_fixture:
        raise ComponentValidationError("component_asset_fixture_scope_mismatch")
    allowed_rights = {"fixture_only"} if expected_fixture else {"verified", "owner_evidence_required", "blocked"}
    if rights_state not in allowed_rights:
        raise ComponentValidationError("component_asset_rights_invalid")
    identity = {
        "obligation_id": obligation_id,
        "component_id": component_id,
        "asset_role": asset_role,
        "artifact_id": artifact,
        "sha256": digest,
        "size_bytes": size_bytes,
        "media_type": media,
    }
    binding: dict[str, Any] = {
        "binding_id": "component_asset_binding." + canonical_hash(identity),
        **identity,
        "producer": _text(producer, "component_asset_producer_invalid"),
        "source_lineage_hash": _hex64(
            source_lineage_hash, "component_asset_lineage_invalid"
        ),
        "rights_state": rights_state,
        "fixture_only": fixture_only,
    }
    binding["binding_hash"] = canonical_hash(binding)
    return binding


def build_fixture_component_asset_binding(
    obligation: Mapping[str, Any],
    *,
    artifact_id: str,
    sha256: str,
    size_bytes: int,
    media_type: str,
    producer: str,
    source_lineage_hash: str,
) -> dict[str, Any]:
    """Compatibility wrapper for a controlled fixture binding."""

    return build_component_asset_binding(
        obligation,
        artifact_id=artifact_id,
        sha256=sha256,
        size_bytes=size_bytes,
        media_type=media_type,
        producer=producer,
        source_lineage_hash=source_lineage_hash,
        rights_state="fixture_only",
        fixture_only=True,
    )


def build_component_asset_candidate(
    obligation: Mapping[str, Any],
    *,
    artifact_id: str,
    sha256: str,
    size_bytes: int,
    media_type: str,
    producer: str,
    source_lineage_hash: str,
    visible_label: str,
    rights_state: str,
    fixture_only: bool,
) -> dict[str, Any]:
    """Describe one rights-eligible asset before editorial selection."""

    row = _mapping(obligation, "component_asset_obligation_required")
    obligation_hash = _self_hash(
        row, "obligation_hash", "component_asset_obligation_hash_mismatch"
    )
    obligation_id = _text(
        row.get("obligation_id"), "component_asset_obligation_id_invalid"
    )
    component_id = _text(
        row.get("component_id"), "component_asset_component_id_invalid"
    )
    asset_role = _text(row.get("asset_role"), "component_asset_role_invalid")
    artifact = _text(artifact_id, "component_asset_artifact_id_invalid")
    digest = _hex64(sha256, "component_asset_sha256_invalid")
    if (
        isinstance(size_bytes, bool)
        or not isinstance(size_bytes, int)
        or not 0 < size_bytes <= 25 * 1024 * 1024
    ):
        raise ComponentValidationError("component_asset_size_invalid")
    media = _text(media_type, "component_asset_media_type_invalid")
    expected_fixture = row.get("fixture_only") is True
    if not _asset_media_type_allowed(
        asset_role, media, fixture_only=expected_fixture
    ):
        raise ComponentValidationError("component_asset_media_type_mismatch")
    if fixture_only is not expected_fixture:
        raise ComponentValidationError("component_asset_fixture_scope_mismatch")
    allowed_rights = {"fixture_only"} if expected_fixture else {"verified", "owner_evidence_required", "blocked"}
    if rights_state not in allowed_rights:
        raise ComponentValidationError("component_asset_rights_invalid")
    identity = {
        "obligation_id": obligation_id,
        "obligation_hash": obligation_hash,
        "component_id": component_id,
        "asset_role": asset_role,
        "artifact_id": artifact,
        "sha256": digest,
        "size_bytes": size_bytes,
        "media_type": media,
    }
    candidate: dict[str, Any] = {
        "candidate_id": "component_asset_candidate." + canonical_hash(identity),
        **identity,
        "producer": _text(producer, "component_asset_producer_invalid"),
        "source_lineage_hash": _hex64(
            source_lineage_hash, "component_asset_lineage_invalid"
        ),
        "visible_label": _text(
            visible_label, "component_asset_visible_label_invalid", maximum=120
        ),
        "rights_state": rights_state,
        "fixture_only": fixture_only,
    }
    candidate["candidate_hash"] = canonical_hash(candidate)
    return candidate


def build_fixture_component_asset_candidate(
    obligation: Mapping[str, Any],
    *,
    artifact_id: str,
    sha256: str,
    size_bytes: int,
    media_type: str,
    producer: str,
    source_lineage_hash: str,
    visible_label: str,
) -> dict[str, Any]:
    """Compatibility wrapper for a controlled fixture candidate."""

    return build_component_asset_candidate(
        obligation,
        artifact_id=artifact_id,
        sha256=sha256,
        size_bytes=size_bytes,
        media_type=media_type,
        producer=producer,
        source_lineage_hash=source_lineage_hash,
        visible_label=visible_label,
        rights_state="fixture_only",
        fixture_only=True,
    )


def build_component_asset_review_packet(
    obligations: Mapping[str, Any],
    candidates: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Build a closed editorial packet from code-owned asset candidates."""

    source = _mapping(obligations, "component_obligations_required")
    obligations_hash = _self_hash(
        source, "obligations_hash", "component_obligations_hash_mismatch"
    )
    obligation_rows = source.get("obligations")
    if not isinstance(obligation_rows, list):
        raise ComponentValidationError("component_obligations_shape_invalid")
    obligations_by_id: dict[str, Mapping[str, Any]] = {}
    for index, raw in enumerate(obligation_rows):
        row = _mapping(raw, f"component_obligation_invalid:{index}")
        _self_hash(
            row,
            "obligation_hash",
            f"component_obligation_hash_mismatch:{index}",
        )
        obligation_id = _text(
            row.get("obligation_id"), f"component_obligation_id_invalid:{index}"
        )
        if obligation_id in obligations_by_id:
            raise ComponentValidationError("component_obligation_id_duplicate")
        obligations_by_id[obligation_id] = row
    candidate_keys = {
        "candidate_id",
        "obligation_id",
        "obligation_hash",
        "component_id",
        "asset_role",
        "artifact_id",
        "sha256",
        "size_bytes",
        "media_type",
        "producer",
        "source_lineage_hash",
        "visible_label",
        "rights_state",
        "fixture_only",
        "candidate_hash",
    }
    by_obligation: dict[str, list[dict[str, Any]]] = {}
    seen_candidates: set[str] = set()
    seen_artifacts: set[tuple[str, str]] = set()
    for index, raw in enumerate(candidates):
        candidate = _mapping(raw, f"component_asset_candidate_invalid:{index}")
        if set(candidate) != candidate_keys:
            raise ComponentValidationError(
                f"component_asset_candidate_shape_invalid:{index}"
            )
        _self_hash(
            candidate,
            "candidate_hash",
            f"component_asset_candidate_hash_mismatch:{index}",
        )
        obligation_id = _text(
            candidate.get("obligation_id"),
            f"component_asset_candidate_obligation_invalid:{index}",
        )
        obligation = obligations_by_id.get(obligation_id)
        if obligation is None:
            raise ComponentValidationError(
                f"component_asset_candidate_obligation_unknown:{index}"
            )
        expected = build_component_asset_candidate(
            obligation,
            artifact_id=_text(
                candidate.get("artifact_id"),
                f"component_asset_candidate_artifact_invalid:{index}",
            ),
            sha256=_hex64(
                candidate.get("sha256"),
                f"component_asset_candidate_sha256_invalid:{index}",
            ),
            size_bytes=candidate.get("size_bytes"),
            media_type=_text(
                candidate.get("media_type"),
                f"component_asset_candidate_media_type_invalid:{index}",
            ),
            producer=_text(
                candidate.get("producer"),
                f"component_asset_candidate_producer_invalid:{index}",
            ),
            source_lineage_hash=_hex64(
                candidate.get("source_lineage_hash"),
                f"component_asset_candidate_lineage_invalid:{index}",
            ),
            visible_label=_text(
                candidate.get("visible_label"),
                f"component_asset_candidate_label_invalid:{index}",
                maximum=120,
            ),
            rights_state=candidate.get("rights_state"),
            fixture_only=candidate.get("fixture_only"),
        )
        if dict(candidate) != expected:
            raise ComponentValidationError(
                f"component_asset_candidate_identity_mismatch:{index}"
            )
        candidate_id = expected["candidate_id"]
        artifact_id = expected["artifact_id"]
        if candidate_id in seen_candidates:
            raise ComponentValidationError(
                f"component_asset_candidate_id_duplicate:{index}:{candidate_id}"
            )
        artifact_scope = (obligation_id, artifact_id)
        if artifact_scope in seen_artifacts:
            raise ComponentValidationError(
                f"component_asset_artifact_duplicate:{index}:{artifact_id}"
            )
        seen_candidates.add(candidate_id)
        seen_artifacts.add(artifact_scope)
        by_obligation.setdefault(obligation_id, []).append(copy.deepcopy(expected))
    items: list[dict[str, Any]] = []
    for obligation_id, obligation in obligations_by_id.items():
        served = by_obligation.get(obligation_id, [])
        if not served:
            continue
        if len(served) > int(obligation["metadata_candidate_limit"]):
            raise ComponentValidationError("component_asset_candidate_limit_exceeded")
        item = {
            "obligation": copy.deepcopy(dict(obligation)),
            "candidates": served,
            "primary_limit": 1,
            "reserve_limit": int(obligation["reserve_limit"]),
            "fallback": "ordinary_media",
        }
        item["item_hash"] = canonical_hash(item)
        items.append(item)
    packet: dict[str, Any] = {
        "schema_version": COMPONENT_ASSET_REVIEW_PACKET_SCHEMA,
        "obligations_hash": obligations_hash,
        "fixture_only": source.get("fixture_only") is True,
        "items": items,
        "selection_policy": {
            "complete_atomic_response": True,
            "one_primary_per_obligation": True,
            "optional_reserve": True,
            "ordinary_fallback_retained": True,
        },
    }
    packet["packet_hash"] = canonical_hash(packet)
    return packet


def build_fixture_component_asset_review_response(
    packet: Mapping[str, Any], *, reject_obligation_ids: Sequence[str] = ()
) -> dict[str, Any]:
    """Select the first controlled candidate for each served fixture obligation."""

    source = _mapping(packet, "component_asset_review_packet_required")
    packet_hash = _self_hash(
        source, "packet_hash", "component_asset_review_packet_hash_mismatch"
    )
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_asset_review_items_invalid")
    rejected = set(reject_obligation_ids)
    if len(rejected) != len(reject_obligation_ids) or any(
        not isinstance(value, str) or not value for value in rejected
    ):
        raise ComponentValidationError("component_asset_review_rejections_invalid")
    decisions: list[dict[str, Any]] = []
    served_ids: set[str] = set()
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_asset_review_item_invalid:{index}")
        obligation = _mapping(
            item.get("obligation"), f"component_asset_review_obligation_invalid:{index}"
        )
        candidates = item.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ComponentValidationError(
                f"component_asset_review_candidates_invalid:{index}"
            )
        obligation_id = str(obligation["obligation_id"])
        served_ids.add(obligation_id)
        fallback = obligation_id in rejected
        decisions.append(
            {
                "obligation_id": obligation_id,
                "item_hash": item["item_hash"],
                "decision": "use_ordinary_fallback" if fallback else "select_primary",
                "primary_candidate_id": None if fallback else candidates[0]["candidate_id"],
                "reserve_candidate_id": None,
                "evidence_reason": (
                    "Controlled fixture asset rejected for fallback."
                    if fallback
                    else "Controlled fixture asset visibly matches its bounded obligation."
                ),
            }
        )
    if rejected - served_ids:
        raise ComponentValidationError("component_asset_review_rejection_unknown")
    return {
        "schema_version": COMPONENT_ASSET_REVIEW_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def build_verified_component_asset_review_response(
    packet: Mapping[str, Any],
) -> dict[str, Any]:
    """Deterministically carry reviewed R3 images into exact component roles."""

    source = _mapping(packet, "component_asset_review_packet_required")
    packet_hash = _self_hash(
        source, "packet_hash", "component_asset_review_packet_hash_mismatch"
    )
    if source.get("fixture_only") is not False:
        raise ComponentValidationError("verified_component_asset_review_requires_live")
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_asset_review_items_invalid")
    used_by_component: dict[str, set[str]] = {}
    decisions: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_asset_review_item_invalid:{index}")
        obligation = _mapping(
            item.get("obligation"), f"component_asset_review_obligation_invalid:{index}"
        )
        candidates = item.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ComponentValidationError(
                f"component_asset_review_candidates_invalid:{index}"
            )
        if any(
            not isinstance(candidate, Mapping)
            or candidate.get("rights_state") not in {"verified", "owner_evidence_required", "blocked"}
            or candidate.get("fixture_only") is not False
            for candidate in candidates
        ):
            raise ComponentValidationError(
                f"component_asset_review_candidate_rights_invalid:{index}"
            )
        component_id = str(obligation["component_id"])
        component_type = str(obligation["component_type"])
        used = used_by_component.setdefault(component_id, set())
        primary = next(
            (
                candidate
                for candidate in candidates
                if component_type not in {"WC07", "WC15"}
                or candidate["artifact_id"] not in used
            ),
            None,
        )
        if primary is not None:
            used.add(str(primary["artifact_id"]))
        decisions.append(
            {
                "obligation_id": obligation["obligation_id"],
                "item_hash": item["item_hash"],
                "decision": (
                    "select_primary" if primary is not None else "use_ordinary_fallback"
                ),
                "primary_candidate_id": (
                    None if primary is None else primary["candidate_id"]
                ),
                "reserve_candidate_id": None,
                "evidence_reason": (
                    "The rights-verified R3 selection is carried into this exact role."
                    if primary is not None
                    else "No distinct rights-verified R3 image remained for this role."
                ),
            }
        )
    return {
        "schema_version": COMPONENT_ASSET_REVIEW_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def freeze_component_asset_review_response(
    packet: Mapping[str, Any], response: Mapping[str, Any]
) -> dict[str, Any]:
    """Validate a complete asset choice without allowing invented candidates."""

    packet_value = _mapping(packet, "component_asset_review_packet_required")
    response_value = _mapping(response, "component_asset_review_response_required")
    packet_hash = _self_hash(
        packet_value, "packet_hash", "component_asset_review_packet_hash_mismatch"
    )
    if set(response_value) != {"schema_version", "packet_hash", "decisions"}:
        raise ComponentValidationError("component_asset_review_response_fields_invalid")
    if (
        response_value.get("schema_version") != COMPONENT_ASSET_REVIEW_RESPONSE_SCHEMA
        or response_value.get("packet_hash") != packet_hash
    ):
        raise ComponentValidationError("component_asset_review_response_binding_mismatch")
    items = packet_value.get("items")
    decisions = response_value.get("decisions")
    if not isinstance(items, list) or not isinstance(decisions, list):
        raise ComponentValidationError("component_asset_review_decisions_invalid")
    if len(items) != len(decisions):
        raise ComponentValidationError("component_asset_review_response_incomplete")
    frozen_decisions: list[dict[str, Any]] = []
    for index, (raw_item, raw_decision) in enumerate(zip(items, decisions, strict=True)):
        item = _mapping(raw_item, f"component_asset_review_item_invalid:{index}")
        decision = _mapping(
            raw_decision, f"component_asset_review_decision_invalid:{index}"
        )
        if set(decision) != {
            "obligation_id",
            "item_hash",
            "decision",
            "primary_candidate_id",
            "reserve_candidate_id",
            "evidence_reason",
        }:
            raise ComponentValidationError(
                f"component_asset_review_decision_fields_invalid:{index}"
            )
        obligation = _mapping(
            item.get("obligation"), f"component_asset_review_obligation_invalid:{index}"
        )
        if (
            decision.get("obligation_id") != obligation.get("obligation_id")
            or decision.get("item_hash") != item.get("item_hash")
        ):
            raise ComponentValidationError(
                f"component_asset_review_decision_binding_mismatch:{index}"
            )
        candidates = item.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ComponentValidationError(
                f"component_asset_review_candidates_invalid:{index}"
            )
        by_id = {candidate["candidate_id"]: candidate for candidate in candidates}
        if len(by_id) != len(candidates):
            raise ComponentValidationError("component_asset_candidate_duplicate")
        choice = decision.get("decision")
        if choice not in {"select_primary", "use_ordinary_fallback"}:
            raise ComponentValidationError(
                f"component_asset_review_choice_invalid:{index}"
            )
        reason = _text(
            decision.get("evidence_reason"),
            f"component_asset_review_reason_invalid:{index}",
            maximum=240,
        )
        primary_id = decision.get("primary_candidate_id")
        reserve_id = decision.get("reserve_candidate_id")
        if choice == "select_primary":
            if not isinstance(primary_id, str) or primary_id not in by_id:
                raise ComponentValidationError(
                    f"component_asset_review_primary_invalid:{index}"
                )
            if reserve_id is not None and (
                not isinstance(reserve_id, str)
                or reserve_id not in by_id
                or reserve_id == primary_id
                or int(item["reserve_limit"]) < 1
            ):
                raise ComponentValidationError(
                    f"component_asset_review_reserve_invalid:{index}"
                )
            primary = copy.deepcopy(dict(by_id[primary_id]))
            reserve = (
                copy.deepcopy(dict(by_id[reserve_id]))
                if isinstance(reserve_id, str)
                else None
            )
        else:
            if primary_id is not None or reserve_id is not None:
                raise ComponentValidationError(
                    f"component_asset_review_fallback_candidate_forbidden:{index}"
                )
            primary = None
            reserve = None
        frozen_decisions.append(
            {
                "obligation": copy.deepcopy(dict(obligation)),
                "decision": choice,
                "primary_candidate": primary,
                "reserve_candidate": reserve,
                "evidence_reason": reason,
                "decision_hash": canonical_hash(copy.deepcopy(dict(decision))),
            }
        )
    frozen: dict[str, Any] = {
        "schema_version": FROZEN_COMPONENT_ASSET_REVIEW_SCHEMA,
        "packet_hash": packet_hash,
        "obligations_hash": packet_value["obligations_hash"],
        "fixture_only": packet_value.get("fixture_only") is True,
        "decisions": frozen_decisions,
    }
    frozen["frozen_asset_review_hash"] = canonical_hash(frozen)
    return frozen


def compile_component_asset_bindings(
    obligations: Mapping[str, Any], frozen_review: Mapping[str, Any]
) -> list[dict[str, Any]]:
    """Compile only editorially selected candidates into exact asset bindings."""

    source = _mapping(obligations, "component_obligations_required")
    obligations_hash = _self_hash(
        source, "obligations_hash", "component_obligations_hash_mismatch"
    )
    review = _mapping(frozen_review, "frozen_component_asset_review_required")
    _self_hash(
        review,
        "frozen_asset_review_hash",
        "frozen_component_asset_review_hash_mismatch",
    )
    if review.get("obligations_hash") != obligations_hash:
        raise ComponentValidationError("component_asset_review_obligations_mismatch")
    rows = source.get("obligations")
    decisions = review.get("decisions")
    if not isinstance(rows, list) or not isinstance(decisions, list):
        raise ComponentValidationError("component_asset_review_shape_invalid")
    by_id = {row["obligation_id"]: row for row in rows}
    bindings: list[dict[str, Any]] = []
    for index, raw in enumerate(decisions):
        decision = _mapping(raw, f"component_asset_review_decision_invalid:{index}")
        obligation = _mapping(
            decision.get("obligation"), f"component_asset_review_obligation_invalid:{index}"
        )
        obligation_id = str(obligation.get("obligation_id"))
        authoritative = by_id.get(obligation_id)
        if authoritative is None or dict(obligation) != dict(authoritative):
            raise ComponentValidationError(
                f"component_asset_review_obligation_changed:{index}"
            )
        if decision.get("decision") != "select_primary":
            continue
        candidate = _mapping(
            decision.get("primary_candidate"),
            f"component_asset_review_primary_missing:{index}",
        )
        bindings.append(
            build_component_asset_binding(
                authoritative,
                artifact_id=candidate["artifact_id"],
                sha256=candidate["sha256"],
                size_bytes=candidate["size_bytes"],
                media_type=candidate["media_type"],
                producer=candidate["producer"],
                source_lineage_hash=candidate["source_lineage_hash"],
                rights_state=candidate["rights_state"],
                fixture_only=candidate["fixture_only"],
            )
        )
    return bindings


def compile_component_manifest(
    obligations: Mapping[str, Any],
    selected_set: Mapping[str, Any],
    *,
    asset_bindings: Sequence[Mapping[str, Any]] = (),
    wc06_plans: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Compile reviewed fixture or verified component-asset evidence."""

    source = _mapping(obligations, "component_obligations_required")
    obligations_hash = _self_hash(
        source, "obligations_hash", "component_obligations_hash_mismatch"
    )
    fixture_only = source.get("fixture_only") is True
    selected_hash, selected_spans = _selected_spans(
        _mapping(selected_set, "component_selected_set_required")
    )
    if selected_hash != source.get("selected_set_hash"):
        raise ComponentValidationError("component_manifest_selected_set_mismatch")
    spans_by_id = {str(row["span_id"]): row for row in selected_spans}
    components = source.get("components")
    rows = source.get("obligations")
    if not isinstance(components, list) or not isinstance(rows, list):
        raise ComponentValidationError("component_obligations_shape_invalid")
    by_component: dict[str, list[Mapping[str, Any]]] = {}
    obligations_by_id: dict[str, Mapping[str, Any]] = {}
    for index, raw in enumerate(rows):
        row = _mapping(raw, f"component_obligation_invalid:{index}")
        _self_hash(
            row,
            "obligation_hash",
            f"component_obligation_hash_mismatch:{index}",
        )
        obligation_id = _text(
            row.get("obligation_id"), f"component_obligation_id_invalid:{index}"
        )
        if obligation_id in obligations_by_id:
            raise ComponentValidationError("component_obligation_id_duplicate")
        obligations_by_id[obligation_id] = row
        by_component.setdefault(str(row.get("component_id")), []).append(row)
    bindings_by_obligation: dict[str, dict[str, Any]] = {}
    binding_keys = {
        "binding_id",
        "obligation_id",
        "component_id",
        "asset_role",
        "artifact_id",
        "sha256",
        "size_bytes",
        "media_type",
        "producer",
        "source_lineage_hash",
        "rights_state",
        "fixture_only",
        "binding_hash",
    }
    for index, raw in enumerate(asset_bindings):
        binding = _mapping(raw, f"component_asset_binding_invalid:{index}")
        if set(binding) != binding_keys:
            raise ComponentValidationError(f"component_asset_binding_shape_invalid:{index}")
        binding_hash = _self_hash(
            binding,
            "binding_hash",
            f"component_asset_binding_hash_mismatch:{index}",
        )
        obligation_id = _text(
            binding.get("obligation_id"),
            f"component_asset_obligation_id_invalid:{index}",
        )
        obligation = obligations_by_id.get(obligation_id)
        if obligation is None:
            raise ComponentValidationError(f"component_asset_obligation_unknown:{index}")
        component_id = _text(
            binding.get("component_id"), f"component_asset_component_id_invalid:{index}"
        )
        asset_role = _text(
            binding.get("asset_role"), f"component_asset_role_invalid:{index}"
        )
        if (
            component_id != obligation.get("component_id")
            or asset_role != obligation.get("asset_role")
        ):
            raise ComponentValidationError(f"component_asset_binding_scope_mismatch:{index}")
        artifact_id = _text(
            binding.get("artifact_id"), f"component_asset_artifact_id_invalid:{index}"
        )
        sha256 = _hex64(
            binding.get("sha256"), f"component_asset_sha256_invalid:{index}"
        )
        size_bytes = binding.get("size_bytes")
        if (
            isinstance(size_bytes, bool)
            or not isinstance(size_bytes, int)
            or not 0 < size_bytes <= 25 * 1024 * 1024
        ):
            raise ComponentValidationError(f"component_asset_size_invalid:{index}")
        media_type = _text(
            binding.get("media_type"), f"component_asset_media_type_invalid:{index}"
        )
        if not _asset_media_type_allowed(
            asset_role, media_type, fixture_only=fixture_only
        ):
            raise ComponentValidationError(f"component_asset_media_type_mismatch:{index}")
        producer = _text(
            binding.get("producer"), f"component_asset_producer_invalid:{index}"
        )
        source_lineage_hash = _hex64(
            binding.get("source_lineage_hash"),
            f"component_asset_lineage_invalid:{index}",
        )
        if (
            binding.get("fixture_only") is not fixture_only
            or binding.get("rights_state") not in (
                {"fixture_only"} if fixture_only else {"verified", "owner_evidence_required", "blocked"}
            )
        ):
            raise ComponentValidationError(f"component_asset_rights_invalid:{index}")
        expected_id = "component_asset_binding." + canonical_hash(
            {
                "obligation_id": obligation_id,
                "component_id": component_id,
                "asset_role": asset_role,
                "artifact_id": artifact_id,
                "sha256": sha256,
                "size_bytes": size_bytes,
                "media_type": media_type,
            }
        )
        if binding.get("binding_id") != expected_id:
            raise ComponentValidationError(f"component_asset_binding_id_invalid:{index}")
        if obligation_id in bindings_by_obligation:
            raise ComponentValidationError("component_asset_primary_duplicate")
        bindings_by_obligation[obligation_id] = {
            **copy.deepcopy(dict(binding)),
            "binding_hash": binding_hash,
            "producer": producer,
            "source_lineage_hash": source_lineage_hash,
        }
    compiled: list[dict[str, Any]] = []
    for index, raw in enumerate(components):
        component = _mapping(raw, f"component_manifest_input_invalid:{index}")
        _self_hash(
            component,
            "component_brief_hash",
            f"component_brief_hash_mismatch:{index}",
        )
        component_id = str(component["component_id"])
        pending_assets = by_component.get(component_id, [])
        resolved_assets = [
            bindings_by_obligation[row["obligation_id"]]
            for row in pending_assets
            if row["obligation_id"] in bindings_by_obligation
        ]
        fallback_ids = component.get("ordinary_fallback_span_ids")
        if (
            not isinstance(fallback_ids, list)
            or not fallback_ids
            or any(not isinstance(item, str) or item not in spans_by_id for item in fallback_ids)
        ):
            raise ComponentValidationError(f"component_fallback_spans_invalid:{index}")
        fallback_spans = [spans_by_id[item] for item in fallback_ids]
        start = int(component["start_frame"])
        end = int(component["end_frame_exclusive"])
        exact_full_screen_interval = (
            fallback_spans[0]["start_frame"] == start
            and fallback_spans[-1]["end_frame_exclusive"] == end
            and all(
                left["end_frame_exclusive"] == right["start_frame"]
                for left, right in zip(fallback_spans, fallback_spans[1:])
            )
        )
        overlay_interval = (
            len(fallback_spans) == 1
            and fallback_spans[0]["start_frame"] <= start
            and fallback_spans[0]["end_frame_exclusive"] >= end
        )
        renderer_supported = component.get("component_type") in {
            "P01",
            "P02",
            "P03",
            "P14",
            "WC01",
            "WC02",
            "WC04",
            "WC06",
            "WC07",
            "WC08",
            "WC09",
            "WC10",
            "WC11",
            "WC12",
            "WC13",
            "WC14",
            "WC15",
        }
        decision = component.get("decision")
        fallback_reason = component.get("fallback_reason")
        chess_plan: dict[str, Any] | None = None
        if component.get("component_type") == "WC06" and decision == "use_component":
            candidate_plan = (wc06_plans or {}).get(component_id)
            if isinstance(candidate_plan, Mapping):
                try:
                    chess_plan = validate_wc06_engine_receipt(
                        candidate_plan,
                        frozen_brief_hash=source["frozen_brief_hash"],
                        component_brief_hash=component["component_brief_hash"],
                    )
                except (TypeError, ValueError):
                    fallback_reason = "stockfish_plan_invalid"
                else:
                    if chess_plan.get("status") != "verified":
                        fallback_reason = str(
                            chess_plan.get("failure_code")
                            or "stockfish_plan_unavailable"
                        )
            else:
                fallback_reason = "stockfish_plan_unavailable"
        if decision == "use_component":
            if fallback_reason is not None and component.get("component_type") != "WC06":
                raise ComponentValidationError(
                    f"component_selected_fallback_reason_invalid:{index}"
                )
            if fallback_reason is None:
                if len(resolved_assets) != len(pending_assets):
                    fallback_reason = "fixture_asset_adapter_unavailable"
                elif not renderer_supported:
                    fallback_reason = "fixture_renderer_payload_unavailable"
                elif component.get("layer") == "full_screen" and not exact_full_screen_interval:
                    fallback_reason = "full_screen_base_interval_not_exact"
                elif component.get("layer") == "overlay" and not overlay_interval:
                    fallback_reason = "overlay_base_scene_not_singular"
        elif decision == "use_ordinary_fallback":
            if not isinstance(fallback_reason, str) or not fallback_reason:
                raise ComponentValidationError(
                    f"component_fallback_reason_missing:{index}"
                )
        else:
            raise ComponentValidationError(f"component_decision_invalid:{index}")
        status = "fallback" if fallback_reason else "accepted"
        row = {
            **copy.deepcopy(dict(component)),
            "status": status,
            "fallback_reason": fallback_reason,
            "base_scene_ids": copy.deepcopy(fallback_ids),
            "asset_bindings": copy.deepcopy(resolved_assets),
            "rights_state": (
                "fixture_only" if fixture_only else
                "blocked" if any(asset["rights_state"] == "blocked" for asset in resolved_assets) else
                "owner_evidence_required" if any(asset["rights_state"] == "owner_evidence_required" for asset in resolved_assets) else
                "verified"
            ),
            "component_qc_state": "passed" if status == "accepted" else "not_applicable",
            "network_calls": 0,
            "provider_calls": 0,
            "provider_cost_micro_usd": 0,
        }
        if component.get("component_type") == "WC06":
            row["chess_plan"] = copy.deepcopy(chess_plan)
        row["component_manifest_row_hash"] = canonical_hash(row)
        compiled.append(row)
    for index, row in enumerate(compiled):
        if row.get("component_type") != "P01" or row.get("status") != "accepted":
            continue
        evidence = _mapping(
            row.get("evidence"), f"p01_coordination_evidence_invalid:{index}"
        )
        pair_index = _p01_pair_index(index, evidence, len(compiled))
        if pair_index is None:
            continue
        paired = compiled[pair_index]
        if (
            paired.get("component_type") not in P01_SPECIALIST_COMPONENT_IDS
            or paired.get("status") != "accepted"
        ):
            row["status"] = "fallback"
            row["fallback_reason"] = "p01_paired_specialist_unavailable"
            row["component_qc_state"] = "not_applicable"
            row["component_manifest_row_hash"] = canonical_hash(
                {
                    key: value
                    for key, value in row.items()
                    if key != "component_manifest_row_hash"
                }
            )
    accepted_coordination_rows = [
        row
        for row in compiled
        if row.get("status") == "accepted"
        and row.get("component_type") in {"P14", "WC12"}
    ]

    def rendered_interval(row: Mapping[str, Any]) -> tuple[int, int]:
        start = int(row["start_frame"])
        end = int(row["end_frame_exclusive"])
        if row.get("component_type") == "WC12":
            return _overlay_range(row)
        return start, end

    p14_rows = [
        row for row in accepted_coordination_rows if row.get("component_type") == "P14"
    ]
    wc12_rows = [
        row for row in accepted_coordination_rows if row.get("component_type") == "WC12"
    ]
    if any(
        p14_start < wc12_end and wc12_start < p14_end
        for p14_start, p14_end in (rendered_interval(row) for row in p14_rows)
        for wc12_start, wc12_end in (rendered_interval(row) for row in wc12_rows)
    ):
        raise ComponentValidationError("p14_wc12_render_overlap")
    manifest: dict[str, Any] = {
        "schema_version": COMPONENT_MANIFEST_SCHEMA,
        "obligations_hash": obligations_hash,
        "selected_set_hash": source["selected_set_hash"],
        "fixture_only": fixture_only,
        "components": compiled,
        "summary": {
            "opportunity_count": len(compiled),
            "accepted_count": sum(row["status"] == "accepted" for row in compiled),
            "fallback_count": sum(row["status"] == "fallback" for row in compiled),
            "network_calls": 0,
            "provider_calls": 0,
            "provider_cost_micro_usd": 0,
        },
    }
    manifest["component_manifest_hash"] = canonical_hash(manifest)
    qc: dict[str, Any] = {
        "schema_version": COMPONENT_QC_SCHEMA,
        "component_manifest_hash": manifest["component_manifest_hash"],
        "fixture_only": fixture_only,
        "checks": {
            "ordinary_fallback_retained": True,
            "frame_ranges_positive": all(
                row["end_frame_exclusive"] > row["start_frame"]
                for row in compiled
            ),
            "accepted_components_have_no_unresolved_assets": all(
                row["status"] != "accepted"
                or len(row["asset_bindings"])
                == len(by_component.get(row["component_id"], []))
                for row in compiled
            ),
            "accepted_wc06_have_engine_plans": all(
                row.get("status") != "accepted"
                or row.get("component_type") != "WC06"
                or isinstance(row.get("chess_plan"), Mapping)
                and row["chess_plan"].get("status") == "verified"
                for row in compiled
            ),
            "network_calls_zero": True,
            "paid_cost_zero": True,
        },
        "passed": True,
    }
    qc["component_qc_hash"] = canonical_hash(qc)
    return manifest, qc


def compile_fixture_component_manifest(
    obligations: Mapping[str, Any],
    selected_set: Mapping[str, Any],
    *,
    asset_bindings: Sequence[Mapping[str, Any]] = (),
    wc06_plans: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Compatibility wrapper retaining the strict fixture-only contract."""

    if _mapping(obligations, "component_obligations_required").get("fixture_only") is not True:
        raise ComponentValidationError("fixture_component_manifest_requires_fixture")
    return compile_component_manifest(
        obligations,
        selected_set,
        asset_bindings=asset_bindings,
        wc06_plans=wc06_plans,
    )


def build_component_qc_review_packet(
    manifest: Mapping[str, Any], qc: Mapping[str, Any]
) -> dict[str, Any]:
    """Build a fact-closed review packet from mechanically compiled evidence."""

    source = _mapping(manifest, "component_manifest_required")
    manifest_hash = _self_hash(
        source, "component_manifest_hash", "component_manifest_hash_mismatch"
    )
    mechanical_qc = _mapping(qc, "component_qc_required")
    qc_hash = _self_hash(
        mechanical_qc, "component_qc_hash", "component_qc_hash_mismatch"
    )
    if (
        mechanical_qc.get("component_manifest_hash") != manifest_hash
        or mechanical_qc.get("passed") is not True
    ):
        raise ComponentValidationError("component_mechanical_qc_not_passed")
    rows = source.get("components")
    if not isinstance(rows, list):
        raise ComponentValidationError("component_manifest_rows_invalid")
    items: list[dict[str, Any]] = []
    for index, raw in enumerate(rows):
        row = _mapping(raw, f"component_manifest_row_invalid:{index}")
        row_hash = _self_hash(
            row,
            "component_manifest_row_hash",
            f"component_manifest_row_hash_mismatch:{index}",
        )
        if row.get("status") != "accepted":
            continue
        bindings = row.get("asset_bindings")
        if not isinstance(bindings, list):
            raise ComponentValidationError(f"component_asset_bindings_invalid:{index}")
        item = {
            "component_id": row.get("component_id"),
            "component_type": row.get("component_type"),
            "component_manifest_row_hash": row_hash,
            "start_frame": row.get("start_frame"),
            "end_frame_exclusive": row.get("end_frame_exclusive"),
            "viewer_title": row.get("viewer_title"),
            "viewer_takeaway": row.get("viewer_takeaway"),
            "evidence_hash": row.get("evidence_hash"),
            "asset_binding_hashes": [binding.get("binding_hash") for binding in bindings],
            "ordinary_fallback_span_ids": copy.deepcopy(
                row.get("ordinary_fallback_span_ids")
            ),
        }
        item["item_hash"] = canonical_hash(item)
        items.append(item)
    packet: dict[str, Any] = {
        "schema_version": COMPONENT_QC_REVIEW_PACKET_SCHEMA,
        "component_manifest_hash": manifest_hash,
        "mechanical_qc_hash": qc_hash,
        "fixture_only": source.get("fixture_only") is True,
        "items": items,
        "review_policy": {
            "complete_atomic_response": True,
            "facts_immutable": True,
            "renderer_mechanics_immutable": True,
            "rejection_restores_exact_ordinary_fallback": True,
        },
    }
    packet["packet_hash"] = canonical_hash(packet)
    return packet


def build_fixture_component_qc_review_response(
    packet: Mapping[str, Any], *, reject_component_ids: Sequence[str] = ()
) -> dict[str, Any]:
    """Pass controlled fixture evidence unless an exact component is rejected."""

    source = _mapping(packet, "component_qc_review_packet_required")
    packet_hash = _self_hash(
        source, "packet_hash", "component_qc_review_packet_hash_mismatch"
    )
    items = source.get("items")
    if not isinstance(items, list):
        raise ComponentValidationError("component_qc_review_items_invalid")
    rejected = set(reject_component_ids)
    if len(rejected) != len(reject_component_ids) or any(
        not isinstance(value, str) or not value for value in rejected
    ):
        raise ComponentValidationError("component_qc_review_rejections_invalid")
    served: set[str] = set()
    decisions: list[dict[str, Any]] = []
    for index, raw in enumerate(items):
        item = _mapping(raw, f"component_qc_review_item_invalid:{index}")
        component_id = _text(
            item.get("component_id"), f"component_qc_review_component_id_invalid:{index}"
        )
        served.add(component_id)
        reject = component_id in rejected
        decisions.append(
            {
                "component_id": component_id,
                "item_hash": item["item_hash"],
                "decision": "reject_to_ordinary_fallback" if reject else "pass",
                "evidence_reason": (
                    "Controlled component evidence was rejected; preserve ordinary media."
                    if reject
                    else "Controlled component evidence and visible meaning passed review."
                ),
            }
        )
    if rejected - served:
        raise ComponentValidationError("component_qc_review_rejection_unknown")
    return {
        "schema_version": COMPONENT_QC_REVIEW_RESPONSE_SCHEMA,
        "packet_hash": packet_hash,
        "decisions": decisions,
    }


def build_original_graphics_component_qc_review_response(
    packet: Mapping[str, Any],
) -> dict[str, Any]:
    """Affirm the closed code-authored component scope before rendered owner review."""

    source = _mapping(packet, "component_qc_review_packet_required")
    if source.get("fixture_only") is True:
        raise ComponentValidationError("original_component_qc_fixture_conflict")
    response = build_fixture_component_qc_review_response(source)
    for decision in response["decisions"]:
        decision["evidence_reason"] = (
            "The first-party graphic is derived only from the frozen evidence packet; "
            "the rendered pixels still require final owner review."
        )
    return response


def freeze_component_qc_review_response(
    packet: Mapping[str, Any], response: Mapping[str, Any]
) -> dict[str, Any]:
    """Freeze only pass/fallback decisions over exact compiled component rows."""

    packet_value = _mapping(packet, "component_qc_review_packet_required")
    response_value = _mapping(response, "component_qc_review_response_required")
    packet_hash = _self_hash(
        packet_value, "packet_hash", "component_qc_review_packet_hash_mismatch"
    )
    if set(response_value) != {"schema_version", "packet_hash", "decisions"}:
        raise ComponentValidationError("component_qc_review_response_fields_invalid")
    if (
        response_value.get("schema_version") != COMPONENT_QC_REVIEW_RESPONSE_SCHEMA
        or response_value.get("packet_hash") != packet_hash
    ):
        raise ComponentValidationError("component_qc_review_response_binding_mismatch")
    items = packet_value.get("items")
    decisions = response_value.get("decisions")
    if not isinstance(items, list) or not isinstance(decisions, list):
        raise ComponentValidationError("component_qc_review_response_invalid")
    if len(items) != len(decisions):
        raise ComponentValidationError("component_qc_review_response_incomplete")
    frozen_decisions: list[dict[str, Any]] = []
    for index, (raw_item, raw_decision) in enumerate(zip(items, decisions, strict=True)):
        item = _mapping(raw_item, f"component_qc_review_item_invalid:{index}")
        decision = _mapping(raw_decision, f"component_qc_review_decision_invalid:{index}")
        if set(decision) != {"component_id", "item_hash", "decision", "evidence_reason"}:
            raise ComponentValidationError(
                f"component_qc_review_decision_fields_invalid:{index}"
            )
        if (
            decision.get("component_id") != item.get("component_id")
            or decision.get("item_hash") != item.get("item_hash")
        ):
            raise ComponentValidationError(
                f"component_qc_review_decision_binding_mismatch:{index}"
            )
        choice = decision.get("decision")
        if choice not in {"pass", "reject_to_ordinary_fallback"}:
            raise ComponentValidationError(
                f"component_qc_review_decision_choice_invalid:{index}"
            )
        reason = _text(
            decision.get("evidence_reason"),
            f"component_qc_review_reason_invalid:{index}",
            maximum=240,
        )
        frozen_decisions.append(
            {
                "item": copy.deepcopy(dict(item)),
                "decision": choice,
                "evidence_reason": reason,
                "decision_hash": canonical_hash(copy.deepcopy(dict(decision))),
            }
        )
    frozen: dict[str, Any] = {
        "schema_version": FROZEN_COMPONENT_QC_REVIEW_SCHEMA,
        "packet_hash": packet_hash,
        "component_manifest_hash": packet_value["component_manifest_hash"],
        "mechanical_qc_hash": packet_value["mechanical_qc_hash"],
        "fixture_only": packet_value.get("fixture_only") is True,
        "decisions": frozen_decisions,
    }
    frozen["frozen_component_qc_review_hash"] = canonical_hash(frozen)
    return frozen


def apply_component_qc_review(
    manifest: Mapping[str, Any],
    mechanical_qc: Mapping[str, Any],
    frozen_review: Mapping[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply review decisions without permitting any mutation of component facts."""

    source = _mapping(manifest, "component_manifest_required")
    source_hash = _self_hash(
        source, "component_manifest_hash", "component_manifest_hash_mismatch"
    )
    qc_source = _mapping(mechanical_qc, "component_qc_required")
    mechanical_qc_hash = _self_hash(
        qc_source, "component_qc_hash", "component_qc_hash_mismatch"
    )
    if qc_source.get("component_manifest_hash") != source_hash:
        raise ComponentValidationError("component_mechanical_qc_manifest_mismatch")
    review = _mapping(frozen_review, "frozen_component_qc_review_required")
    review_hash = _self_hash(
        review,
        "frozen_component_qc_review_hash",
        "frozen_component_qc_review_hash_mismatch",
    )
    if (
        review.get("component_manifest_hash") != source_hash
        or review.get("mechanical_qc_hash") != mechanical_qc_hash
    ):
        raise ComponentValidationError("component_qc_review_authority_mismatch")
    rows = source.get("components")
    decisions = review.get("decisions")
    if not isinstance(rows, list) or not isinstance(decisions, list):
        raise ComponentValidationError("component_qc_review_shape_invalid")
    accepted = {
        str(row["component_id"]): row
        for row in rows
        if isinstance(row, Mapping) and row.get("status") == "accepted"
    }
    by_component: dict[str, Mapping[str, Any]] = {}
    for index, raw in enumerate(decisions):
        decision = _mapping(raw, f"frozen_component_qc_review_decision_invalid:{index}")
        item = _mapping(decision.get("item"), f"component_qc_review_item_invalid:{index}")
        component_id = str(item.get("component_id"))
        authoritative = accepted.get(component_id)
        if component_id in by_component or authoritative is None:
            raise ComponentValidationError("component_qc_review_scope_invalid")
        expected_item = {
            "component_id": authoritative.get("component_id"),
            "component_type": authoritative.get("component_type"),
            "component_manifest_row_hash": authoritative.get("component_manifest_row_hash"),
            "start_frame": authoritative.get("start_frame"),
            "end_frame_exclusive": authoritative.get("end_frame_exclusive"),
            "viewer_title": authoritative.get("viewer_title"),
            "viewer_takeaway": authoritative.get("viewer_takeaway"),
            "evidence_hash": authoritative.get("evidence_hash"),
            "asset_binding_hashes": [
                binding.get("binding_hash")
                for binding in authoritative.get("asset_bindings", [])
            ],
            "ordinary_fallback_span_ids": copy.deepcopy(
                authoritative.get("ordinary_fallback_span_ids")
            ),
        }
        expected_item["item_hash"] = canonical_hash(expected_item)
        if dict(item) != expected_item:
            raise ComponentValidationError("component_qc_review_component_changed")
        by_component[component_id] = decision
    if set(by_component) != set(accepted):
        raise ComponentValidationError("component_qc_review_incomplete")
    final = copy.deepcopy(dict(source))
    final_rows: list[dict[str, Any]] = []
    for raw in final["components"]:
        row = copy.deepcopy(dict(raw))
        component_id = str(row["component_id"])
        decision = by_component.get(component_id)
        if decision is not None:
            if decision.get("decision") == "reject_to_ordinary_fallback":
                row["status"] = "fallback"
                row["fallback_reason"] = "component_qc_rejected"
                row["component_qc_state"] = "rejected_to_ordinary_fallback"
            elif decision.get("decision") == "pass":
                row["component_qc_state"] = "passed"
            else:
                raise ComponentValidationError("component_qc_review_decision_invalid")
            row["component_qc_review_decision_hash"] = decision["decision_hash"]
            row.pop("component_manifest_row_hash", None)
            row["component_manifest_row_hash"] = canonical_hash(row)
        final_rows.append(row)
    final["components"] = final_rows
    final["summary"] = {
        **copy.deepcopy(dict(final["summary"])),
        "accepted_count": sum(row["status"] == "accepted" for row in final_rows),
        "fallback_count": sum(row["status"] == "fallback" for row in final_rows),
        "qc_rejected_count": sum(
            row.get("component_qc_state") == "rejected_to_ordinary_fallback"
            for row in final_rows
        ),
    }
    del final["component_manifest_hash"]
    final["component_qc_review_hash"] = review_hash
    final["mechanical_component_manifest_hash"] = source_hash
    final["component_manifest_hash"] = canonical_hash(final)
    checks = copy.deepcopy(dict(qc_source.get("checks") or {}))
    checks["editorial_review_complete"] = True
    checks["accepted_components_review_passed"] = all(
        row.get("status") != "accepted" or row.get("component_qc_state") == "passed"
        for row in final_rows
    )
    qc: dict[str, Any] = {
        "schema_version": COMPONENT_QC_SCHEMA,
        "component_manifest_hash": final["component_manifest_hash"],
        "mechanical_component_manifest_hash": source_hash,
        "mechanical_qc_hash": mechanical_qc_hash,
        "component_qc_review_hash": review_hash,
        "fixture_only": source.get("fixture_only") is True,
        "checks": checks,
        "passed": all(checks.values()),
    }
    qc["component_qc_hash"] = canonical_hash(qc)
    return final, qc


def _renderer_evidence_ids(component: Mapping[str, Any], row: Mapping[str, Any]) -> list[str]:
    claim_ids = row.get("claim_ids")
    if isinstance(claim_ids, list) and claim_ids and all(isinstance(item, str) for item in claim_ids):
        return copy.deepcopy(claim_ids)
    evidence_ids = component.get("evidence_ids")
    if not isinstance(evidence_ids, list) or not evidence_ids or any(
        not isinstance(item, str) or not item for item in evidence_ids
    ):
        raise ComponentValidationError("render_component_evidence_ids_invalid")
    return copy.deepcopy(evidence_ids)


def _overlay_range(component: Mapping[str, Any]) -> tuple[int, int]:
    timing = component.get("narration_timing") or {}
    measured = timing.get("status") == "measured"
    start = int(timing["cues"][0]["start_frame"]) if measured else int(component["start_frame"]) + 15
    end = min(int(component["end_frame_exclusive"]) - (1 if measured else 15), start + 120)
    if not 90 <= end - start <= 120:
        raise ComponentValidationError("render_wc12_overlay_range_invalid")
    return start, end


def _render_component_payload(component: Mapping[str, Any], parent_unit_ids: list[str]) -> dict[str, Any]:
    component_type = str(component.get("component_type"))
    evidence = _mapping(component.get("evidence"), "render_component_evidence_invalid")
    base: dict[str, Any] = {
        "componentId": component["component_id"],
        "parentUnitIds": copy.deepcopy(parent_unit_ids),
        "componentType": component_type,
        "layer": component["layer"],
        "baseSceneIds": copy.deepcopy(component["base_scene_ids"]),
        "startFrame": component["start_frame"],
        "endFrameExclusive": component["end_frame_exclusive"],
        "evidenceIds": copy.deepcopy(component["evidence_ids"]),
        "acceptedScopeHash": component["component_manifest_row_hash"],
    }
    if component_type == "P01":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1:
            raise ComponentValidationError("render_p01_asset_binding_invalid")
        source = _mapping(bindings[0], "render_p01_asset_binding_invalid")
        if (
            source.get("asset_role") != "short_overlay_still"
            or source.get("media_type") not in {"image/png", "image/jpeg"}
        ):
            raise ComponentValidationError("render_p01_asset_role_invalid")
        emphasis = evidence.get("emphasis")
        if emphasis is not None:
            emphasis = _text(emphasis, "render_p01_emphasis_invalid", maximum=32)
        base.update(
            {
                "headline": _text(
                    evidence.get("headline"),
                    "render_p01_headline_invalid",
                    maximum=42,
                ),
                "emphasis": emphasis,
                "source": {
                    "artifactId": _text(
                        source.get("artifact_id"),
                        "render_p01_asset_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        source.get("sha256"),
                        "render_p01_asset_hash_invalid",
                    ),
                    "mediaType": _text(
                        source.get("media_type"),
                        "render_p01_asset_media_invalid",
                    ),
                },
            }
        )
    elif component_type == "P02":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1:
            raise ComponentValidationError("render_p02_asset_binding_invalid")
        source = _mapping(bindings[0], "render_p02_asset_binding_invalid")
        if (
            source.get("asset_role") != "editorial_card_still"
            or source.get("media_type") not in {"image/png", "image/jpeg"}
        ):
            raise ComponentValidationError("render_p02_asset_role_invalid")
        base.update(
            {
                "headline": _text(
                    evidence.get("headline"),
                    "render_p02_headline_invalid",
                    maximum=66,
                ),
                "source": {
                    "artifactId": _text(
                        source.get("artifact_id"),
                        "render_p02_asset_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        source.get("sha256"),
                        "render_p02_asset_hash_invalid",
                    ),
                    "mediaType": _text(
                        source.get("media_type"),
                        "render_p02_asset_media_invalid",
                    ),
                },
            }
        )
    elif component_type == "P03":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1:
            raise ComponentValidationError("render_p03_asset_binding_invalid")
        source = _mapping(bindings[0], "render_p03_asset_binding_invalid")
        if (
            source.get("asset_role") != "whole_word_highlight_still"
            or source.get("media_type") not in {"image/png", "image/jpeg"}
        ):
            raise ComponentValidationError("render_p03_asset_role_invalid")
        highlight_words = evidence.get("highlight_words")
        if (
            not isinstance(highlight_words, list)
            or not 1 <= len(highlight_words) <= 2
            or any(not isinstance(word, str) or not word.strip() for word in highlight_words)
        ):
            raise ComponentValidationError("render_p03_highlight_words_invalid")
        placement = evidence.get("placement")
        if placement not in {"bottom-left", "bottom-right", "top-left", "center-left"}:
            raise ComponentValidationError("render_p03_placement_invalid")
        base.update(
            {
                "headline": _text(
                    evidence.get("headline"),
                    "render_p03_headline_invalid",
                    maximum=42,
                ),
                "highlightWords": copy.deepcopy(highlight_words),
                "placement": placement,
                "source": {
                    "artifactId": _text(
                        source.get("artifact_id"),
                        "render_p03_asset_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        source.get("sha256"),
                        "render_p03_asset_hash_invalid",
                    ),
                    "mediaType": _text(
                        source.get("media_type"),
                        "render_p03_asset_media_invalid",
                    ),
                },
            }
        )
    elif component_type == "P14":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1:
            raise ComponentValidationError("render_p14_asset_binding_invalid")
        source = _mapping(bindings[0], "render_p14_asset_binding_invalid")
        if (
            source.get("asset_role") != "number_only_year_still"
            or source.get("media_type") not in {"image/png", "image/jpeg"}
        ):
            raise ComponentValidationError("render_p14_asset_role_invalid")
        year = evidence.get("year")
        if (
            not isinstance(year, str)
            or len(year) != 4
            or not year.isascii()
            or not year.isdigit()
        ):
            raise ComponentValidationError("render_p14_year_invalid")
        base.update(
            {
                "year": _text(year, "render_p14_year_invalid", maximum=4),
                "source": {
                    "artifactId": _text(
                        source.get("artifact_id"),
                        "render_p14_asset_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        source.get("sha256"),
                        "render_p14_asset_hash_invalid",
                    ),
                    "mediaType": _text(
                        source.get("media_type"),
                        "render_p14_asset_media_invalid",
                    ),
                },
            }
        )
    elif component_type == "WC01":
        rows = evidence.get("forces")
        if not isinstance(rows, list) or len(rows) != 2:
            raise ComponentValidationError("render_wc01_forces_invalid")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 2:
            raise ComponentValidationError("render_wc01_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc01_asset_binding_invalid"
            )
            for binding in bindings
        }
        expected_roles = {"force_identity_left", "force_identity_right"}
        if set(by_role) != expected_roles:
            raise ComponentValidationError("render_wc01_asset_roles_invalid")
        for role in expected_roles:
            if by_role[role].get("media_type") not in {"image/png", "image/jpeg"}:
                raise ComponentValidationError("render_wc01_asset_media_invalid")
        force_roles = (
            ("red", "force_identity_left"),
            ("blue", "force_identity_right"),
        )
        base.update(
            {
                "title": _text(
                    component.get("viewer_title"),
                    "render_wc01_title_invalid",
                    maximum=100,
                ),
                "forces": [
                    {
                        "forceId": _text(
                            row.get("force_id"),
                            "render_wc01_force_id_invalid",
                            maximum=200,
                        ),
                        "label": _text(
                            row.get("label"),
                            "render_wc01_force_label_invalid",
                            maximum=80,
                        ),
                        "side": side,
                        "evidenceIds": _renderer_evidence_ids(
                            component,
                            _mapping(row, "render_wc01_force_invalid"),
                        ),
                        "identityAsset": {
                            "artifactId": _text(
                                by_role[role].get("artifact_id"),
                                "render_wc01_asset_artifact_invalid",
                            ),
                            "sha256": _hex64(
                                by_role[role].get("sha256"),
                                "render_wc01_asset_hash_invalid",
                            ),
                                "mediaType": "image/png",
                        },
                    }
                    for row, (side, role) in zip(rows, force_roles, strict=True)
                ],
            }
        )
    elif component_type == "WC02":
        rows = evidence.get("progression_points")
        if not isinstance(rows, list) or not 2 <= len(rows) <= 5:
            raise ComponentValidationError("render_wc02_progression_invalid")
        marginalia = component.get("component_variant") == WC02_PERSON_MARGINALIA_VARIANT
        if marginalia and not _wc02_person_marginalia(evidence):
            raise ComponentValidationError("render_wc02_marginalia_evidence_invalid")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 2 + (0 if marginalia else len(rows)):
            raise ComponentValidationError("render_wc02_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc02_asset_binding_invalid"
            )
            for binding in bindings
        }
        expected_roles = {"subject_image", "subject_cutout"} | {
            f"progression_item_{index}" for index in range(1, 0 if marginalia else len(rows) + 1)
        }
        if set(by_role) != expected_roles:
            raise ComponentValidationError("render_wc02_asset_roles_invalid")
        if any(by_role[role].get("media_type") != "image/png" for role in by_role):
            raise ComponentValidationError("render_wc02_asset_media_invalid")
        anchor_kind = evidence.get("anchor_kind")
        relationship = evidence.get("relationship")
        if anchor_kind not in {"person", "place", "object", "document", "group", "symbol"}:
            raise ComponentValidationError("render_wc02_anchor_kind_invalid")
        if relationship not in {"progression", "contrast", "cause_effect", "facets", "repeated_context"}:
            raise ComponentValidationError("render_wc02_relationship_invalid")
        base.update(
            {
                "presentationVariant": WC02_PERSON_MARGINALIA_VARIANT if marginalia else "anchored_progression_v2",
                "subject": _text(evidence.get("central_subject"), "render_wc02_subject_invalid", maximum=42),
                "subjectRole": str(anchor_kind).replace("_", " ").title(),
                "anchorKind": anchor_kind,
                "relationship": relationship,
                "relationshipLabel": _text(
                    evidence.get("relationship_label"),
                    "render_wc02_relationship_label_invalid",
                    maximum=40,
                ),
                "subjectImage": {
                    "artifactId": _text(
                        by_role["subject_image"].get("artifact_id"),
                        "render_wc02_image_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        by_role["subject_image"].get("sha256"),
                        "render_wc02_image_hash_invalid",
                    ),
                    "mediaType": "image/png",
                },
                "subjectCutout": {
                    "artifactId": _text(
                        by_role["subject_cutout"].get("artifact_id"),
                        "render_wc02_cutout_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        by_role["subject_cutout"].get("sha256"),
                        "render_wc02_cutout_hash_invalid",
                    ),
                    "mediaType": "image/png",
                },
                "steps": [
                    {
                        "stepId": _text(row.get("step_id"), "render_wc02_step_id_invalid", maximum=200),
                        "label": _text(row.get("label"), "render_wc02_step_label_invalid", maximum=24),
                        "title": _text(row.get("label"), "render_wc02_step_title_invalid", maximum=42),
                        "detail": _text(row.get("detail"), "render_wc02_step_detail_invalid", maximum=90),
                        "evidenceIds": _renderer_evidence_ids(component, _mapping(row, "render_wc02_step_invalid")),
                    }
                    | ({} if marginalia else {"media": {
                            "artifactId": _text(
                                by_role[f"progression_item_{index}"].get("artifact_id"),
                                "render_wc02_step_asset_invalid",
                            ),
                            "sha256": _hex64(
                                by_role[f"progression_item_{index}"].get("sha256"),
                                "render_wc02_step_asset_hash_invalid",
                            ),
                            "mediaType": "image/png",
                        }})
                    for index, row in enumerate(rows, start=1)
                ],
            }
        )
        if marginalia:
            base["title"] = base["subject"]
    elif component_type == "WC04":
        if evidence.get("map_story_mode") != "orientation":
            raise ComponentValidationError("render_wc04_fixture_mode_unavailable")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1:
            raise ComponentValidationError("render_wc04_plate_binding_invalid")
        binding = _mapping(bindings[0], "render_wc04_plate_binding_invalid")
        if binding.get("asset_role") != "map_plate" or binding.get("media_type") != "image/png":
            raise ComponentValidationError("render_wc04_plate_binding_invalid")
        base.update(
            {
                "mode": "orientation",
                "title": _text(
                    component.get("viewer_title"),
                    "render_wc04_title_invalid",
                    maximum=100,
                ),
                "plate": {
                    "source": {
                        "artifactId": _text(
                            binding.get("artifact_id"),
                            "render_wc04_plate_artifact_invalid",
                        ),
                        "sha256": _hex64(
                            binding.get("sha256"),
                            "render_wc04_plate_hash_invalid",
                        ),
                        "mediaType": "image/png",
                    },
                    "label": _text(
                        component.get("viewer_takeaway"),
                        "render_wc04_plate_label_invalid",
                        maximum=100,
                    ),
                },
                "actors": [],
                "movementSteps": [],
                "ranks": [],
            }
        )
    elif component_type == "WC06":
        plan = component.get("chess_plan")
        if not isinstance(plan, Mapping):
            raise ComponentValidationError("render_wc06_engine_plan_missing")
        try:
            verified_plan = validate_wc06_engine_receipt(
                plan,
                component_brief_hash=component["component_brief_hash"],
            )
        except (TypeError, ValueError) as exc:
            raise ComponentValidationError("render_wc06_engine_plan_invalid") from exc
        if verified_plan.get("status") != "verified":
            raise ComponentValidationError("render_wc06_engine_plan_not_verified")
        engine = _mapping(verified_plan["engine"], "render_wc06_engine_invalid")
        settings = _mapping(
            engine["settings"], "render_wc06_engine_settings_invalid"
        )
        base.update(
            {
                "chessPlan": {
                    "schemaVersion": verified_plan["schema_version"],
                    "status": verified_plan["status"],
                    "motifId": verified_plan["motif_id"],
                    "fen": verified_plan["fen"],
                    "moves": [
                        {
                            "ply": move["ply"],
                            "uci": move["uci"],
                            "caption": move["caption"],
                        }
                        for move in verified_plan["moves"]
                    ],
                    "principalVariation": copy.deepcopy(
                        verified_plan["principal_variation"]
                    ),
                    "engine": {
                        "name": engine["name"],
                        "version": engine["version"],
                        "settings": {
                            "depth": settings["depth"],
                            "movetimeMs": settings["movetime_ms"],
                            "threads": settings["threads"],
                            "hashMb": settings["hash_mb"],
                            "multipv": settings["multipv"],
                        },
                    },
                    "score": copy.deepcopy(verified_plan["score"]),
                    "frozenBriefHash": verified_plan["frozen_brief_hash"],
                    "componentBriefHash": verified_plan["component_brief_hash"],
                    "receiptHash": verified_plan["receipt_hash"],
                },
                "title": _text(component.get("viewer_title"), "render_wc06_title_invalid", maximum=100),
            }
        )
    elif component_type == "WC07":
        rows = evidence.get("subjects")
        if not isinstance(rows, list) or len(rows) != 3:
            raise ComponentValidationError("render_wc07_subjects_invalid")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 3:
            raise ComponentValidationError("render_wc07_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc07_asset_binding_invalid"
            )
            for binding in bindings
        }
        expected_roles = {"subject_1", "subject_2", "subject_3"}
        if set(by_role) != expected_roles:
            raise ComponentValidationError("render_wc07_asset_roles_invalid")
        for role in expected_roles:
            if by_role[role].get("media_type") not in {"image/png", "image/jpeg"}:
                raise ComponentValidationError("render_wc07_asset_media_invalid")
        base.update(
            {
                "title": _text(
                    component.get("viewer_title"),
                    "render_wc07_title_invalid",
                    maximum=100,
                ),
                "subjects": [
                    {
                        "subjectId": _text(
                            row.get("subject_id"),
                            "render_wc07_subject_id_invalid",
                            maximum=200,
                        ),
                        "label": _text(
                            row.get("label"),
                            "render_wc07_subject_label_invalid",
                            maximum=100,
                        ),
                        "evidenceIds": _renderer_evidence_ids(
                            component,
                            _mapping(row, "render_wc07_subject_invalid"),
                        ),
                        "subjectAsset": {
                            "artifactId": _text(
                                by_role[f"subject_{index}"].get("artifact_id"),
                                "render_wc07_asset_artifact_invalid",
                            ),
                            "sha256": _hex64(
                                by_role[f"subject_{index}"].get("sha256"),
                                "render_wc07_asset_hash_invalid",
                            ),
                            "mediaType": _text(
                                by_role[f"subject_{index}"].get("media_type"),
                                "render_wc07_asset_media_invalid",
                            ),
                        },
                    }
                    for index, row in enumerate(rows, start=1)
                ],
            }
        )
    elif component_type == "WC08":
        base.update(
            {
                "identity": _text(evidence.get("identity"), "render_wc08_identity_invalid", maximum=100),
                "place": _text(evidence.get("place"), "render_wc08_place_invalid", maximum=100),
                "label": _text(component.get("viewer_takeaway"), "render_wc08_label_invalid", maximum=120),
            }
        )
    elif component_type == "WC09":
        base.update(
            {
                "value": _text(evidence.get("statistic"), "render_wc09_value_invalid", maximum=80),
                "unit": _text(evidence.get("unit"), "render_wc09_unit_invalid", maximum=40),
                "claimId": _text(evidence.get("claim_id"), "render_wc09_claim_invalid", maximum=200),
                "sourceClaim": _text(component.get("viewer_takeaway"), "render_wc09_source_invalid", maximum=160),
            }
        )
    elif component_type == "WC10":
        rows = evidence.get("options")
        if not isinstance(rows, list) or not 2 <= len(rows) <= 4:
            raise ComponentValidationError("render_wc10_options_invalid")
        base.update(
            {
                "options": [
                    {
                        "optionId": _text(row.get("option_id"), "render_wc10_option_id_invalid", maximum=200),
                        "label": _text(row.get("label"), "render_wc10_option_label_invalid", maximum=100),
                        "evidenceIds": _renderer_evidence_ids(component, _mapping(row, "render_wc10_option_invalid")),
                    }
                    for row in rows
                ],
                "chosenOptionId": _text(evidence.get("chosen_option_id"), "render_wc10_choice_invalid", maximum=200),
                "title": _text(component.get("viewer_title"), "render_wc10_title_invalid", maximum=100),
            }
        )
        if (component.get("narration_timing") or {}).get("status") == "measured":
            base["chosenRevealFrame"] = component["narration_timing"]["cues"][0]["start_frame"] - component["start_frame"]
    elif component_type == "WC11":
        rows = evidence.get("events")
        if not isinstance(rows, list) or not 2 <= len(rows) <= 6:
            raise ComponentValidationError("render_wc11_events_invalid")
        base.update(
            {
                "events": [
                    {
                        "eventId": _text(
                            row.get("event_id"),
                            "render_wc11_event_id_invalid",
                            maximum=200,
                        ),
                        # The editorial schema supplies ordered evidenced
                        # events, not free-form dates.  The visible ordinal is
                        # therefore code-owned and makes no extra historical
                        # claim.
                        "dateLabel": f"{row_index + 1:02d}",
                        "label": _text(
                            row.get("label"),
                            "render_wc11_event_label_invalid",
                            maximum=120,
                        ),
                        "evidenceIds": _renderer_evidence_ids(
                            component,
                            _mapping(row, "render_wc11_event_invalid"),
                        ),
                    }
                    for row_index, row in enumerate(rows)
                ],
                "title": _text(
                    component.get("viewer_title"),
                    "render_wc11_title_invalid",
                    maximum=100,
                ),
            }
        )
        if (component.get("narration_timing") or {}).get("status") == "measured":
            base["eventStartFrames"] = [cue["start_frame"] - component["start_frame"] for cue in component["narration_timing"]["cues"]]
    elif component_type == "WC12":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 2:
            raise ComponentValidationError("render_wc12_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc12_asset_binding_invalid"
            )
            for binding in bindings
        }
        if set(by_role) != {"named_person_portrait", "named_person_cutout"}:
            raise ComponentValidationError("render_wc12_asset_roles_invalid")
        cutout = by_role["named_person_cutout"]
        if cutout.get("media_type") != "image/png":
            raise ComponentValidationError("render_wc12_cutout_media_invalid")
        base_start = int(component["start_frame"])
        base_end = int(component["end_frame_exclusive"])
        overlay_start, overlay_end = _overlay_range(component)
        base.update(
            {
                "startFrame": overlay_start,
                "endFrameExclusive": overlay_end,
                "namedPerson": _text(
                    evidence.get("named_person"),
                    "render_wc12_person_invalid",
                    maximum=100,
                ),
                "role": _text(
                    evidence.get("role"),
                    "render_wc12_role_invalid",
                    maximum=100,
                ),
                "label": _text(
                    component.get("viewer_takeaway"),
                    "render_wc12_label_invalid",
                    maximum=120,
                ),
                "baseStartFrame": base_start,
                "baseEndFrameExclusive": base_end,
                "cutout": {
                    "artifactId": _text(
                        cutout.get("artifact_id"),
                        "render_wc12_cutout_artifact_invalid",
                    ),
                    "sha256": _hex64(
                        cutout.get("sha256"),
                        "render_wc12_cutout_hash_invalid",
                    ),
                    "mediaType": "image/png",
                },
            }
        )
    elif component_type == "WC13":
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 2:
            raise ComponentValidationError("render_wc13_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc13_asset_binding_invalid"
            )
            for binding in bindings
        }
        if set(by_role) != {"document_full", "document_detail"} or any(
            row.get("media_type") != "image/png" for row in by_role.values()
        ):
            raise ComponentValidationError("render_wc13_asset_roles_invalid")
        base.update(
            {
                "documentLabel": _text(
                    evidence.get("document_label"),
                    "render_wc13_document_label_invalid",
                    maximum=100,
                ),
                "dateLabel": _text(
                    evidence.get("date_label"),
                    "render_wc13_date_label_invalid",
                    maximum=80,
                ),
                "detailLabel": _text(
                    evidence.get("detail_label"),
                    "render_wc13_detail_label_invalid",
                    maximum=100,
                ),
                "title": _text(
                    component.get("viewer_title"),
                    "render_wc13_title_invalid",
                    maximum=100,
                ),
                "takeaway": _text(
                    component.get("viewer_takeaway"),
                    "render_wc13_takeaway_invalid",
                    maximum=160,
                ),
                "document": {
                    "artifactId": _text(by_role["document_full"].get("artifact_id"), "render_wc13_document_artifact_invalid"),
                    "sha256": _hex64(by_role["document_full"].get("sha256"), "render_wc13_document_hash_invalid"),
                    "mediaType": "image/png",
                },
                "detail": {
                    "artifactId": _text(by_role["document_detail"].get("artifact_id"), "render_wc13_detail_artifact_invalid"),
                    "sha256": _hex64(by_role["document_detail"].get("sha256"), "render_wc13_detail_hash_invalid"),
                    "mediaType": "image/png",
                },
            }
        )
    elif component_type == "WC14":
        rows = evidence.get("details")
        if not isinstance(rows, list) or not 2 <= len(rows) <= 4:
            raise ComponentValidationError("render_wc14_details_invalid")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 1 + len(rows):
            raise ComponentValidationError("render_wc14_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc14_asset_binding_invalid"
            )
            for binding in bindings
        }
        expected_roles = {"archival_full"} | {
            f"archival_detail_{index}" for index in range(1, len(rows) + 1)
        }
        if set(by_role) != expected_roles or any(
            row.get("media_type") != "image/png" for row in by_role.values()
        ):
            raise ComponentValidationError("render_wc14_asset_roles_invalid")
        base.update(
            {
                "sourceTitle": _text(evidence.get("source_title"), "render_wc14_title_invalid", maximum=100),
                "sourceLabel": _text(evidence.get("source_label"), "render_wc14_source_label_invalid", maximum=100),
                "source": {
                    "artifactId": _text(by_role["archival_full"].get("artifact_id"), "render_wc14_source_artifact_invalid"),
                    "sha256": _hex64(by_role["archival_full"].get("sha256"), "render_wc14_source_hash_invalid"),
                    "mediaType": "image/png",
                },
                "details": [
                    {
                        "detailId": _text(row.get("detail_id"), "render_wc14_detail_id_invalid", maximum=200),
                        "label": _text(row.get("label"), "render_wc14_detail_label_invalid", maximum=80),
                        "evidenceIds": _renderer_evidence_ids(component, _mapping(row, "render_wc14_detail_invalid")),
                        "source": {
                            "artifactId": _text(by_role[f"archival_detail_{index}"].get("artifact_id"), "render_wc14_detail_artifact_invalid"),
                            "sha256": _hex64(by_role[f"archival_detail_{index}"].get("sha256"), "render_wc14_detail_hash_invalid"),
                            "mediaType": "image/png",
                        },
                    }
                    for index, row in enumerate(rows, start=1)
                ],
            }
        )
    elif component_type == "WC15":
        rows = evidence.get("sources")
        if not isinstance(rows, list) or len(rows) != 2:
            raise ComponentValidationError("render_wc15_sources_invalid")
        bindings = component.get("asset_bindings")
        if not isinstance(bindings, list) or len(bindings) != 2:
            raise ComponentValidationError("render_wc15_asset_bindings_invalid")
        by_role = {
            str(binding.get("asset_role")): _mapping(
                binding, "render_wc15_asset_binding_invalid"
            )
            for binding in bindings
        }
        if set(by_role) != {"contrast_source_left", "contrast_source_right"} or any(
            row.get("media_type") != "image/png" for row in by_role.values()
        ):
            raise ComponentValidationError("render_wc15_asset_roles_invalid")
        source_roles = ("contrast_source_left", "contrast_source_right")
        base.update(
            {
                "relationship": evidence.get("relationship"),
                "relationshipLabel": _text(evidence.get("relationship_label"), "render_wc15_relationship_label_invalid", maximum=80),
                "sources": [
                    {
                        "sourceId": _text(row.get("source_id"), "render_wc15_source_id_invalid", maximum=200),
                        "label": _text(row.get("label"), "render_wc15_source_label_invalid", maximum=100),
                        "sourceKind": _text(row.get("source_kind"), "render_wc15_source_kind_invalid", maximum=40),
                        "dateLabel": _text(row.get("date_label"), "render_wc15_source_date_invalid", maximum=80),
                        "evidenceIds": _renderer_evidence_ids(component, _mapping(row, "render_wc15_source_invalid")),
                        "source": {
                            "artifactId": _text(by_role[role].get("artifact_id"), "render_wc15_source_artifact_invalid"),
                            "sha256": _hex64(by_role[role].get("sha256"), "render_wc15_source_hash_invalid"),
                            "mediaType": "image/png",
                        },
                    }
                    for row, role in zip(rows, source_roles, strict=True)
                ],
            }
        )
    else:
        raise ComponentValidationError(f"render_component_type_unavailable:{component_type}")
    if "narration_timing" in component:
        base["narrationTiming"] = copy.deepcopy(component["narration_timing"])
    return base


def compile_render_components(
    manifest: Mapping[str, Any],
    qc: Mapping[str, Any],
    scenes: Sequence[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], str, str]:
    """Compile only QC-passed component rows into the closed render grammar."""

    source = _mapping(manifest, "component_manifest_required")
    manifest_hash = _self_hash(
        source, "component_manifest_hash", "component_manifest_hash_mismatch"
    )
    qc_value = _mapping(qc, "component_qc_required")
    qc_hash = _self_hash(qc_value, "component_qc_hash", "component_qc_hash_mismatch")
    if qc_value.get("component_manifest_hash") != manifest_hash or qc_value.get("passed") is not True:
        raise ComponentValidationError("component_qc_not_passed")
    scene_rows = [_mapping(row, "render_base_scene_invalid") for row in scenes]
    scenes_by_id = {str(row.get("sceneId")): row for row in scene_rows}
    if len(scenes_by_id) != len(scene_rows):
        raise ComponentValidationError("render_base_scene_ids_invalid")
    rendered: list[dict[str, Any]] = []
    components = source.get("components")
    if not isinstance(components, list):
        raise ComponentValidationError("component_manifest_rows_invalid")
    for index, raw in enumerate(components):
        component = _mapping(raw, f"component_manifest_row_invalid:{index}")
        _self_hash(
            component,
            "component_manifest_row_hash",
            f"component_manifest_row_hash_mismatch:{index}",
        )
        if component.get("status") != "accepted":
            continue
        base_ids = component.get("base_scene_ids")
        if not isinstance(base_ids, list) or not base_ids or any(item not in scenes_by_id for item in base_ids):
            raise ComponentValidationError(f"render_component_base_scene_invalid:{index}")
        parent_ids: list[str] = []
        for item in base_ids:
            parent_id = str(scenes_by_id[item].get("parentUnitId"))
            if not parent_id or parent_id == "None":
                raise ComponentValidationError(f"render_component_parent_unit_invalid:{index}")
            if not parent_ids or parent_ids[-1] != parent_id:
                parent_ids.append(parent_id)
        if len(parent_ids) != len(set(parent_ids)):
            raise ComponentValidationError(f"render_component_parent_unit_order_invalid:{index}")
        rendered.append(_render_component_payload(component, parent_ids))
    return rendered, manifest_hash, qc_hash
