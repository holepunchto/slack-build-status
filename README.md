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
| `branch` | yes | `main` | Git branch name |
| `git-url` | yes | `https://github.com/owner/repo/tree/main` | URL to the git commit/branch |
| `changelog` | no | `- feat: add login (#1)\n- fix: crash (#2)` | Changelog text (`(#123)` references are auto-linked) |
| `changelog-compare-url` | no | `https://github.com/owner/repo/compare/v1.0.0...v1.1.0` | URL for the changelog compare link header |
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

You don't need external changelog or markdown-conversion actions. A simple `git log` produces `- commit message (#123)` lines that work directly — the `create` action's built-in `detectPrLinks()` auto-links PR references like `(#123)` to GitHub, and Slack messages use plain text so no markdown-to-mrkdwn conversion is needed.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- name: Generate changelog
  id: changelog
  env:
    PREV_TAG: ${{ steps.env-setup.outputs.PREV_RELEASE_TAG }}
  run: |
    if git rev-parse "$PREV_TAG" >/dev/null 2>&1; then
      text=$(git log --pretty=format:'- %s' "$PREV_TAG"..HEAD)
      compare_url="${{ github.server_url }}/${{ github.repository }}/compare/${PREV_TAG}...${{ github.sha }}"
    else
      text=$(git log --pretty=format:'- %s' -20)
      compare_url=""
    fi
    {
      echo 'text<<EOF'
      echo "$text"
      echo 'EOF'
      echo "compare_url=$compare_url"
    } >> "$GITHUB_OUTPUT"
```

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

      - name: Generate changelog
        id: changelog
        env:
          PREV_TAG: ${{ steps.env-setup.outputs.PREV_RELEASE_TAG }}
        run: |
          if git rev-parse "$PREV_TAG" >/dev/null 2>&1; then
            text=$(git log --pretty=format:'- %s' "$PREV_TAG"..HEAD)
            compare_url="${{ github.server_url }}/${{ github.repository }}/compare/${PREV_TAG}...${{ github.sha }}"
          else
            text=$(git log --pretty=format:'- %s' -20)
            compare_url=""
          fi
          {
            echo 'text<<EOF'
            echo "$text"
            echo 'EOF'
            echo "compare_url=$compare_url"
          } >> "$GITHUB_OUTPUT"

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
          changelog: ${{ steps.changelog.outputs.text }}
          changelog-compare-url: ${{ steps.changelog.outputs.compare_url }}
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

`dist/` is gitignored on `main`. A [release workflow](.github/workflows/release.yml) builds and force-pushes bundles to the `v1` branch on every push to `main`. Consumers reference `@v1`.
