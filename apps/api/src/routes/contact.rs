use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use serde::Deserialize;
use serde_json::json;
use validator::ValidateEmail;

#[derive(Deserialize)]
pub struct ContactRequest {
    name: String,
    email: String,
    topic: String,
    message: String,
}

pub async fn submit(Json(request): Json<ContactRequest>) -> impl IntoResponse {
    let name = request.name.trim();
    let email = request.email.trim();
    let message = request.message.trim();

    if name.is_empty() || name.len() > 100 || has_disallowed_controls(name) {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": "Please enter a name of 1 to 100 characters." })),
        );
    }

    if email.len() > 254 || !email.validate_email() || has_disallowed_controls(email) {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": "Please enter a valid email address." })),
        );
    }

    let topic = match request.topic.as_str() {
        "General question" | "Account help" | "Product feedback" | "Partnership" => {
            request.topic.as_str()
        }
        _ => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": "Please select a valid enquiry topic." })),
            )
        }
    };

    let has_disallowed_message_control = message
        .chars()
        .any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t');
    if message.len() < 10 || message.len() > 5_000 || has_disallowed_message_control {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": "Please enter a message between 10 and 5,000 characters." })),
        );
    }

    let api_key = match std::env::var("RESEND_API_KEY") {
        Ok(key) if !key.is_empty() && key != "re_your_resend_api_key_here" => key,
        _ => {
            tracing::error!("Contact form is unavailable because RESEND_API_KEY is not configured");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(
                    json!({ "error": "The contact form is temporarily unavailable. Please email us directly." }),
                ),
            );
        }
    };

    let from = std::env::var("EMAIL_FROM")
        .unwrap_or_else(|_| "Vaultnary <noreply@vaultnary.app>".to_string());
    let to =
        std::env::var("CONTACT_EMAIL").unwrap_or_else(|_| "narensonu1520@gmail.com".to_string());
    let html = format!(
        "<h2>New Vaultnary enquiry</h2><p><strong>From:</strong> {} ({})</p><p><strong>Topic:</strong> {}</p><p><strong>Message:</strong></p><p>{}</p>",
        escape_html(name),
        escape_html(email),
        escape_html(topic),
        escape_html(message).replace('\n', "<br>")
    );
    let body = json!({
        "from": from,
        "to": [to],
        "reply_to": email,
        "subject": format!("Vaultnary enquiry: {topic}"),
        "html": html,
    });

    let result = reqwest::Client::new()
        .post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await;

    match result {
        Ok(response) if response.status().is_success() => (
            StatusCode::OK,
            Json(json!({ "message": "Your message has been sent." })),
        ),
        Ok(response) => {
            tracing::error!(status = %response.status(), "Resend rejected a contact enquiry");
            (
                StatusCode::BAD_GATEWAY,
                Json(
                    json!({ "error": "We couldn't send your message right now. Please try again or email us directly." }),
                ),
            )
        }
        Err(error) => {
            tracing::error!(%error, "Failed to send contact enquiry through Resend");
            (
                StatusCode::BAD_GATEWAY,
                Json(
                    json!({ "error": "We couldn't send your message right now. Please try again or email us directly." }),
                ),
            )
        }
    }
}

fn has_disallowed_controls(value: &str) -> bool {
    value.chars().any(char::is_control)
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::{escape_html, has_disallowed_controls};

    #[test]
    fn escapes_html_in_contact_content() {
        assert_eq!(
            escape_html("<script>alert('x')</script>"),
            "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
        );
    }

    #[test]
    fn detects_control_characters_in_single_line_fields() {
        assert!(has_disallowed_controls("name\nbcc:someone@example.com"));
        assert!(!has_disallowed_controls("A team contact"));
    }
}
