/**
 * Download a blob: in Tauri app uses native save dialog + save_download_file;
 * in browser triggers a programmatic download via a temporary link.
 */
export async function downloadBlobWithTauri(blob: Blob, filename: string): Promise<void> {
  const w = window as Window & { __TAURI__?: unknown };
  if (w.__TAURI__) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    let defaultPath: string = filename;
    try {
      const { downloadDir } = await import("@tauri-apps/api/path");
      const dir = await downloadDir();
      defaultPath = `${dir}/${filename}`;
    } catch {
      // keep filename only if path API fails
    }
    // Show the Save dialog *before* converting the blob (large exports can take time / memory).
    const path = await save({ defaultPath });
    if (!path) return;

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_download_file", { path, base64Content: base64 });
  } else {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }
}
