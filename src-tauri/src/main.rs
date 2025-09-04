use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
    io::Read,
};
use tauri::{Manager, WindowEvent, State};
use std::net::TcpStream;
use tauri_plugin_updater::UpdaterExt;
use chrono;

struct FastApiProcess(Mutex<Option<std::process::Child>>);
mod api;

use crate::api::folderapi::{create_folder_tree, upload_files, list_folder_contents, get_folder_contents};

// Updater commands
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            // Convert update info to JSON
            let update_info = serde_json::json!({
                "version": update.version,
                "date": chrono::Utc::now().to_rfc3339(),
                "body": "Bug fixes and improvements"
            });
            Ok(update_info)
        }
        Ok(None) => Err("No updates available".to_string()),
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            match update.download_and_install(
                |chunk_length, content_length| {
                    // Handle download progress
                    println!("Downloaded {} bytes out of {:?}", chunk_length, content_length);
                },
                || {
                    // Handle completion
                    println!("Download and installation completed.");
                },
            ).await {
                Ok(_) => {
                    // Restart the app after successful update
                    app.restart();
                    Ok(())
                }
                Err(e) => Err(format!("Failed to install update: {}", e)),
            }
        }
        Ok(None) => Err("No updates available".to_string()),
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

#[tauri::command]
async fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}



fn get_server_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        // DEV: project root/server
        let mut dir = std::env::current_dir().unwrap();
        dir.pop(); // go up from src-tauri
        dir.push("server");
        dir
    } else {
        // PROD: _up_/server
        let exe = std::env::current_exe().unwrap();
        let exe_dir = exe.parent().unwrap();
        exe_dir.join("_up_").join("server")
    }
}

fn setup_python_env(server_dir: &PathBuf) -> PathBuf {
    let venv_path = server_dir.join("venv");
    if !venv_path.exists() {
        println!("Creating Python venv at {:?}", venv_path);
        let status = if cfg!(windows) {
            Command::new("python")
                .args(["-m", "venv", venv_path.to_str().unwrap()])
                .current_dir(server_dir)
                .status()
                .unwrap()
        } else {
            Command::new("python3")
                .args(["-m", "venv", venv_path.to_str().unwrap()])
                .current_dir(server_dir)
                .status()
                .unwrap()
        };
        if !status.success() {
            panic!("Failed to create Python venv");
        }
    }

    // Ensure requirements.txt exists
    let req_file = server_dir.join("requirements.txt");
    if !req_file.exists() {
        fs::write(
            &req_file,
            "fastapi==0.95.2\nuvicorn[standard]==0.22.0\npython-multipart==0.0.6\nsqlalchemy==2.0.15\npydantic==1.10.7\npasslib[bcrypt]==1.7.5\npython-jose==3.3.0\nwatchfiles==0.20.0\n",
        ).unwrap();
    }

    // Install requirements
    let python_exe = if cfg!(windows) {
        venv_path.join("Scripts").join("python.exe")
    } else {
        venv_path.join("bin").join("python")
    };

    println!("Installing Python dependencies...");
    let _ = Command::new(&python_exe)
        .args(["-m", "pip", "install", "-r", req_file.to_str().unwrap()])
        .current_dir(server_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .unwrap();

    python_exe
}

fn start_fastapi(server_dir: &PathBuf, python_exe: &PathBuf) -> std::process::Child {
    let stdout_path = server_dir.join("fastapi_stdout.log");
    let stderr_path = server_dir.join("fastapi_stderr.log");

    let stdout = fs::File::create(&stdout_path).unwrap();
    let stderr = fs::File::create(&stderr_path).unwrap();

    let mut args = vec!["-m", "uvicorn", "main:app", "--port", "8000"];
    if cfg!(debug_assertions) {
        args.push("--reload");
        args.push("--reload-dir");
        args.push(server_dir.to_str().unwrap());
    }

    let mut child = Command::new(python_exe)
        .args(&args)
        .current_dir(server_dir)
        .stdout(stdout)
        .stderr(stderr)
        .stdin(Stdio::null())
        .spawn()
        .unwrap();

    // Wait until port is open
    let timeout_secs = 15;
    let mut waited = 0;
    let check_interval = 500;
    loop {
        if let Ok(Some(status)) = child.try_wait() {
            panic!("FastAPI exited early with status {:?}", status);
        }

        if TcpStream::connect("127.0.0.1:8000").is_ok() {
            println!("FastAPI ready on 127.0.0.1:8000");
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(check_interval));
        waited += check_interval;
        if waited / 1000 >= timeout_secs {
            let mut err_contents = String::new();
            let _ = fs::File::open(&stderr_path).and_then(|mut f| f.read_to_string(&mut err_contents));
            panic!("Timed out waiting for FastAPI:\n{}", err_contents);
        }
    }

    child
}


fn ensure_server_folders(server_dir: &PathBuf) {
    let files_dir = server_dir.join("files");

    if !files_dir.exists() {
        println!("Creating files directory at {:?}", files_dir);
        if let Err(e) = std::fs::create_dir_all(&files_dir) {
            panic!("Failed to create files folder: {}", e);
        }
    } else {
        println!("Files directory already exists at {:?}", files_dir);
    }

    // Add more folders here if needed in the future
}

#[tokio::main]
async fn main() {
    let server_dir = get_server_dir();
    fs::create_dir_all(&server_dir).unwrap();
    println!("Server directory: {:?}", server_dir);

    // Ensure server subfolders like `files` exist
    ensure_server_folders(&server_dir);

    let python_exe = setup_python_env(&server_dir);
    let fastapi_child = start_fastapi(&server_dir, &python_exe);

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            create_folder_tree,
            upload_files,
            list_folder_contents, 
            get_folder_contents,
            check_for_updates,
            install_update,
            get_app_version
        ])
        .manage(FastApiProcess(Mutex::new(Some(fastapi_child))))
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<FastApiProcess>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
