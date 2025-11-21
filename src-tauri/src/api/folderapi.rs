use std::{fs, path::{Path, PathBuf}};
use tauri::command;
use base64::decode;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FolderContentItem {
    pub name: String,
    pub is_folder: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FolderContents {
    pub items: Vec<FolderContentItem>,
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

/// Returns the base path depending on dev or prod
fn get_base_path() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        // DEV: project root/server/files
        let mut base_path = std::env::current_dir().map_err(|e| e.to_string())?;
        base_path.pop(); // go up from src-tauri
        base_path.push("server");
        base_path.push("files");
        Ok(base_path)
    } else {
        // PROD: executable_dir/_up_/server/files
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_dir = exe.parent().ok_or("Failed to get exe directory")?;
        Ok(exe_dir.join("_up_").join("server").join("files"))
    }
}


#[tauri::command]
pub fn get_folder_contents(relative_path: &str) -> Result<FolderContents, String> {
    let base_path = get_base_path()?;
    let target_path = base_path.join(relative_path);

    if !target_path.exists() {
        return Err(format!("Path '{}' does not exist.", target_path.display()));
    }
    if !target_path.is_dir() {
        return Err(format!("Path '{}' is not a directory.", target_path.display()));
    }

    let mut contents = Vec::new();
    for entry_result in fs::read_dir(&target_path).map_err(|e| e.to_string())? {
        let entry = entry_result.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let is_folder = entry_path.is_dir();
        let name = entry.file_name().into_string().map_err(|_| "Invalid UTF-8 in file name")?;

        if is_folder || name.ends_with(".xls") || name.ends_with(".xlsx") {
            contents.push(FolderContentItem { name, is_folder });
        }
    }

    Ok(FolderContents { items: contents })
}

#[tauri::command]
pub fn create_folder_tree(
    entity: String,
    loan_product: String,
    period: String,
    workflow_name: String,
) -> Result<String, String> {
    let base_path = get_base_path()?;
    let target_path = base_path
        .join(&entity)
        .join(&period)
        .join(&workflow_name)
        .join(&loan_product);

    std::fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
    Ok(format!("✅ Folder created at {:?}", target_path))
}
#[derive(serde::Deserialize)]
pub struct FilePayload {
    pub filename: String,
    pub contents_base64: String,
}

#[tauri::command]
pub fn upload_files(
    entity: String,
    reporting_period: String,
    workflow_name: String,
    files: Vec<FilePayload>,
) -> Result<String, String> {
    let base_path = get_base_path()?;
    let target_folder = base_path.join(&entity).join(&reporting_period).join(&workflow_name);

    fs::create_dir_all(&target_folder).map_err(|e| e.to_string())?;

    for file in files.iter() {
        let decoded_bytes = decode(&file.contents_base64).map_err(|e| e.to_string())?;
        let file_path = target_folder.join(&file.filename);
        fs::write(&file_path, decoded_bytes).map_err(|e| e.to_string())?;
    }

    Ok(format!("Successfully saved {} files", files.len()))
}

#[tauri::command]
pub fn list_folder_contents(folder_path: Option<String>) -> Result<FolderContents, String> {
    let base_path = get_base_path()?;

    let path = if let Some(folder_rel) = folder_path {
        let rel_path = Path::new(&folder_rel);

        // Prevent path traversal outside base_path
        if rel_path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err("Parent directory traversal not allowed".into());
        }

        base_path.join(rel_path)
    } else {
        base_path.clone()
    };

    if !path.exists() {
        return Err(format!("Folder does not exist: {:?}", path));
    }

    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut items = vec![];

    for entry in entries.flatten() {
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().into_string().map_err(|_| "Invalid UTF-8 in file name")?;

        if metadata.is_dir() || name.ends_with(".xls") || name.ends_with(".xlsx") {
            items.push(FolderContentItem {
                name,
                is_folder: metadata.is_dir(),
            });
        }
    }

    Ok(FolderContents { items })
}
