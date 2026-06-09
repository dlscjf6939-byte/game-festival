const API_BASE = 'http://121.254.240.93:8090';

export function toProfileImageUri(profileImageUrl: string): string {
  const trimmedUrl = profileImageUrl.trim();

  if (/^(https?:|file:|data:)/i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  if (trimmedUrl.startsWith('/')) {
    return `${API_BASE}${trimmedUrl}`;
  }

  return `${API_BASE}/${trimmedUrl.replace(/^\/+/, '')}`;
}

export function getProfileImageUriFromRecord(record: Record<string, unknown> | null | undefined): string | null {
  const profileImageUrl =
    typeof record?.profileImageUrl === 'string' && record.profileImageUrl.trim()
      ? record.profileImageUrl
      : null;
  const profileImageUri =
    typeof record?.profileImageUri === 'string' && record.profileImageUri.trim()
      ? record.profileImageUri
      : null;

  if (profileImageUrl) {
    return toProfileImageUri(profileImageUrl);
  }

  if (profileImageUri) {
    return toProfileImageUri(profileImageUri);
  }

  return null;
}
