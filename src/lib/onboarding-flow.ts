/** Dashboard repair visits are distinct from new-user GitHub OAuth returns to step 2. */
export function isGithubRecovery(params: Pick<URLSearchParams, "get">): boolean {
  return params.get("step") === "2" && params.get("mode") === "recovery";
}

export function getGithubReturnPath(isRecovery: boolean): string {
  return isRecovery
    ? "/auth/profile-setup?step=2&mode=recovery"
    : "/auth/profile-setup?step=2";
}
