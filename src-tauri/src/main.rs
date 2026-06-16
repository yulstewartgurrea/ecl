use std::{
    fs,
    io::Read,
    net::TcpStream,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use tauri::{Manager, WindowEvent};
use tauri::Emitter; // needed for app_handle.emit(...)
use tauri_plugin_updater::UpdaterExt;
use chrono;

struct FastApiProcess(Mutex<Option<std::process::Child>>);
mod api;

use crate::api::folderapi::{
    create_folder_tree, get_folder_contents, list_folder_contents, upload_files,
};

//////////////////////////////////////////////////////////////////
// Payload for frontend progress UI
//////////////////////////////////////////////////////////////////
#[derive(Clone, serde::Serialize)]
struct BackendStatusPayload {
    /// Machine-readable step id (you can switch on this in React)
    step: String,
    /// Human-readable message to show to the user
    message: String,
    /// Optional error message (if something failed)
    error: Option<String>,
}

//////////////////////////////////////////////////////////////////
// Windows helper to ensure Python 3.12 is installed
//////////////////////////////////////////////////////////////////
#[cfg(target_os = "windows")]
fn ensure_python312_installed_and_in_path() {
    use std::path::Path;

    // Preferred per-user install location
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let py_dir_default = Path::new(&local)
        .join("Programs")
        .join("Python")
        .join("Python312");
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
        // try "py -3.12"
        let mut c = Command::new("py");
        c.args(["-3.12", "--version"]);
        if ok(c) {
            have_312 = true;
        } else if let Ok(out) = Command::new("python").arg("--version").output() {
            let s = if out.stdout.is_empty() {
                &out.stderr
            } else {
                &out.stdout
            };
            let v = String::from_utf8_lossy(s);
            if v.contains("3.12") {
                have_312 = true;
            }
        }
    }

    // If missing, download and install (with UI, so it DOESN'T auto-close)
    if !have_312 {
        println!("Python 3.12 not found. Downloading installer for current user…");

        let url = "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe";
        let tmp = std::env::temp_dir().join("python-3.12.0-amd64.exe");
        let tmp_str = tmp.to_string_lossy().to_string();

        // Download with PowerShell
        let dl = Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &format!(
                    "Invoke-WebRequest -UseBasicParsing -Uri '{}' -OutFile '{}'",
                    url,
                    tmp_str.replace('\\', "\\\\")
                ),
            ])
            .status();

        if !dl.as_ref().map(|s| s.success()).unwrap_or(false) {
            eprintln!("Failed to download Python installer from {}", url);
        } else {
            println!("Starting Python 3.12 installer…");
            println!("Please complete the installation window that appears.");
            // NOTE: no "/quiet" here, so the installer shows normal UI
            let inst = Command::new(&tmp)
                .args([
                    "InstallAllUsers=0",
                    "PrependPath=1",
                    "Include_test=0",
                    "SimpleInstall=1",
                    "Shortcuts=0",
                ])
                .status();

            match inst {
                Ok(status) if status.success() => {
                    println!("Python 3.12 installed successfully.");
                }
                Ok(status) => {
                    eprintln!("Python installer exited with status: {:?}", status.code());
                }
                Err(e) => {
                    eprintln!("Failed to start Python installer: {}", e);
                }
            }
        }
    }

    // Ensure PATH for the current process so `Command::new("python")` resolves
    let py_dir = if py_exe_default.exists() {
        py_dir_default.clone()
    } else if let Ok(out) = Command::new("py")
        .args(["-3.12", "-c", "import sys,os;print(os.path.dirname(sys.executable), end='')"])
        .output()
    {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let cand = PathBuf::from(s);
        if cand.exists() {
            cand
        } else {
            py_dir_default.clone()
        }
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
// END helper
//////////////////////////////////////////////////////////////////


// Updater commands (you can wire these later from the frontend)
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

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
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let maybe_update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    let update = if let Some(u) = maybe_update {
        u
    } else {
        return Err("No updates available".to_string());
    };

    update
        .download_and_install(
            |chunk_length, content_length| {
                println!(
                    "Downloaded {} bytes out of {:?}",
                    chunk_length, content_length
                );
            },
            || {
                println!("Download and installation completed.");
            },
        )
        .await
        .map_err(|e| format!("Failed to install update: {}", e))?;

    app.restart();

    Ok(())
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
// User-writable log directory to avoid UAC issues
//////////////////////////////////////////////////////////////////
fn resolve_log_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(base) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(base)
                .join("ecl-automation-tool")
                .join("logs");
            let _ = fs::create_dir_all(&p);
            return p;
        }
    }
    let p = std::env::temp_dir().join("ecl-automation-tool-logs");
    let _ = fs::create_dir_all(&p);
    p
}
//////////////////////////////////////////////////////////////////
// END
//////////////////////////////////////////////////////////////////

fn setup_python_env(server_dir: &PathBuf) -> Result<PathBuf, String> {
    let venv_path = server_dir.join("venv");

    // Create venv if it doesn't exist yet
    if !venv_path.exists() {
        println!("Creating Python venv at {:?}", venv_path);

        let cmd_res = if cfg!(windows) {
            Command::new("python")
                .args([
                    "-m",
                    "venv",
                    venv_path
                        .to_str()
                        .ok_or_else(|| "Invalid venv path".to_string())?,
                ])
                .current_dir(server_dir)
                .status()
        } else {
            Command::new("python3")
                .args([
                    "-m",
                    "venv",
                    venv_path
                        .to_str()
                        .ok_or_else(|| "Invalid venv path".to_string())?,
                ])
                .current_dir(server_dir)
                .status()
        };

        let status = cmd_res
            .map_err(|e| format!("Failed to spawn python to create venv: {e}"))?;
        if !status.success() {
            return Err(format!(
                "Python venv creation failed with status: {status:?}"
            ));
        }
    }

    // Ensure requirements.txt exists
    let req_file = server_dir.join("requirements.txt");
    if !req_file.exists() {
        fs::write(
            &req_file,
            "
            annotated-types==0.7.0
            anyio==4.9.0
            bcrypt==3.2.2
            certifi==2025.7.14
            cffi==1.17.1
            click==8.2.1
            colorama==0.4.6
            cryptography==45.0.5
            dnspython==2.7.0
            ecdsa==0.19.1
            email_validator==2.2.0
            et_xmlfile==2.0.0
            fastapi==0.109.0
            greenlet==3.2.3
            h11==0.16.0
            httpcore==1.0.9
            httptools==0.6.4
            httpx==0.28.1
            idna==3.10
            itsdangerous==2.2.0
            Jinja2==3.1.6
            MarkupSafe==3.0.2
            numpy==2.3.2
            openpyxl==3.1.5
            orjson==3.11.1
            pandas==2.3.1
            passlib==1.7.4
            pyasn1==0.6.1
            pycparser==2.22
            pydantic==2.5.3
            pydantic-extra-types==2.10.5
            pydantic-settings==2.2.1
            pydantic_core==2.14.6
            python-dateutil==2.9.0.post0
            python-dotenv==1.0.0
            python-jose==3.3.0
            python-multipart==0.0.6
            pytz==2025.2
            PyYAML==6.0.2
            rsa==4.9.1
            six==1.17.0
            sniffio==1.3.1
            SQLAlchemy==2.0.25
            starlette==0.35.1
            typing_extensions==4.14.1
            tzdata==2025.2
            ujson==5.10.0
            uvicorn==0.27.0
            watchfiles==0.20.0
            websockets==15.0.1
            xlsxwriter==3.2.5
            alembic==1.16.5

            # R CODES
            scipy>=1.16.2
            statsmodels>=0.14.5
            scikit-learn>=1.7.2
            matplotlib>=3.10.6
            seaborn>=0.13.2
            ",
        )
        .map_err(|e| format!("Failed to write requirements.txt: {e}"))?;
    }

    // Pick the venv python executable
    let python_exe = if cfg!(windows) {
        venv_path.join("Scripts").join("python.exe")
    } else {
        venv_path.join("bin").join("python")
    };

    if !python_exe.exists() {
        return Err(format!(
            "Python executable not found in venv at {:?}",
            python_exe
        ));
    }

    // Install dependencies
    println!("Installing Python dependencies...");
    let status = Command::new(&python_exe)
        .args([
            "-m",
            "pip",
            "install",
            "-r",
            req_file
                .to_str()
                .ok_or_else(|| "Invalid requirements path".to_string())?,
        ])
        .current_dir(server_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .map_err(|e| format!("Failed to run pip install: {e}"))?;

    if !status.success() {
        return Err(format!("pip install failed with status: {status:?}"));
    }

    Ok(python_exe)
}

fn start_fastapi(server_dir: &PathBuf, python_exe: &PathBuf) -> Result<std::process::Child, String> {
    // WRITE LOGS OUTSIDE Program Files (avoid UAC)
    let log_dir = resolve_log_dir();
    let stdout_path = log_dir.join("fastapi_stdout.log");
    let stderr_path = log_dir.join("fastapi_stderr.log");

    let stdout = fs::File::create(&stdout_path)
        .map_err(|e| format!("Failed to create FastAPI stdout log: {e}"))?;
    let stderr = fs::File::create(&stderr_path)
        .map_err(|e| format!("Failed to create FastAPI stderr log: {e}"))?;

    let mut args = vec!["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"];
    if cfg!(debug_assertions) {
        args.push("--reload");
        args.push("--reload-dir");
        args.push(
            server_dir
                .to_str()
                .ok_or_else(|| "Invalid server_dir path".to_string())?,
        );
    }

    let mut child = Command::new(python_exe)
        .args(&args)
        .current_dir(server_dir)
        .stdout(stdout)
        .stderr(stderr)
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn FastAPI process: {e}"))?;

    // Wait until port is open
    let timeout_secs = 15;
    let mut waited_ms = 0;
    let check_interval_ms = 500;

    loop {
        // If the child process died early, bail out and include log
        if let Ok(Some(status)) = child.try_wait() {
            let mut err_contents = String::new();
            let _ = fs::File::open(&stderr_path)
                .and_then(|mut f| f.read_to_string(&mut err_contents));
            return Err(format!(
                "FastAPI exited early with status {status:?}.\nStderr:\n{err_contents}"
            ));
        }

        if TcpStream::connect("127.0.0.1:8000").is_ok() {
            println!("FastAPI ready on 127.0.0.1:8000");
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(check_interval_ms));
        waited_ms += check_interval_ms;

        if waited_ms / 1000 >= timeout_secs {
            let mut err_contents = String::new();
            let _ = fs::File::open(&stderr_path)
                .and_then(|mut f| f.read_to_string(&mut err_contents));
            return Err(format!(
                "Timed out waiting for FastAPI on 127.0.0.1:8000.\nStderr:\n{err_contents}"
            ));
        }
    }

    Ok(child)
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
}

#[tauri::command]
fn backend_is_ready() -> bool {
    // If FastAPI is listening on 127.0.0.1:8000, we consider the backend ready
    TcpStream::connect("127.0.0.1:8000").is_ok()
}


#[tokio::main]
async fn main() {
    let server_dir = get_server_dir();
    fs::create_dir_all(&server_dir).unwrap();
    println!("Server directory: {:?}", server_dir);

    // Clone for background thread
    let server_dir_for_thread = server_dir.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(FastApiProcess(Mutex::new(None)))
            .invoke_handler(tauri::generate_handler![
        create_folder_tree,
        upload_files,
        list_folder_contents,
        get_folder_contents,
        // check_for_updates,
        // install_update,
        // get_app_version,
        backend_is_ready, // 🔹 NEW
    ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let server_dir_for_thread = server_dir_for_thread.clone();

            // 🔹 Start backend in a background thread, and emit progress to frontend
            std::thread::spawn(move || {
                let emit = |step: &str, msg: &str, err: Option<String>| {
                    let _ = app_handle.emit(
                        "backend-status",
                        BackendStatusPayload {
                            step: step.to_string(),
                            message: msg.to_string(),
                            error: err,
                        },
                    );
                };

                emit("init", "Preparing server folder…", None);
                ensure_server_folders(&server_dir_for_thread);

                emit("checking_python", "Checking Python 3.12 installation…", None);
                ensure_python312_installed_and_in_path();

                emit("creating_venv", "Setting up Python environment…", None);
                let python_exe = match setup_python_env(&server_dir_for_thread) {
                    Ok(p) => p,
                    Err(e) => {
                        emit("error", "Failed to set up Python environment.", Some(e));
                        return;
                    }
                };

                emit("starting_fastapi", "Starting FastAPI server…", None);
                let child = match start_fastapi(&server_dir_for_thread, &python_exe) {
                    Ok(child) => child,
                    Err(e) => {
                        emit("error", "Failed to start FastAPI server.", Some(e));
                        return;
                    }
                };

                // Save child for cleanup on window close (lookup state INSIDE thread)
                {
                    let fastapi_state: tauri::State<FastApiProcess> = app_handle.state();
                    let mut lock = fastapi_state.0.lock().unwrap();
                    *lock = Some(child);
                }

                emit("ready", "Backend is ready.", None);

                // Extra event just to signal "fully ready"
                let _ = app_handle.emit("backend-ready", ());
            });

            Ok(())
        })
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
