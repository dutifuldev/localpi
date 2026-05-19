# Structured Output

Localagent should support structured final answers for workflows that need machine-readable metadata from a local model.

Example: inspect a GitHub PR with Pi tools, then classify whether the PR is related to local models.

## Recommendation

Use two phases:

1. Let Pi use tools normally.
   - It can call commands like gh pr view.
   - It can inspect PR text, comments, labels, diffs, and local files.
   - Do not force JSON schema on these intermediate turns.

2. Force JSON schema only on the final answer.
   - The final model call gets an OpenAI-compatible response_format.
   - The final answer must be JSON only.
   - Validate the JSON after generation.
   - If validation fails, retry once with a repair prompt.

Short version: tool calls freeform, final answer schema-forced.

## Why Final-Only

Pi's first model response may need to be a tool call:

    gh pr view 80568 --repo openclaw/openclaw --json url,title,body,state,labels,files,comments

If every model call is forced to match the final classification schema, the model cannot cleanly request tools. The agent loop and the final answer have different output contracts:

- agent loop output may be a tool call
- final answer output must be schema JSON

Keep those contracts separate.

## Proposed CLI

    localagent --model gemma-4-e4b-it \
      --schema ./schemas/local-model-classifier.schema.json \
      --schema-mode final-only \
      "inspect https://github.com/openclaw/openclaw/pull/80568 and classify it"

The exact flag names can change. The important behavior is final-only.

## Final Request Shape

For the final answer call, inject this into the OpenAI-compatible request sent to LM Studio or another local endpoint:

    {
      "response_format": {
        "type": "json_schema",
        "json_schema": {
          "name": "local_model_classification",
          "strict": true,
          "schema": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "is_local_model_related",
              "relevance",
              "confidence",
              "description",
              "evidence",
              "caveats",
              "metadata"
            ],
            "properties": {
              "is_local_model_related": {
                "type": "boolean"
              },
              "relevance": {
                "type": "string",
                "enum": [
                  "not_local_models",
                  "tangential",
                  "relevant",
                  "highly_relevant"
                ]
              },
              "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1
              },
              "description": {
                "type": "string"
              },
              "evidence": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "caveats": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "metadata": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "topic",
                  "provider_or_area",
                  "actionability"
                ],
                "properties": {
                  "topic": {
                    "type": "string"
                  },
                  "provider_or_area": {
                    "type": "string"
                  },
                  "actionability": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    }

## Implementation Notes

Pi's OpenAI completions path builds request params and then calls an onPayload hook before sending the request. Localagent can use that hook to add response_format for final-answer calls.

Implementation shape:

1. Add CLI/config flags for a schema path and schema mode.
2. Load and validate the schema file at startup.
3. Store the schema in run options.
4. Add response_format only when Pi is making the final-answer request.
5. Parse and validate the returned text with a JSON Schema validator.
6. If invalid, retry once with the invalid JSON and validation errors.

## Reliability

Treat LM Studio schema mode as helpful but not sufficient by itself. Some local model backends may support OpenAI-style json_schema well; others may ignore or partially enforce it.

The contract should be:

- request schema-constrained output
- parse returned JSON
- validate against the schema
- retry or fail clearly if validation still fails

## Example Output

    {
      "is_local_model_related": true,
      "relevance": "relevant",
      "confidence": 0.9,
      "description": "This PR fixes LM Studio auth resolution, which affects using local model servers from OpenClaw.",
      "evidence": [
        "PR changes files under extensions/lmstudio",
        "PR fixes env-backed API key resolution for LM Studio"
      ],
      "caveats": [
        "This is provider auth/config work, not inference behavior"
      ],
      "metadata": {
        "topic": "local model provider integration",
        "provider_or_area": "LM Studio",
        "actionability": "track or review if working on local model support"
      }
    }
