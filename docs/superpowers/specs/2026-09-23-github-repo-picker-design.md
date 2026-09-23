# GitHub repo picker for first project

## Goal

Reduce the work of adding a first project during onboarding without changing the optional step or the verified project-create path.

## Flow

On the Project step, load up to 100 recently updated public repositories owned by the connected GitHub identity. Show a searchable list above the existing form. Selecting a repo fills the title, description, primary language, and canonical GitHub URL; builders can edit every field. A repo without a description still needs one before submission. The manual form and Skip action remain available if loading fails, the repo is not listed, or the builder has an organization repo.

## Data and safety

An authenticated `GET /api/github/repos` route reads the live Supabase GitHub identity, not a username supplied by the browser. It uses the server-side `GITHUB_TOKEN` to request GitHub's public user-repo list, filters forks, archived and disabled repos, and returns only fields needed for the picker. Where the OAuth identity has GitHub's numeric ID, the route only accepts repos whose owner ID matches it. The route never returns tokens or private-repo details. Project submission continues through `POST /api/projects` so verification and quality scoring run unchanged. No schema changes are needed.

## Failure handling and verification

An unavailable GitHub API shows a short inline message and leaves the manual fields usable. Tests cover auth, public-only filtering, missing metadata, provider errors, and form prefill. Run the full test suite, TypeScript, source lint, and the Cloudflare build before deployment.
