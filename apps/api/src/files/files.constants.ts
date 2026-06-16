export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

// Accepted attachment content types (validated server-side, never trusting the
// client-declared extension alone).
export const ATTACHMENT_MIME_PATTERN =
  /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)))$/;

export const AVATAR_MIME_PATTERN = /^image\/(png|jpeg|gif|webp)$/;
