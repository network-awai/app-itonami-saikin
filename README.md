# app-itonami-saikin — Saikin

細菌 — 水平伝達の層です。場所ごとに環境を調べ（probe）、そこで集落（colony）を作り、集落の間で信号を水平に移し（transfer）、Ki に渡せる形にまとめます。溶菌（lyse）した集落は信号を放出して止まります。

Tauri **3.0.0-alpha.6** の独立 app（`tauri-runtime-wry`、OS の WebView）と、同じファイルの static Web ビルドです。記録はすべてこの端末の中（localStorage、key `itonami.saikin.v1`）に保存し、外部へは通信しません。外部操作の宣言もありません（`dist/descriptor.json` の `operations: []`）。保存に失敗したときは画面に表示します。

## できること

| 操作 | 内容 |
| --- | --- |
| 環境を調べる (probeEnvironment) | 信号は改行かカンマで区切ります。 |
| 集落を作る (formColony) | その場所で調べた信号を持って始まります。先に probe が必要です。 |
| 信号を移す (transferSignal) | — |
| Ki に渡す形にする (handoffToKi) | Ki の absorb 入力の形を表示するだけで、どこにも送りません。 |
| 溶菌させる (lyse) | — |

記録（collection）: `cloud.itonami.apps.saikin.colony`、`cloud.itonami.apps.saikin.probe`、`cloud.itonami.apps.saikin.transfer`

## 補足

- **この domain は新しく設計したものです。** 旧 Worker は処理を外部の AgentGateway / LangServer に転送していて、処理の中身はこの repository にありませんでした。旧 Worker の method 名・README・BPMN をもとに、この端末だけで動く domain を作りました。旧サービスと同じ挙動である保証はありません。
- 「Ki に渡す形にする」は Ki の absorb 入力の形を画面に出すだけで、どこにも送りません。app 同士は直接つながっていません。
- 旧 `cljs/`（UI）は残しています。

## 構成

| パス | 役割 |
| --- | --- |
| `src/domain/` | domain logic（TypeScript）。ビルド時に Node の type stripping で JS にします（bundler・依存なし） |
| `src/local-store.js` | この端末内の record store。domain が使う `read` / `write` を localStorage で実装 |
| `src/app-def.js` | 画面の操作と domain 関数・collection の対応 |
| `src/ui/` | 依存なしの UI。DOM はテキストノードだけで組み、HTML 文字列を使いません（CSP `style-src 'self'`） |
| `vendor/` | kotoba-lang/kotoba の `kotoba-client-runtime.js` / consent CSS と `PINS.json`。`scripts/build.mjs` が digest のずれで失敗します |
| `src-tauri/` | Tauri v3 host。read-only command は `awai_host_info` の 1 つだけ。filesystem・network・shell・installer 権限なし |
| `cljs/` | 旧 ClojureScript UI（amu でビルド）。この app のビルド・テストでは使いません |

## コマンド

```sh
npm ci
npm test              # build してから domain と local-only のテスト（local-only.test.mjs, saikin.test.ts）
npm run build         # dist/ と SHA-256 の release.json
npm run build:desktop # native desktop 実行ファイル（bundle・署名なし）
```

## 状態と制限（AWAI-3079, 2026-11-17）

- 旧構成（Cloudflare Worker の XRPC dispatcher / adapter、`wrangler.jsonc`、`@etzhayyim/sdk`）は削除しました。履歴は git にあります。
- 検証済み: `npm test`、`npm run build`、`cargo check`（Tauri 3.0.0-alpha.6）。
- 未検証: native window の起動、`tauri build`、Android、署名、配布。アイコンは app-soshiki の仮アイコンです。
