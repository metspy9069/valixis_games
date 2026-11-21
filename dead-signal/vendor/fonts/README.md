# Vendored fonts

Self-hosted so the game makes no third-party requests and still renders the
same type offline. Subsets are Latin only.

| File | Family | Weight | License |
| --- | --- | --- | --- |
| `bebas-neue-400.woff2` | Bebas Neue | 400 | SIL Open Font License 1.1 |
| `barlow-400.woff2` | Barlow | 400 | SIL Open Font License 1.1 |
| `barlow-600.woff2` | Barlow | 600 | SIL Open Font License 1.1 |
| `jetbrains-mono-var.woff2` | JetBrains Mono (variable) | 100–800 | SIL Open Font License 1.1 |

All four families are published on Google Fonts under the SIL Open Font
License 1.1, which permits bundling and redistribution with the game.
`index.html` declares them with `@font-face` and falls back to the system UI
fonts if a file fails to load.
