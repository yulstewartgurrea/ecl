mod api;

use std::{
    error::Error,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use api::auth::login;
use api::folderapi::{create_folder_tree, upload_files, list_folder_contents, get_folder_contents};


use rusqlite::Connection;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use tauri::{Manager, WindowEvent};

const PROD: bool = false;

struct FastApiProcess(Mutex<Option<std::process::Child>>);

fn init_db(db_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::open(db_path)?;

    // Ensure tables exist
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            hashed_password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL,
            workflow_name TEXT NOT NULL,
            baseline_year INTEGER NOT NULL,
            json_data TEXT NOT NULL,
            reporting_period TEXT NOT NULL,
            workflow_type TEXT DEFAULT 'default',
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            workflow_path TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            json_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
        CREATE TABLE IF NOT EXISTS json (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            workflow_path TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            json_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        "#
    )?;

    Ok(())
}

fn get_server_dir() -> PathBuf {
    if PROD {
        std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .to_path_buf()
            .join("_up_")
            .join("server")
    } else {
        std::env::current_dir().unwrap().parent().unwrap().join("server")
    }
}

fn setup_environment(server_dir: &PathBuf) -> Result<(), Box<dyn Error>> {
    if !PROD {
        if !server_dir.exists() {
            fs::create_dir_all(server_dir)?;
        }

        let venv_path = server_dir.join("venv");
        if !venv_path.exists() {
            println!("Creating virtual environment...");
            let status = if cfg!(windows) {
                Command::new("python")
                    .args(["-m", "venv", venv_path.to_str().unwrap()])
                    .current_dir(server_dir)
                    .status()?
            } else {
                Command::new("python3")
                    .args(["-m", "venv", venv_path.to_str().unwrap()])
                    .current_dir(server_dir)
                    .status()?
            };
            if !status.success() {
                return Err("Failed to create virtual environment".into());
            }
        }

        let requirements_path = server_dir.join("requirements.txt");
        if !requirements_path.exists() {
            fs::write(
                &requirements_path,
                "fastapi==0.95.2\nuvicorn==0.22.0\npython-multipart==0.0.6\nsqlalchemy==2.0.15\npydantic==1.10.7"
            )?;
        }

        println!("Installing Python dependencies...");
        let pip_install = if cfg!(windows) {
            Command::new(venv_path.join("Scripts").join("pip.exe"))
                .args(["install", "-r", "requirements.txt"])
                .current_dir(server_dir)
                .status()?
        } else {
            Command::new(venv_path.join("bin").join("pip"))
                .args(["install", "-r", "requirements.txt"])
                .current_dir(server_dir)
                .status()?
        };

        if !pip_install.success() {
            return Err("Failed to install Python dependencies".into());
        }
    }

    Ok(())
}

fn start_fastapi(server_dir: &PathBuf) -> Result<std::process::Child, Box<dyn Error>> {
    let stdout = std::fs::File::create(server_dir.join("fastapi_stdout.log"))?;
    let stderr = std::fs::File::create(server_dir.join("fastapi_stderr.log"))?;

    let child = if cfg!(windows) {
        let python_exe = server_dir.join("venv").join("Scripts").join("python.exe");
        Command::new(python_exe)
            .args(["-m", "uvicorn", "main:app", "--port", "8000"])
            .current_dir(server_dir)
            .stdout(stdout)
            .stderr(stderr)
            .spawn()?
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(format!(
                "source {}/venv/bin/activate && python -m uvicorn main:app --port 8000",
                server_dir.display()
            ))
            .current_dir(server_dir)
            .stdout(stdout)
            .stderr(stderr)
            .spawn()?
    };

    println!("✅ FastAPI process started: PID {:?}", child.id());
    std::thread::sleep(std::time::Duration::from_secs(3));
    Ok(child)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server_dir = get_server_dir();
    let db_path = server_dir.join("db.sqlite");

    println!("🔧 Server directory: {:?}", server_dir);
    println!("🗃️  Database path: {:?}", db_path);

    setup_environment(&server_dir)?;
    init_db(&db_path)?;

    let db_url = format!("sqlite://{}", db_path.display());
    let db: Pool<Sqlite> = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    let fastapi_process = start_fastapi(&server_dir)?;

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            login,
            create_folder_tree,
            upload_files,
            list_folder_contents, get_folder_contents
        ])

        .manage(db)
        .manage(FastApiProcess(Mutex::new(Some(fastapi_process))))
        .setup(|_app| Ok(()))
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<FastApiProcess>() {
                    if let Some(mut process) = state.0.lock().unwrap().take() {
                        let _ = process.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())?;

    Ok(())
}
