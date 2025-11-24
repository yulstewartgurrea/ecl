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

//////////////////////////////////////////////////////////////////
// INSERTED: Windows helper to ensure Python 3.12 is installed
//////////////////////////////////////////////////////////////////
#[cfg(target_os = "windows")]
fn ensure_python312_installed_and_in_path() {
    // Preferred per-user install location
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let py_dir_default = std::path::Path::new(&local)
        .join("Programs").join("Python").join("Python312");
    let py_exe_default = py_dir_default.join("python.exe");

    // Helper: run a command and return success
    let ok = |mut c: Command| {
        c.stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    };

    // Detect an existing 3.12
    let mut have_312 = false;

    if py_exe_default.exists() {
        have_312 = true;
    } else {
        let mut c = Command::new("py");
        c.args(["-3.12", "--version"]);
        if ok(c) {
            have_312 = true;
        } else if let Ok(out) = Command::new("python").arg("--version").output() {
            let s = if out.stdout.is_empty() { &out.stderr } else { &out.stdout };
            let v = String::from_utf8_lossy(s);
            if v.contains("3.12") {
                have_312 = true;
            }
        }
    }

    // If missing, download and install silently (per-user, no admin)
    if !have_312 {
        println!("Python 3.12 not found. Downloading and installing Python 3.12.0 for current user…");
        let url = "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe";
        let tmp = std::env::temp_dir().join("python-3.12.0-amd64.exe");
        let tmp_str = tmp.to_string_lossy().to_string();

        // Download with PowerShell to avoid adding Rust HTTP deps
        let dl = Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy","Bypass",
                "-Command",
                &format!("Invoke-WebRequest -UseBasicParsing -Uri '{}' -OutFile '{}'", url, tmp_str.replace('\\', "\\\\")),
            ])
            .status();

        if !dl.as_ref().map(|s| s.success()).unwrap_or(false) {
            eprintln!("Failed to download Python installer from {}", url);
        } else {
            let inst = Command::new(&tmp)
                .args([
                    "/quiet",
                    "InstallAllUsers=0",
                    "PrependPath=1",
                    "Include_test=0",
                    "SimpleInstall=1",
                    "Shortcuts=0",
                ])
                .status();

            if !inst.as_ref().map(|s| s.success()).unwrap_or(false) {
                eprintln!("Python installer failed (exit {:?}).", inst.ok().and_then(|s| s.code()));
            } else {
                println!("Python 3.12 installed successfully.");
            }
        }
    }

    // Ensure PATH for the current process so `Command::new("python")` resolves now
    let py_dir = if py_exe_default.exists() {
        py_dir_default.clone()
    } else if let Ok(out) = Command::new("py")
        .args(["-3.12","-c","import sys,os;print(os.path.dirname(sys.executable), end='')"])
        .output()
    {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let cand = std::path::PathBuf::from(s);
        if cand.exists() { cand } else { py_dir_default.clone() }
    } else {
        py_dir_default.clone()
    };

    let scripts = py_dir.join("Scripts");
    let old = std::env::var("PATH").unwrap_or_default();
    let mut newp = String::new();
    newp.push_str(&py_dir.to_string_lossy());
    newp.push(';');
    newp.push_str(&scripts.to_string_lossy());
    newp.push(';');
    newp.push_str(&old);
    std::env::set_var("PATH", newp);
}

#[cfg(not(target_os = "windows"))]
fn ensure_python312_installed_and_in_path() {
    // no-op on non-Windows platforms
}
//////////////////////////////////////////////////////////////////
// END INSERT
//////////////////////////////////////////////////////////////////

// Updater commands
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app.updater().map_err(|e| format!("Failed to get updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
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
                    println!("Downloaded {} bytes out of {:?}", chunk_length, content_length);
                },
                || {
                    println!("Download and installation completed.");
                },
            ).await {
                Ok(_) => {
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

//////////////////////////////////////////////////////////////////
// INSERTED: user-writable log directory to avoid UAC denials
//////////////////////////////////////////////////////////////////
fn resolve_log_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(base) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(base).join("ecl-automation-tool").join("logs");
            let _ = fs::create_dir_all(&p);
            return p;
        }
    }
    let p = std::env::temp_dir().join("ecl-automation-tool-logs");
    let _ = fs::create_dir_all(&p);
    p
}
//////////////////////////////////////////////////////////////////
// END INSERT
//////////////////////////////////////////////////////////////////

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
    // WRITE LOGS OUTSIDE Program Files (avoid UAC)
    let log_dir = resolve_log_dir();
    let stdout_path = log_dir.join("fastapi_stdout.log");
    let stderr_path = log_dir.join("fastapi_stderr.log");

    let stdout = fs::File::create(&stdout_path).unwrap();
    let stderr = fs::File::create(&stderr_path).unwrap();

    let mut args = vec!["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"];
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

    // // Ensure server subfolders like `files` exist
    ensure_server_folders(&server_dir);

    // Commented out to prevent auto-starting FastAPI server
    // This allows running FastAPI separately for development
    let python_exe = setup_python_env(&server_dir);
    let fastapi_child = start_fastapi(&server_dir, &python_exe);

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            create_folder_tree,
            upload_files,
            list_folder_contents, 
            get_folder_contents
            // check_for_updates,
            // install_update,
            // get_app_version
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