# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-09-22

### Added
- Profile management: `add`, `list`, `remove`
- SSH support: generate or import a key per profile, host aliasing
- HTTPS support: credential-helper-backed token storage, verified on save
- `use`/`current` — global identity switching with live GitHub verification
- `pin` — lock a repo's identity and remote to a profile, independent of global switches
- `link`/`unlink`/`links` — automatic per-folder identity, SSH key, and credential binding via `includeIf`
- Commit-time guard hook, auto-installed by `pin`
- `doctor` — audits a folder tree for unpinned, unguarded, or mismatched repos
- Interactive welcome dashboard on bare `gitsw`