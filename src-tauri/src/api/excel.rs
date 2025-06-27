// src-tauri/src/api/excel.rs
use serde::Serialize;
use calamine::{open_workbook, Reader, Xlsx};
use std::path::PathBuf;
use std::fs;

#[derive(Serialize)]
pub struct ExcelData {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[tauri::command]
pub async fn read_excel_file(file_path: String) -> Result<ExcelData, String> {
    let path = PathBuf::from(file_path);
    
    let mut workbook: Xlsx<_> = open_workbook(&path)
        .map_err(|e| format!("Failed to open Excel file: {}", e))?;

    let worksheet = workbook.worksheet_range_at(0)
        .ok_or("No worksheets found")?
        .map_err(|e| format!("Failed to read worksheet: {}", e))?;

    let mut headers = Vec::new();
    let mut rows = Vec::new();

    for (i, row) in worksheet.rows().enumerate() {
        if i == 0 {
            headers = row.iter()
                .map(|cell| cell.to_string())
                .collect();
        } else {
            rows.push(row.iter()
                .map(|cell| cell.to_string())
                .collect());
        }
    }

    Ok(ExcelData { headers, rows })
}


#[tauri::command]
pub async fn save_temp_file(
    file_name: String,
    contents: Vec<u8>,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(file_name);
    
    fs::write(&file_path, contents)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}