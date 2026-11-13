import { escapeHtml } from "./dom.js?v=79";

export function renderAttachmentHtml(attachment) {
  if (!attachment || typeof attachment !== "object") return "";
  const mediaId = String(attachment.media_id || "").trim();
  const rawUrl = String(attachment.url || (mediaId ? `/admin/api/interacciones_media.php?media_id=${encodeURIComponent(mediaId)}` : "")).trim();
  const rawDownloadUrl = String(attachment.download_url || (mediaId ? `/admin/api/interacciones_media.php?media_id=${encodeURIComponent(mediaId)}&download=1` : "")).trim();
  if (!rawUrl) return "";

  const viewUrl = escapeHtml(rawUrl);
  const downloadUrl = escapeHtml(rawDownloadUrl || rawUrl);
  const mime = String(attachment.mime || "").toLowerCase();
  const type = String(attachment.type || "").toLowerCase();
  const filename = String(attachment.filename || "archivo_adjunto").trim();
  const safeFilename = escapeHtml(filename);

  const isImage = type === "imagen" || mime.startsWith("image/");
  const isAudio = type === "audio" || mime.startsWith("audio/");
  const isVideo = type === "video" || mime.startsWith("video/");

  if (isImage) {
    return `
      <div class="chat-bubble-attachment chat-attachment-image">
        <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="chat-attachment-img-link" title="Clic para abrir imagen en tamaño completo">
          <img src="${viewUrl}" alt="${safeFilename}" class="chat-attachment-preview-img" loading="lazy">
        </a>
        <div class="chat-attachment-actions">
          <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="chat-attachment-btn">👁️ Ver imagen</a>
          <a href="${downloadUrl}" download="${safeFilename}" class="chat-attachment-btn chat-attachment-btn-download">⬇️ Descargar</a>
        </div>
      </div>
    `;
  }

  if (isAudio) {
    return `
      <div class="chat-bubble-attachment chat-attachment-audio">
        <audio controls preload="none" src="${viewUrl}" class="chat-attachment-audio-player"></audio>
        <div class="chat-attachment-actions">
          <a href="${downloadUrl}" download="${safeFilename}" class="chat-attachment-btn chat-attachment-btn-download">⬇️ Descargar audio</a>
        </div>
      </div>
    `;
  }

  if (isVideo) {
    return `
      <div class="chat-bubble-attachment chat-attachment-video">
        <video controls preload="metadata" src="${viewUrl}" class="chat-attachment-video-player"></video>
        <div class="chat-attachment-actions">
          <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="chat-attachment-btn">👁️ Abrir video</a>
          <a href="${downloadUrl}" download="${safeFilename}" class="chat-attachment-btn chat-attachment-btn-download">⬇️ Descargar</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-bubble-attachment chat-attachment-document">
      <div class="chat-attachment-doc-card">
        <span class="chat-attachment-doc-icon" aria-hidden="true">📄</span>
        <div class="chat-attachment-doc-info">
          <span class="chat-attachment-doc-name">${safeFilename}</span>
          <span class="chat-attachment-doc-meta">${escapeHtml(mime === "application/pdf" ? "Documento PDF" : "Archivo adjunto")}</span>
        </div>
      </div>
      <div class="chat-attachment-actions">
        <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="chat-attachment-btn">👁️ Ver / Abrir</a>
        <a href="${downloadUrl}" download="${safeFilename}" class="chat-attachment-btn chat-attachment-btn-download">⬇️ Descargar</a>
      </div>
    </div>
  `;
}
