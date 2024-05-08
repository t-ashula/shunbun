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
- theirId
  - guid とか rss 側のデータから生成した id
- title: string
  - episode title
- description: string
  - rss.channel.item description
- publishedAt: datetime
  - pubDate
- startAt?: datetime
  - live broadcast start at
- endAt?: datetime
  - live broadcast end at
- streaming: StreamingType(string)
  - クロールしてきて決めたレコーディング方法
- channelId: uuid(string)
  - channel の id

### StreamingType

enum: static, stream, live

- episode がどう配信されてるか
- podcast であれば，ファイルとして出来上がってるので static
- live と stream の違いは，開始と終了の時間が決まってるかどうか
  - stream: hls で流れてるのを記録する
  - live: stream のうち，特定の時間に録画開始して特定の時間に終了する必要があるもの radiko とか

## Functions

### IO (loader/saver)

- loader
  - 各機能への input に必要な情報を何処かから持ってきて input で返す
- saver
  - 各機能からの output を受け取って何処かに置く
- それぞれに複数読み取り，複数書き込みを前提で作る
  - load は 対象の配列か，発生したエラーを返す
  - save は 個々のデータの書き込みの結果 (Result) の配列と，エラーが発生したかどうかと，あるいは書き込みのための前提条件の失敗を Failure で返す
    - save は書き込み先が DB のように transaction を扱えるならば all or nothing にできるが， sqs とかだとそうはできないので

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

### extractor

channel と crawlURL をダウンロードした結果受け取って episode の配列を返す

### recordTaskMaker

episode を受け取って，recording Task にする

### recorder

recorder は自身の制御範囲内のストレージ (disk) に episode をダウンロード（レコーディング）して StoredEpisode にする
recorder を動かす環境には十分なスペースのストレージがあることを前提とする

- StoredEpisode
  - 実メディアファイル `${baseDir}/media/${channelId}/${episodeId}/${number}.${ext}`
    - number は複数ファイルになるときの対応
  - meta 情報ファイル `${baseDir}/media/${channelId}/${episodeId}/meta.json`
    - meta = {
      episode: episode,
      stored: [{storageType, storedKey, storedAt}]
      }

### transcriber

### transcribe API
