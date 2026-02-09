use std::{
    fs,
    io::Read,
    net::TcpStream,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_updater::UpdaterExt;
use chrono;

struct FastApiProcess(Mutex<Option<std::process::Child>>);

mod api;
use crate::api::folderapi::{
    create_folder_tree, get_folder_contents, list_folder_contents, upload_files,
};

//////////////////////////////////////////////////////////////////
// Enable DevTools (debug OR explicit production opt-in)
//////////////////////////////////////////////////////////////////
fn should_enable_devtools() -> bool {
    std::env::var("TAURI_DEVTOOLS")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(cfg!(debug_assertions))
}

//////////////////////////////////////////////////////////////////
// Payload for frontend progress UI
//////////////////////////////////////////////////////////////////
#[derive(Clone, serde::Serialize)]
struct BackendStatusPayload {
    step: String,
    message: String,
    error: Option<String>,
}

//////////////////////////////////////////////////////////////////
// Windows helper: ensure Python 3.12
//////////////////////////////////////////////////////////////////
#[cfg(target_os = "windows")]
fn ensure_python312_installed_and_in_path() {
    use std::path::Path;

    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let py_dir = Path::new(&local)
        .join("Programs")
        .join("Python")
        .join("Python312");

    let py_exe = py_dir.join("python.exe");

    let ok = |mut c: Command| {
        c.stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    };

    let mut have_312 = py_exe.exists();

    if !have_312 {
        let mut c = Command::new("py");
        c.args(["-3.12", "--version"]);
        have_312 = ok(c);
    }

    if !have_312 {
        let url = "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe";
        let tmp = std::env::temp_dir().join("python-3.12.0.exe");

        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &format!(
                    "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                    url,
                    tmp.display()
                ),
            ])
            .status();

        let _ = Command::new(&tmp)
            .args([
                "InstallAllUsers=0",
                "PrependPath=1",
                "SimpleInstall=1",
            ])
            .status();
    }

    let mut path = std::env::var("PATH").unwrap_or_default();
    path = format!(
        "{};{};{}",
        py_dir.display(),
        py_dir.join("Scripts").display(),
        path
    );
    std::env::set_var("PATH", path);
}

#[cfg(not(target_os = "windows"))]
fn ensure_python312_installed_and_in_path() {}

//////////////////////////////////////////////////////////////////
// Backend helpers
//////////////////////////////////////////////////////////////////
fn get_server_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        let mut dir = std::env::current_dir().unwrap();
        dir.pop();
        dir.push("server");
        dir
    } else {
        let exe = std::env::current_exe().unwrap();
        exe.parent().unwrap().join("_up_").join("server")
    }
}

fn resolve_log_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        let p = PathBuf::from(base)
            .join("ecl-automation-tool")
            .join("logs");
        let _ = fs::create_dir_all(&p);
        return p;
    }

    let p = std::env::temp_dir().join("ecl-automation-tool-logs");
    let _ = fs::create_dir_all(&p);
    p
}

//////////////////////////////////////////////////////////////////
// FastAPI lifecycle
//////////////////////////////////////////////////////////////////
fn setup_python_env(server_dir: &PathBuf) -> Result<PathBuf, String> {
    let venv = server_dir.join("venv");

    if !venv.exists() {
        let status = Command::new("python")
            .args(["-m", "venv", venv.to_str().unwrap()])
            .current_dir(server_dir)
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Failed to create venv".into());
        }
    }

    let python = if cfg!(windows) {
        venv.join("Scripts").join("python.exe")
    } else {
        venv.join("bin").join("python")
    };

    Ok(python)
}

fn start_fastapi(server_dir: &PathBuf, python: &PathBuf) -> Result<std::process::Child, String> {
    let log_dir = resolve_log_dir();

    let stdout = fs::File::create(log_dir.join("fastapi_stdout.log")).unwrap();
    let stderr = fs::File::create(log_dir.join("fastapi_stderr.log")).unwrap();

    let mut args = vec!["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"];
    if cfg!(debug_assertions) {
        args.push("--reload");
    }

    let child = Command::new(python)
        .args(args)
        .current_dir(server_dir)
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(child)
}

#[tauri::command]
fn backend_is_ready() -> bool {
    TcpStream::connect("127.0.0.1:8000").is_ok()
}

//////////////////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////////////////
#[tokio::main]
async fn main() {
    let server_dir = get_server_dir();
    let server_dir_thread = server_dir.clone();

    tauri::Builder::default()
        .manage(FastApiProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            create_folder_tree,
            upload_files,
            list_folder_contents,
            get_folder_contents,
            backend_is_ready
        ])
        .setup(move |app| {
            // 🔥 ENABLE DEVTOOLS (PROD SAFE)
            if should_enable_devtools() {
                if let Some(window) = app.get_window("main") {
                    window.open_devtools();
                    println!("DevTools enabled");
                }
            }

            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                ensure_python312_installed_and_in_path();

                let python = match setup_python_env(&server_dir_thread) {
                    Ok(p) => p,
                    Err(e) => {
                        let _ = app_handle.emit("backend-error", e);
                        return;
                    }
                };

                let child = match start_fastapi(&server_dir_thread, &python) {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = app_handle.emit("backend-error", e);
                        return;
                    }
                };

                let state: tauri::State<FastApiProcess> = app_handle.state();
                *state.0.lock().unwrap() = Some(child);

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
        .expect("error running tauri app");
}
