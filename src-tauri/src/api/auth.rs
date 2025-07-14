use argon2::{Argon2, PasswordHash, PasswordVerifier};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, Row};
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub role: Option<String>,
    pub message: String,
}

#[tauri::command]
pub async fn login(
    db: State<'_, Pool<Sqlite>>,
    payload: LoginPayload,
) -> Result<LoginResponse, String> {
    match sqlx::query("SELECT hashed_password, role FROM users WHERE username = ?")
        .bind(&payload.username)
        .fetch_optional(&*db)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(row) => {
            let password_hash: String = row.try_get("hashed_password").map_err(|e| e.to_string())?;
            let role: String = row.try_get("role").map_err(|e| e.to_string())?;

            let parsed_hash = PasswordHash::new(&password_hash).map_err(|e| e.to_string())?;
            if Argon2::default()
                .verify_password(payload.password.as_bytes(), &parsed_hash)
                .is_ok()
            {
                Ok(LoginResponse {
                    success: true,
                    role: Some(role),
                    message: "Login successful".into(),
                })
            } else {
                Ok(LoginResponse {
                    success: false,
                    role: None,
                    message: "Incorrect password".into(),
                })
            }
        }
        None => Ok(LoginResponse {
            success: false,
            role: None,
            message: "User not found".into(),
        }),
    }
}
