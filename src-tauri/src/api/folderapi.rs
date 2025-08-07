use std::fs;
use std::path::PathBuf;
use tauri::command;
use base64::decode;


#[tauri::command]
pub fn create_folder_tree(entity: String, period: String, workflowName: String) -> Result<String, String> {
    // Your folder creation logic
    let mut base_path = std::env::current_dir().map_err(|e| e.to_string())?;
    base_path.push("../server/files");

    let target_path = base_path.join(&entity).join(&period).join(&workflowName);
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
    period: String,
    workflow_name: String,
    files: Vec<FilePayload>,
) -> Result<String, String> {
    // base path
    let mut base_path = std::env::current_dir().map_err(|e| e.to_string())?;
    base_path.push("../server/files");

    // build full folder path: e.g. BanKo/Annually/banko1
    let target_folder = base_path.join(&entity).join(&period).join(&workflow_name);

    // create directory if not exist
    fs::create_dir_all(&target_folder).map_err(|e| e.to_string())?;

    for file in files.iter() {
        let decoded_bytes = decode(&file.contents_base64).map_err(|e| e.to_string())?;

        let mut file_path = PathBuf::from(&target_folder);
        file_path.push(&file.filename);

        fs::write(&file_path, decoded_bytes).map_err(|e| e.to_string())?;
    }

    Ok(format!("Successfully saved {} files", files.len()))
}
