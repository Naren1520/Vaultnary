use tracing::{info, warn};

/// Send an email via Resend API.
/// Falls back to logging the token if RESEND_API_KEY is not set.
pub async fn send_verification_email(to: &str, token: &str, frontend_url: &str) {
    let api_key = match std::env::var("RESEND_API_KEY") {
        Ok(k) if !k.is_empty() && k != "re_your_resend_api_key_here" => k,
        _ => {
            info!(
                to = to,
                "RESEND_API_KEY not set — verification token (dev only, never log in prod): {}",
                token
            );
            return;
        }
    };

    let from = std::env::var("EMAIL_FROM")
        .unwrap_or_else(|_| "Vaultnary <noreply@vaultnary.app>".to_string());

    let verify_url = format!("{}/verify-email?token={}", frontend_url.trim_end_matches('/'), token);

    let body = serde_json::json!({
        "from": from,
        "to": [to],
        "subject": "Verify your Vaultnary email address",
        "html": format!(
            r#"<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="font-size:1.25rem;font-weight:700;color:#111;margin-bottom:16px">Verify your email</h2>
              <p style="color:#444;line-height:1.6;margin-bottom:24px">
                Click the button below to verify your email address and activate your Vaultnary account.
                This link expires in 24 hours.
              </p>
              <a href="{url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9375rem">
                Verify email address
              </a>
              <p style="margin-top:24px;font-size:0.8125rem;color:#999">
                If you did not create a Vaultnary account, you can safely ignore this email.
              </p>
            </div>"#,
            url = verify_url
        ),
    });

    let client = reqwest::Client::new();
    match client
        .post("https://api.resend.com/emails")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(to = to, "Verification email sent via Resend");
        }
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            warn!(to = to, status = %status, body = %text, "Resend API returned error");
        }
        Err(e) => {
            warn!(to = to, error = %e, "Failed to send verification email via Resend");
        }
    }
}

pub async fn send_password_reset_email(to: &str, token: &str, frontend_url: &str) {
    let api_key = match std::env::var("RESEND_API_KEY") {
        Ok(k) if !k.is_empty() && k != "re_your_resend_api_key_here" => k,
        _ => {
            info!(
                to = to,
                "RESEND_API_KEY not set — reset token (dev only): {}",
                token
            );
            return;
        }
    };

    let from = std::env::var("EMAIL_FROM")
        .unwrap_or_else(|_| "Vaultnary <noreply@vaultnary.app>".to_string());

    let reset_url = format!("{}/reset-password?token={}", frontend_url.trim_end_matches('/'), token);

    let body = serde_json::json!({
        "from": from,
        "to": [to],
        "subject": "Reset your Vaultnary password",
        "html": format!(
            r#"<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="font-size:1.25rem;font-weight:700;color:#111;margin-bottom:16px">Reset your password</h2>
              <p style="color:#444;line-height:1.6;margin-bottom:24px">
                Click the button below to reset your Vaultnary password.
                This link expires in 60 minutes.
              </p>
              <a href="{url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9375rem">
                Reset password
              </a>
              <p style="margin-top:24px;font-size:0.8125rem;color:#999">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </div>"#,
            url = reset_url
        ),
    });

    let client = reqwest::Client::new();
    match client
        .post("https://api.resend.com/emails")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(to = to, "Password reset email sent via Resend");
        }
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            warn!(to = to, status = %status, body = %text, "Resend API returned error for reset email");
        }
        Err(e) => {
            warn!(to = to, error = %e, "Failed to send password reset email via Resend");
        }
    }
}
