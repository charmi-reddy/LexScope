"""AI summaries for new documents attached to a matter."""
from __future__ import annotations

import json
import re
from typing import Any

from app.services import ai_proxy
from app.services.ai_proxy import AiUpstreamError

MODEL_CHAIN = ("google/gemini-2.5-flash", "google/gemini-3.5-flash-lite")

SYSTEM_PROMPT = """You summarize legal matter documents for ordinary people. Use only facts stated in the supplied documents and context. Never invent facts, dates, or parties. Use plain language a non-lawyer understands. Return ONLY strict JSON with exactly these string keys:
{
  "update_summary": "3-5 plain sentences about this document",
  "what_changed": "1-2 sentences on what this document changes compared to the previous state",
  "running_summary": "at most 4 plain sentences on where the whole matter stands now, replacing the old one"
}
If there is no previous running summary, what_changed must be exactly "First document in this matter." Do not use markdown or text outside the JSON object."""


def _sentence_count(value: str) -> int:
    return len(re.findall(r"[^.!?]+(?:[.!?]+|$)", value.strip())) if value.strip() else 0


def _parse_summary(raw: str, has_previous: bool) -> dict[str, str]:
    data = json.loads(raw)
    keys = {"update_summary", "what_changed", "running_summary"}
    if not isinstance(data, dict) or set(data) != keys:
        raise ValueError("JSON must contain exactly the required keys")
    if any(not isinstance(data[key], str) or not data[key].strip() for key in keys):
        raise ValueError("Summary values must be non-empty strings")
    if not 3 <= _sentence_count(data["update_summary"]) <= 5:
        raise ValueError("update_summary must contain 3 to 5 sentences")
    if not 1 <= _sentence_count(data["what_changed"]) <= 2:
        raise ValueError("what_changed must contain 1 to 2 sentences")
    if _sentence_count(data["running_summary"]) > 4:
        raise ValueError("running_summary must contain at most 4 sentences")
    if not has_previous and data["what_changed"] != "First document in this matter.":
        raise ValueError("what_changed must use the required first-document sentence")
    return data


async def summarize_matter_update(
    matter_title: str,
    previous_running_summary: str | None,
    previous_updates: list[dict[str, str]],
    document_text: str,
) -> dict[str, str]:
    """Summarize a new matter document, retrying malformed JSON once."""
    context = {
        "matter_title": matter_title,
        "previous_running_summary": previous_running_summary or "",
        "previous_updates": previous_updates[-5:],
        "document_text": document_text,
    }
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
    ]

    last_error: AiUpstreamError | None = None
    for model in MODEL_CHAIN:
        try:
            result = await ai_proxy.chat_completion(messages, model=model, temperature=0.2, max_tokens=1800)
            raw = result["text"]
            try:
                return _parse_summary(raw, bool(previous_running_summary))
            except (ValueError, TypeError, json.JSONDecodeError):
                repair_messages = [
                    *messages,
                    {"role": "assistant", "content": str(raw)[:4000]},
                    {
                        "role": "user",
                        "content": (
                            "Repair your previous response. Return the same information as one valid strict JSON object "
                            "with exactly update_summary, what_changed, and running_summary. Follow all sentence-count "
                            "rules and do not add facts. Return JSON only."
                        ),
                    },
                ]
                repaired = await ai_proxy.chat_completion(
                    repair_messages, model=model, temperature=0.2, max_tokens=1800
                )
                try:
                    return _parse_summary(repaired["text"], bool(previous_running_summary))
                except (ValueError, TypeError, json.JSONDecodeError) as exc:
                    last_error = AiUpstreamError("AI_UPSTREAM", "The AI returned an invalid matter summary.", status=502)
                    last_error.__cause__ = exc
        except AiUpstreamError as exc:
            if exc.code not in {"MODEL_UNAVAILABLE", "AI_UPSTREAM", "AI_UPSTREAM_UNREACHABLE", "TIMEOUT"}:
                raise
            last_error = exc

    raise last_error or AiUpstreamError("AI_UPSTREAM", "The AI could not summarize this document.", status=502)
