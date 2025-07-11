// use std::{
//     error::Error,
//     path::PathBuf,
//     process::{Command, Stdio},
//     sync::Mutex,
// };

// use rusqlite::Connection;
// use tauri::{Manager, Window, Wry, WindowEvent};

// struct FastApiProcess(Mutex<Option<std::process::Child>>);

// fn init_db(db_path: &PathBuf) -> Result<(), Box<dyn Error>> {
//     if !db_path.exists() {
//         let conn = Connection::open(db_path)?;
//         conn.execute_batch(
//             r#"
//             CREATE TABLE IF NOT EXISTS users (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 username TEXT NOT NULL UNIQUE,
//                 email TEXT NOT NULL UNIQUE,
//                 hashed_password TEXT NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//             );
//             CREATE TABLE IF NOT EXISTS workflows (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 entity TEXT NOT NULL,
//                 workflow_name TEXT NOT NULL,
//                 baseline_year INTEGER NOT NULL,
//                 json_data TEXT NOT NULL,
//                 reporting_period TEXT NOT NULL,
//                 workflow_type TEXT DEFAULT 'default',
//                 user_id INTEGER NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//                 FOREIGN KEY (user_id) REFERENCES users (id)
//             );
//             CREATE TABLE IF NOT EXISTS documents (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 filename TEXT NOT NULL,
//                 document_key TEXT NOT NULL,
//                 document_type TEXT NOT NULL,
//                 file_data BLOB,
//                 user_id INTEGER NOT NULL,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//                 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//                 FOREIGN KEY (user_id) REFERENCES users (id)
//             );
//             "#
//         )?;
//     }
//     Ok(())
// }

// fn start_fastapi(server_dir: &PathBuf) -> Result<std::process::Child, Box<dyn Error>> {
//     // Create log files
//     let stdout = std::fs::File::create(server_dir.join("fastapi_stdout.log"))?;
//     let stderr = std::fs::File::create(server_dir.join("fastapi_stderr.log"))?;

//     // Windows-specific command
//     let python_exe = server_dir.join("venv\\Scripts\\python.exe");
//     let python_path = python_exe.to_str().ok_or("Invalid Python path")?;

//     println!("Starting FastAPI using Python at: {}", python_path);

//     let child = if cfg!(windows) {
//         Command::new(python_path)
//             .args(["-m", "uvicorn", "main:app", "--port", "8000"])
//             .current_dir(server_dir)
//             .stdout(stdout)
//             .stderr(stderr)
//             .spawn()
//             .map_err(|e| {
//                 println!("Failed to start FastAPI: {}", e);
//                 e
//             })?
//     } else {
//         Command::new("sh")
//             .arg("-c")
//             .arg(&format!("source {}/venv/bin/activate && python -m uvicorn main:app --port 8000",
//                  server_dir.display()))
//             .current_dir(server_dir)
//             .stdout(stdout)
//             .stderr(stderr)
//             .spawn()?
//     };

//     println!("FastAPI process started with PID: {:?}", child.id());
//     std::thread::sleep(std::time::Duration::from_secs(3));

//     Ok(child)
// }

// fn main() -> Result<(), Box<dyn Error>> {
//     tauri::Builder::default()
//         .setup(|app| {
//             // Get the directory containing src-tauri
//             let project_root = std::env::current_dir()?  // src-tauri/src
//                 .parent()    // src-tauri
//                 .map(|p| p.to_path_buf())
//                 .unwrap_or_else(|| PathBuf::from("."));

//             // Server is at root/server (same level as src-tauri)
//             let server_dir = project_root.join("server");
//             let db_path = server_dir.join("db.sqlite");

//             // VERIFY PATHS BEFORE CREATION
//             println!("Current directory: {:?}", std::env::current_dir()?);
//             println!("Project root (src-tauri parent): {:?}", project_root);
//             println!("Server directory: {:?}", server_dir);
//             println!("Database will be created at: {:?}", db_path);

//             // Only create if doesn't exist
//             if !server_dir.exists() {
//                 std::fs::create_dir(&server_dir)?;
//             }

//             init_db(&db_path)?;

//             let fastapi_process = start_fastapi(&server_dir)?;
//             app.manage(FastApiProcess(Mutex::new(Some(fastapi_process))));

//             Ok(())
//         })
//         .on_window_event(|window: &Window<Wry>, event: &WindowEvent| {
//             if let WindowEvent::Destroyed = event {
//                 if let Some(state) = window.try_state::<FastApiProcess>() {
//                     if let Some(mut process) = state.0.lock().unwrap().take() {
//                         let _ = process.kill();
//                     }
//                 }
//             }
//         })
//         .run(tauri::generate_context!())?;

//     Ok(())
// }

use std::{
    error::Error,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
    fs,
};

use rusqlite::Connection;
use tauri::{Manager, Window, Wry, WindowEvent};

const PROD: bool = false;

struct FastApiProcess(Mutex<Option<std::process::Child>>);

fn init_db(db_path: &PathBuf) -> Result<(), Box<dyn Error>> {
    if !db_path.exists() {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
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
                document_key TEXT NOT NULL,
                document_type TEXT NOT NULL,
                file_data BLOB,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
            "#,
        )?;
    }
    Ok(())
}

fn get_server_dir() -> PathBuf {
    if PROD {
        let exe_dir = std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .to_path_buf();
        exe_dir.join("_up_").join("server")
    } else {
        std::env::current_dir()
            .unwrap()
            .parent()
            .unwrap()
            .join("server")
    }
}

fn setup_environment(server_dir: &PathBuf) -> Result<(), Box<dyn Error>> {
    if !PROD {
        // Dev only
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
                "fastapi==0.95.2\nuvicorn==0.22.0\npython-multipart==0.0.6\nsqlalchemy==2.0.15\npydantic==1.10.7",
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
    } else {
        // PROD: Only install deps if requirements.txt exists
        let venv_path = if cfg!(windows) {
            server_dir.join("venv").join("Scripts").join("python.exe")
        } else {
            server_dir.join("venv").join("bin").join("python")
        };

        if !venv_path.exists() {
            return Err(format!(
                "❌ Production venv python executable not found at: {:?}",
                venv_path
            )
            .into());
        }

        let requirements_path = server_dir.join("requirements.txt");
        if requirements_path.exists() {
            println!("Installing Python dependencies in PROD...");
            let pip_install = if cfg!(windows) {
                Command::new(server_dir.join("venv").join("Scripts").join("pip.exe"))
                    .args(["install", "-r", "requirements.txt"])
                    .current_dir(server_dir)
                    .status()?
            } else {
                Command::new(server_dir.join("venv").join("bin").join("pip"))
                    .args(["install", "-r", "requirements.txt"])
                    .current_dir(server_dir)
                    .status()?
            };

            if !pip_install.success() {
                return Err("❌ Failed to install Python dependencies in production".into());
            }
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

fn main() -> Result<(), Box<dyn Error>> {
    tauri::Builder::default()
        .setup(|app| {
            let server_dir = get_server_dir();
            let db_path = server_dir.join("db.sqlite");

            println!("🔧 Server directory: {:?}", server_dir);
            println!("🗃️  Database path: {:?}", db_path);

            setup_environment(&server_dir)?;
            init_db(&db_path)?;
            let fastapi_process = start_fastapi(&server_dir)?;
            app.manage(FastApiProcess(Mutex::new(Some(fastapi_process))));

            Ok(())
        })
        .on_window_event(|window: &Window<Wry>, event: &WindowEvent| {
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


