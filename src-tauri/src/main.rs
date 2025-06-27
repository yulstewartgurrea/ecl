#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
mod api;

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, sqlite::SqlitePoolOptions, Row};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use rand::rngs::OsRng;
use argon2::password_hash::SaltString;
use tauri_plugin_log::Builder;
use log::{info, LevelFilter};

// use api::excel::read_excel_file;
use api::excel::{read_excel_file, save_temp_file};

#[derive(Deserialize)]
struct LoginPayload {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    success: bool,
    role: Option<String>,
    message: String,
}

#[tokio::main]
async fn main() {
    // 1. Set up database path at project root (same level as src-tauri)
    let current_dir = std::env::current_dir().expect("Failed to get current directory");
    let db_path = current_dir.join("db.sqlite"); // Right beside src-tauri/

    info!("Database path: {}", db_path.display());

    // 2. Create database file if it doesn't exist
    if !db_path.exists() {
        std::fs::File::create(&db_path).expect("Failed to create database file");
        info!("Created new database at: {}", db_path.display());
    }

    // 3. Connect to SQLite
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&db_url)
        .await
        .unwrap_or_else(|e| {
            panic!("Failed to connect to database at {}: {}", db_path.display(), e);
        });

    // 4. Initialize database
    initialize_database(&pool).await;

    // 5. Run Tauri
    tauri::Builder::default()
        .plugin(Builder::default().level(LevelFilter::Info).build())
        .manage(pool)
        .invoke_handler(tauri::generate_handler![
            login,
            read_excel_file,
            save_temp_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn initialize_database(pool: &Pool<Sqlite>) {
    // Create users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            createdDate TEXT DEFAULT (datetime('now')),
            lastUpdatedDate TEXT DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to create users table");

    // Insert default users if empty
    if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .unwrap() == 0
    {
        info!("Inserting default users");
        for (username, password, role) in [
            ("admin", "sgvadmin0987", "admin"),
            ("user", "sgvuser0987", "user"),
        ] {
            let salt = SaltString::generate(&mut OsRng);
            let password_hash = Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .unwrap()
                .to_string();

            sqlx::query(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
            )
            .bind(username)
            .bind(password_hash)
            .bind(role)
            .execute(pool)
            .await
            .expect("Failed to insert default user");
        }
    }
}

#[tauri::command]
async fn login(
    db: tauri::State<'_, Pool<Sqlite>>,
    payload: LoginPayload,
) -> Result<LoginResponse, String> {
    match sqlx::query("SELECT password, role FROM users WHERE username = ?")
        .bind(&payload.username)
        .fetch_optional(&*db)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(row) => {
            let password_hash: String = row.try_get("password").map_err(|e| e.to_string())?;
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