# Structured Output

Structured final output is out of scope for localpi.

Localpi should focus on launching Pi against local models with good runtime defaults: managed `llama-server`, optional LM Studio support, default tools, tool approval, and token status.

Schema-constrained classifier workflows should live in caller-specific tools such as `localpager-agent`, where the prompt, schema, retries, and output validation belong to the application workflow.

The previous localagent `--final-schema` / `--schema` behavior should be removed during the localpi rename implementation.
