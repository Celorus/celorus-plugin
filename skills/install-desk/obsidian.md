# The Obsidian settings

The desk folder `celorus/` opens as an Obsidian vault. These files are generated: set-up writes
them, and an update adds any that are missing and leaves a setting the person changed alone.
Write these files only while Obsidian is shut: Obsidian
rewrites its own settings when it closes, over anything written while it was open. Say so to the
person before writing, and wait until they have shut it. Obsidian's own `workspace` files are
kept out of git by the desk's `.gitignore`.

Each file holds exactly the lines of its block below and ends at the closing brace, with no
newline after it. That is the shape Obsidian 1.12 writes itself, and these were read back from
it, so opening the desk on that version leaves the files as they are. One value is our own
choice against Obsidian's: `sync` is off. The desk is the person's own book of people, and
nothing we write switches on a way to copy it anywhere. They can switch it on themselves.

The graph opens on people, families, firms and seats, each kind in its own colour. The three
bookmarks open the other pictures.

## `celorus/.obsidian/app.json`

```json
{
  "useMarkdownLinks": false,
  "newLinkFormat": "shortest",
  "alwaysUpdateLinks": true
}
```

## `celorus/.obsidian/graph.json`

```json
{
  "collapse-filter": true,
  "search": "[type:person] OR [type:family] OR [type:firm] OR [type:seat]",
  "showTags": false,
  "showAttachments": false,
  "hideUnresolved": true,
  "showOrphans": true,
  "collapse-color-groups": true,
  "colorGroups": [
    {
      "query": "[type:person]",
      "color": {
        "a": 1,
        "rgb": 3900150
      }
    },
    {
      "query": "[type:firm]",
      "color": {
        "a": 1,
        "rgb": 1096065
      }
    },
    {
      "query": "[type:family]",
      "color": {
        "a": 1,
        "rgb": 9133302
      }
    },
    {
      "query": "[type:conversation]",
      "color": {
        "a": 1,
        "rgb": 6583435
      }
    },
    {
      "query": "[type:brief]",
      "color": {
        "a": 1,
        "rgb": 9741240
      }
    },
    {
      "query": "[type:research]",
      "color": {
        "a": 1,
        "rgb": 959977
      }
    },
    {
      "query": "[type:sent]",
      "color": {
        "a": 1,
        "rgb": 15485081
      }
    },
    {
      "query": "[type:learning]",
      "color": {
        "a": 1,
        "rgb": 8702998
      }
    },
    {
      "query": "[type:theme]",
      "color": {
        "a": 1,
        "rgb": 1357990
      }
    },
    {
      "query": "[type:seat]",
      "color": {
        "a": 1,
        "rgb": 16096779
      }
    }
  ],
  "collapse-display": true,
  "showArrow": true,
  "textFadeMultiplier": 0,
  "nodeSizeMultiplier": 1,
  "lineSizeMultiplier": 1,
  "collapse-forces": true,
  "centerStrength": 0.518713248970312,
  "repelStrength": 10,
  "linkStrength": 1,
  "linkDistance": 250,
  "scale": 1,
  "close": false
}
```

## `celorus/.obsidian/core-plugins.json`

```json
{
  "file-explorer": true,
  "global-search": true,
  "switcher": true,
  "graph": true,
  "backlink": true,
  "outgoing-link": true,
  "properties": true,
  "page-preview": true,
  "bookmarks": true,
  "canvas": false,
  "bases": false,
  "daily-notes": false,
  "tag-pane": true,
  "footnotes": false,
  "templates": true,
  "note-composer": true,
  "command-palette": true,
  "slash-command": false,
  "editor-status": true,
  "markdown-importer": false,
  "zk-prefixer": false,
  "random-note": false,
  "outline": true,
  "word-count": true,
  "slides": false,
  "audio-recorder": false,
  "workspaces": false,
  "file-recovery": true,
  "publish": false,
  "sync": false,
  "webviewer": false
}
```

## `celorus/.obsidian/bookmarks.json`

```json
{
  "items": [
    {
      "type": "search",
      "title": "Conversations and who was in them",
      "query": "[type:conversation] OR [type:person] OR [type:seat]"
    },
    {
      "type": "search",
      "title": "What we sent, and to whom",
      "query": "[type:sent] OR [type:firm] OR [type:person] OR [type:family]"
    },
    {
      "type": "search",
      "title": "What we learned",
      "query": "[type:learning] OR [type:theme] OR [type:conversation]"
    }
  ]
}
```
