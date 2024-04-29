# design

## Basic

- 関数型っぽく
- `Result<T,E> = Success<T> | Failure<F>` でエラー処理する
  - `throw` させない
- 各機能は `FuncInput` をもらって `Result<FuncOutput, FuncError>` もしくは `Promise<Result<FuncOutput, FuncError>>` を返す
- 機能ごとにディレクトリ（パッケージ）として分ける
- 各機能は `const run = async(input:FuncInput): Promise<Result<FuncOutput, FuncError>> => {}` として実装して `export {run}` する
- 使う側は `import { run as func } from "./func/"` とする

- `FuncInput` をどこからもらって `FuncOutput` をどこに渡すかは IO (Loader/Saver) として実装する
- `loader/FUNC/TARGET.mts`, `saver/FUNC/TARGET.mts`

## Types

### Channel

チャンネル（配信主体）の情報

object:

- id: uuid(string)
  - id
- name: string
  - name
- crawlURL: url(string)
  - crawl target for machine．rss feed, youtube/@user, etc
- mediaURL: url(string)
  - media web page for human. https://example.com/podcast/ etc

notes

- crawlURL vs. mediaURL
  - クロールだけ考えるなら crawlURL があれば良い．
  - mediaURL は crawlURL から抽出できる
    - RSS なら channel.link でよいし， scraping 前提なら mediaURL = crawlURL
  - メディア登録の観点で見ると rss の url を人手で抽出してどうにかするのは面倒
    - 補助ツールとして とにかく与えられた url から crawl/media を相互に抽出するようなものがあればいい？
  - メディア管理としても，rss をブラウザで開いたところで意味がないので人が見る用のページはほしい

### Episode

チャンネルから取り出した記録する主体

- id: ulid(string)
  - crawler で取り出したときに割り当てる
- title: string
  - episode title
- description: string
  - rss.channel.item description
- published_at: datetime
  - pubDate
- start_at?: datetime
  - live broadcast start at
- end_at?: datetime
  - live broadcast end at
- streaming: StreamingType(string)
  - クロールしてきて決めたレコーディング方法
- channel_id: uuid(string)
  - channel の id

### StreamingType

enum: static, stream, live

- episode がどう配信されてるか
- podcast であれば，ファイルとして出来上がってるので static
- live と stream の違いは，開始と終了の時間が決まってるかどうか
  - stream: hls で流れてるのを記録する
  - live: stream のうち，特定の時間に録画開始して特定の時間に終了する必要があるもの radiko とか

## Functions

### loader/saver

- loader

  - 各機能への input に必要な情報を何処かから持ってきて input の配列で返す

- saver
  - 各機能からの output の配列を受け取って何処かに置く
  - loader との対比から 配列を受け取っているが，すでに output の中が配列になってるなら複雑になりすぎでは？

### crawler

channel を受け取って episode の配列を返す

```ts
type CrawlerInput = {
  channel: Channel;
};
```

```ts
type CrawlerOutput = {
  channel: Channel;
  episodes: Episode[];
};
```

### recordTaskMaker

episode を受け取って，recording Task にする

### recorder

### transcriber

### transcribe API
