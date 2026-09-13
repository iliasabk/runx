use runx_contracts::{JsonObject, JsonValue};

use crate::RuntimeError;

const TEMPLATE_OPEN: &str = "\x7b\x7b";
const TEMPLATE_CLOSE: &str = "\x7d\x7d";

pub(super) fn map_argument_template(
    argument_template: Option<&JsonObject>,
    inputs: &JsonObject,
    resolved_inputs: &JsonObject,
    serialization_context: &'static str,
) -> Result<JsonObject, RuntimeError> {
    let Some(template) = argument_template else {
        let mut merged = inputs.clone();
        merged.extend(resolved_inputs.clone());
        return Ok(merged);
    };
    template
        .iter()
        .map(|(key, value)| {
            let mapped = match value {
                JsonValue::String(template) => {
                    map_template_string(template, inputs, resolved_inputs, serialization_context)?
                }
                other => other.clone(),
            };
            Ok((key.clone(), mapped))
        })
        .collect()
}

fn map_template_string(
    template: &str,
    inputs: &JsonObject,
    resolved_inputs: &JsonObject,
    serialization_context: &'static str,
) -> Result<JsonValue, RuntimeError> {
    if let Some(key) = exact_template_key(template) {
        return Ok(resolved_inputs
            .get(key)
            .or_else(|| inputs.get(key))
            .cloned()
            .unwrap_or(JsonValue::Null));
    }

    let mut rendered = String::new();
    let mut rest = template;
    while let Some(start) = rest.find(TEMPLATE_OPEN) {
        let (prefix, after_start) = rest.split_at(start);
        rendered.push_str(prefix);
        let after_start = &after_start[TEMPLATE_OPEN.len()..];
        let Some(end) = after_start.find(TEMPLATE_CLOSE) else {
            rendered.push_str(TEMPLATE_OPEN);
            rendered.push_str(after_start);
            return Ok(JsonValue::String(rendered));
        };
        let raw_key = &after_start[..end];
        let key = raw_key.trim();
        if valid_template_key(key) {
            rendered.push_str(&stringify_input(
                resolved_inputs.get(key).or_else(|| inputs.get(key)),
                serialization_context,
            )?);
        } else {
            rendered.push_str(TEMPLATE_OPEN);
            rendered.push_str(raw_key);
            rendered.push_str(TEMPLATE_CLOSE);
        }
        rest = &after_start[end + TEMPLATE_CLOSE.len()..];
    }
    rendered.push_str(rest);
    Ok(JsonValue::String(rendered))
}

fn exact_template_key(template: &str) -> Option<&str> {
    let inner = template
        .trim()
        .strip_prefix(TEMPLATE_OPEN)?
        .strip_suffix(TEMPLATE_CLOSE)?
        .trim();
    valid_template_key(inner).then_some(inner)
}

fn valid_template_key(key: &str) -> bool {
    !key.is_empty()
        && key.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
}

fn stringify_input(
    value: Option<&JsonValue>,
    serialization_context: &'static str,
) -> Result<String, RuntimeError> {
    match value {
        None | Some(JsonValue::Null) => Ok(String::new()),
        Some(JsonValue::String(value)) => Ok(value.clone()),
        Some(value) => serde_json::to_string(value)
            .map_err(|source| RuntimeError::json(serialization_context, source)),
    }
}
