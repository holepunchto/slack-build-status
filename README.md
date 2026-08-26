# slack-build-status

GitHub Actions for posting and updating build status messages in Slack. Creates a rich message with grouped build statuses, changelogs, and emoji indicators — then updates individual builds as they complete.

## Actions

### `create`

Post an initial build status message.

| Input | Required | Example | Description |
|---|---|---|---|
| `token` | yes | `xoxb-1234567890-1234567890123-abc` | Slack Bot OAuth token |
| `channel-id` | yes | `C0123456789` | Slack channel ID |
| `builds` | yes | `[{"name":"apk","label":"APK","group":"Android","status":"running"}]` | JSON array of builds: `{name, label, group, status?, link?}` |
| `version` | yes | `1.2.3` | Build version string |
| `branch` | no | `main` | Git branch name. Rendered as `version (branch)` in the header; omit it and the header is just `version` |
| `git-url` | yes | `https://github.com/owner/repo/tree/main` | URL to the git commit/branch |
| `changelog-from` | no | `v1.0.0` | Git ref to generate changelog from (auto-generates changelog and compare URL) |
| `changelog` | no | `• 91a4e0548 - feat: add login (#1)` | Manual changelog text, overrides `changelog-from` (`#N` and `(#N)` are auto-linked) |
| `changelog-compare-url` | no | `https://github.com/owner/repo/compare/v1.0.0...v1.1.0` | Manual compare URL, overrides auto-generated one |
| `changelog-in-thread` | no | `true` | Post the changelog as a thread reply instead of the message body |
| `icon` | no | `:app-icon:` | Icon emoji to prepend to header |
| `extra-badges` | no | `:badge-staging:` | Additional badge emojis for the header |
| `thread-replies` | no | `[{"text":"Version check: OK"}]` | JSON array of thread replies |
| `notify-users` | no | `<@U0123> <@U0456>` | Slack user mentions to CC in thread |
| `repo` | no | `owner/repo` | GitHub repo for PR link detection (defaults to current) |

| Output | Description |
|---|---|
| `ts` | Slack message timestamp (pass to `update`/`cancel-all`/`upload`) |

### `update`

Update a specific build's status in an existing message.

| Input | Required | Example | Description |
|---|---|---|---|
| `token` | yes | `xoxb-1234567890-1234567890123-abc` | Slack Bot OAuth token |
| `channel-id` | yes | `C0123456789` | Slack channel ID |
| `ts` | yes | `1234567890.123456` | Message timestamp from `create` |
| `build-name` | yes | `apk` | Build name to update (must match `name` from `create`) |
| `status` | yes | `success` | New status: `success`, `failure`, `cancelled`, `skipped`, or GitHub `job.status` |
| `link` | no | `https://example.com/download/app.apk` | URL to attach (e.g. artifact download link) |
| `file-path` | no | `build/outputs/app.apk` | File to upload to thread and link to this build |
| `also-update` | no | `[{"name":"aab","status":"running"}]` | JSON array of additional updates: `{name, status, link?}` |

### `cancel-all`

Mark all pending/running builds as cancelled.

| Input | Required | Example | Description |
|---|---|---|---|
| `token` | yes | `xoxb-1234567890-1234567890123-abc` | Slack Bot OAuth token |
| `channel-id` | yes | `C0123456789` | Slack channel ID |
| `ts` | yes | `1234567890.123456` | Message timestamp from `create` |

### `upload`

Upload a file to the message thread.

| Input | Required | Example | Description |
|---|---|---|---|
| `token` | yes | `xoxb-1234567890-1234567890123-abc` | Slack Bot OAuth token |
| `channel-id` | yes | `C0123456789` | Slack channel ID |
| `ts` | yes | `1234567890.123456` | Message thread timestamp |
| `file-path` | yes | `build/outputs/app.apk` | Path to the file to upload |
| `filename` | no | `app-v1.2.3.apk` | Override filename (defaults to basename) |

| Output | Description |
|---|---|
| `file-url` | Permalink URL of the uploaded file |
| `file-id` | Slack file ID |

## Changelog

Pass `changelog-from` with a git ref (e.g. a previous release tag) and the action generates the changelog automatically — no external actions needed. Each commit becomes a linked entry like `• 91a4e054 - fix: crash (#123)` with PR references auto-linked.

You can also pass `changelog` directly to provide manual changelog text. PR references (`#123` and `(#123)`) are auto-linked in both cases.

By default the changelog renders in the message body. Set `changelog-in-thread: true` to post it as a thread reply instead, keeping the main message compact — the format is unchanged.

## Workflow example

```yaml
jobs:
  start:
    runs-on: ubuntu-latest
    outputs:
      ts: ${{ steps.slack.outputs.ts }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: holepunchto/slack-build-status/create@v1
        id: slack
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          version: 1.2.3-42
          branch: main
          git-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          icon: ':app-icon:'
          builds: |
            [
              {"name": "apk", "label": "APK", "group": "Android", "status": "running"},
              {"name": "aab", "label": "AAB", "group": "Android"},
              {"name": "ios", "label": "Testflight", "group": "iOS"}
            ]
          changelog-from: v1.0.0
          thread-replies: |
            [{"text": "Version check: ..."}]
          notify-users: '<@U0123> <@U0456>'

  build-apk:
    needs: start
    runs-on: ubuntu-latest
    steps:
      - run: echo "building..."

      - uses: holepunchto/slack-build-status/update@v1
        if: always()
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          ts: ${{ needs.start.outputs.ts }}
          build-name: apk
          status: ${{ job.status }}
          link: https://example.com/download/apk

      - uses: holepunchto/slack-build-status/upload@v1
        if: success()
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          ts: ${{ needs.start.outputs.ts }}
          file-path: build/outputs/app.apk

  build-ios:
    needs: start
    runs-on: macos-latest
    steps:
      - run: echo "building..."

      - uses: holepunchto/slack-build-status/update@v1
        if: always()
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          ts: ${{ needs.start.outputs.ts }}
          build-name: ios
          status: ${{ job.status }}

      - uses: holepunchto/slack-build-status/upload@v1
        if: success()
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          ts: ${{ needs.start.outputs.ts }}
          file-path: build/outputs/app.ipa

  on-cancel:
    needs: [start, build-apk, build-ios]
    if: cancelled()
    runs-on: ubuntu-latest
    steps:
      - uses: holepunchto/slack-build-status/cancel-all@v1
        with:
          token: ${{ secrets.SLACK_TOKEN }}
          channel-id: C0123456789
          ts: ${{ needs.start.outputs.ts }}
```

## Setup

### Slack app

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add Bot Token Scopes: `chat:write`, `files:write`, `channels:history`
3. Install to workspace and copy the Bot OAuth token
4. Add the bot to the target channel
5. Store the token as a GitHub secret (`SLACK_TOKEN`)

### Custom emoji

The actions use custom emoji for build statuses. Upload these to your Slack workspace:

- `:ga-pending:` — pending/queued
- `:ga-running:` — in progress
- `:ga-success:` — succeeded
- `:ga-failed:` — failed
- `:ga-cancelled:` — cancelled
- `:ga-skipped:` — skipped

## Development

```sh
npm install         # install dependencies
npm test            # run tests
npm run typecheck   # type-check with tsc
npm run lint        # lint with Biome
npm run format      # format with Biome
npm run check       # lint + format with Biome (auto-fix)
npm run build       # bundle actions into dist/
```

`dist/` is gitignored on `main`.

## Releasing

Run the [release workflow](.github/workflows/release.yml) by hand, choosing a
`patch`/`minor`/`major` bump (or passing an exact `version`). It tests, builds,
commits the bundles onto the tip of the `v1` branch, tags that commit `vX.Y.Z`
and publishes a GitHub release with generated notes. The next version is derived
from the newest existing tag, and a version that is already tagged is refused.

Each release commit carries `main`'s tree and has two parents: the previous
release, so `git log v1 --first-parent` reads as the release history and every
tagged release stays on the branch, and the `main` commit being released, so the
generated notes still list what landed since the last one.

Consumers pin the released commit, never a moving ref, and name the version so
the pin can be read at a glance:

```yaml
uses: holepunchto/slack-build-status/create@<sha> # v1.2.3
```

The workflow prints that exact line in its job summary. `v1` stays a branch
rather than a tag, so the sha a caller pinned last release keeps resolving.
