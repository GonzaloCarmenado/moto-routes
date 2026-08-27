/** Resultado de comprobar si hay una versión más reciente publicada que la instalada. */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  downloadUrl: string | null;
}

/** Subconjunto de la respuesta real de `GET /repos/{owner}/{repo}/releases/latest` de GitHub que usa este dominio. */
export interface GithubLatestRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}
