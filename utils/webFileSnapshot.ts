// iOS Safari has a known WebKit bug: a File handed back from an
// <input type="file"> picker — especially one sourced from the Photos app,
// which can be backed by an iCloud/file-provider reference rather than fully
// local data — silently uploads as 0 bytes if there's any delay between
// picking it and actually reading its bytes into a network request. Any flow
// that shows a preview/review step before the real upload (chat's attachment
// preview, a selfie/ID confirm screen, a "submit this form later" delete-
// profile photo) hits exactly that gap.
//
// Reading the file's bytes into memory immediately after picking — while the
// handle is still fresh — and rewrapping them as a plain in-memory File
// sidesteps the staleness entirely: the returned File is backed by an
// ArrayBuffer already resident in JS memory, not by whatever transient
// resource the OS/browser originally pointed at.
export async function snapshotWebFile(file: File): Promise<File> {
  try {
    const buffer = await file.arrayBuffer()
    return new File([buffer], file.name, { type: file.type })
  } catch {
    // Snapshot failed (e.g. the file was already unreadable) — fall back to
    // the original reference rather than dropping the pick entirely.
    return file
  }
}
