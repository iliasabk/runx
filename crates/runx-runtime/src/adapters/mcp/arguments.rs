use runx_contracts::{JsonObject, JsonValue};

use crate::RuntimeError;
use crate::adapters::argument_template::map_argument_template;
use crate::json_render::json_number_string;

pub fn map_mcp_arguments(
    argument_template: Option<&JsonObject>,
    inputs: &JsonObject,
    resolved_inputs: &JsonObject,
) -> Result<JsonObject, RuntimeError> {
    map_argument_template(
        argument_template,
        inputs,
        resolved_inputs,
        "serializing MCP template input",
    )
}

pub(super) fn js_string(value: Option<&JsonValue>) -> String {
    match value {
        None | Some(JsonValue::Null) => String::new(),
        Some(JsonValue::String(value)) => value.clone(),
        Some(JsonValue::Bool(value)) => value.to_string(),
        Some(JsonValue::Number(value)) => json_number_string(value),
        Some(JsonValue::Array(values)) => values
            .iter()
            .map(|value| js_string(Some(value)))
            .collect::<Vec<_>>()
            .join(","),
        Some(JsonValue::Object(_)) => "[object Object]".to_owned(),
    }
}
