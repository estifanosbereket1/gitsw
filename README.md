# gitsw

Switch safely between multiple GitHub accounts without mixing up commits, SSH keys, or credentials.

If you juggle a personal GitHub account and one or more work accounts, `gitsw` makes sure the right identity, SSH key, and credential are used automatically  and warns or blocks you before a mistake happens, not after.

## The problem

GitHub doesn't care what `git config user.name` says. It identifies you by:
- **which SSH key** connected, or
- **which token** was sent (HTTPS)

Changing your name and email in `.gitconfig` doesn't change either of those  so it's entirely possible to *look* like you're on the right account and still push under the wrong one. `gitsw` manages all three layers together: identity, SSH keys, and credentials.

## How it works

- **SSH key aliasing**  each profile gets its own SSH key and a `Host` alias in `~/.ssh/config` (e.g. `github.com-work`). A repo's remote (`git@github.com-work:org/repo.git`) pins it to that key permanently.
- **Local overrides global**  `gitsw pin` sets `user.name`/`user.email` in a repo's own `.git/config`, which git always prefers over `~/.gitconfig`. Once pinned, a repo's identity can't drift even if you switch accounts globally elsewhere.
- **Credential-per-username (HTTPS)**  tokens are stored via git's own credential helper, keyed by username, never by `gitsw` itself. Remote URLs embed the username (`https://user@github.com/...`) so the helper never has to guess which token to send.
- **Folder auto-linking**  `gitsw link <alias> <path>` writes a git `includeIf` block so *any* repo created under that folder  even before you've run any `gitsw` command in it  automatically gets the right identity, SSH key, and credential username.
- **Commit guard**  `gitsw pin` installs a `pre-commit` hook that blocks a commit if the active identity doesn't match what the repo is pinned to, as a last line of defense.

`gitsw` never stores private keys or tokens itself  only paths, aliases, and usernames. Keys live in `~/.ssh`; tokens live in your OS credential helper.

## Install

Requires Node 18+ and git.

```bash
git clone <your-repo-url>
cd gitswitcher
npm install
npm run build
npm link
```

`npm link` makes the `gitsw` command available globally. After any future code change, re-run `npm run build` for the global command to reflect it.

## Quick start

```bash
gitsw add                     # add an account (SSH or HTTPS)
gitsw use                     # switch the global default (interactive picker)
gitsw current                 # confirm which account is actually authenticating
gitsw pin work                # lock the current repo to "work", regardless of future switches
gitsw link work ~/work        # auto-apply "work" to every repo under ~/work, even unpinned ones
gitsw doctor ~/projects       # audit every repo under a folder for mismatches or gaps
```

Running `gitsw` with no arguments shows a dashboard: active profile, and  if you're inside a repo  that repo's protection status.

## Commands

| Command | Description |
|---|---|
| `gitsw add` | Add a new account profile (name, email, SSH key or HTTPS token) |
| `gitsw list` | List saved profiles |
| `gitsw remove <alias>` | Remove a profile (and its stored credential, if HTTPS) |
| `gitsw use [alias]` | Switch the global default identity; interactive picker if no alias given |
| `gitsw current` / `whoami` | Show the active profile, verified live against GitHub |
| `gitsw pin <alias> [--identity-only]` | Lock the current repo's identity (and remote, unless `--identity-only`) to a profile |
| `gitsw link <alias> <path>` | Auto-apply a profile to every repo under a folder |
| `gitsw unlink <path>` | Remove a folder link |
| `gitsw links` | List all folder → profile links |
| `gitsw doctor [path]` | Scan a folder tree for repos with missing pins, guards, or identity mismatches |
| `gitsw guard install` | Manually install the commit guard hook in the current repo |

## Security model

- Profile metadata (alias, name, email, key path, GitHub username) is stored at `~/.gitswitcher/profiles.json`.
- SSH private keys are never generated or stored anywhere but `~/.ssh`  `gitsw` either generates a key there directly or references one you already have.
- HTTPS tokens are handed to `git credential approve` and stored by whatever credential helper you have configured (OS keychain, `git-credential-manager`, or `credential.helper store`, which is plaintext at `~/.git-credentials`  `gitsw` will tell you which one you're using and ask before configuring `store` on your behalf).
- Files `gitsw` edits (`~/.ssh/config`, `~/.gitconfig`) are only ever modified inside clearly marked, tool-generated blocks  anything you've added by hand outside those markers is left untouched, and a `.bak` copy is made before every write.

## Troubleshooting

**`gitsw` behaves like an old version after editing code.** The global command runs the compiled `dist/`, not `src/`. Run `npm run build` after any change.

**`ssh -T git@github.com` "fails" but shows the right greeting.** GitHub always refuses shell access over SSH, so the command exits non-zero on success too  the real signal is the `Hi <username>!` line, which `gitsw current` checks for you.

**A profile's SSH branch does nothing on `use`.** This means the profile has no `ssh` key on record (usually from a schema change or a partial add). Recreate it: `gitsw remove <alias> && gitsw add`.

## License

MIT