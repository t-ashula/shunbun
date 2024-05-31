# design

## Basic

- 関数型っぽく
- `Result<T,E> = Success<T> | Failure<F>` でエラー処理する
  - `throw` させない
- 各機能は `FuncInput` をもらって `Promise<Result<FuncOutput, FuncError>>` を返す
- 機能ごとにディレクトリ（パッケージ）として分ける
- 各機能は `const run = async(input:FuncInput): Promise<Result<FuncOutput, FuncError>> => {}` として実装して `export {run}` する
- 使う側は `import { run as func } from "./func/"` とする

- `FuncInput` をどこからもらって `FuncOutput` をどこに渡すかは IO (Loader/Saver) として実装する
  - `io/TARGET.mts` に `const load = async (input: LoaderInput): Promise<Result<LoaderOutput, LoaderError>>` と`const save = async (input: SaverInput): Promise<Result<SaverOutput, SaverError>>` とを実装して `export { load, save }`
  - 使う側は `import { load as loadModel } from "~/io/local/model.mts"`
    - local とか io の場所を切り替えるのは使う側の責務とする
    - `io/model.mts` に自動的に対象を選ぶためのラッパーを作らない
    - `import {load} from "~/io/local/model.mts"`, `import {save} from "~/io/rdb/model.mts`" とかして disk から db にというのもあり？

## TODO

- neverthrow とかでちゃんと関数型に
- isFailure のチェック・早期リターンも極力減らす
- log もっといれる
  - 一方で，result の合成も進めて Failure ごとにログださないようになんとかする
-

## Types

### Channel

チャンネル（配信主体）の情報

object:

- channelId: uuid(string)
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

- 実メディアファイル `${baseDir}/${channelId}/${episodeId}/media/${number}.${ext}`
  - number は複数ファイルになるときの対応
- StoredEpisode
  - meta 情報ファイル `${baseDir}/${channelId}/${episodeId}/stored.json`
    - meta = {
      episodeId: episodeId
      stored: [{storageType, storedKey, storedAt}]
      }

### transcriber

stored episode を受け取って， transcribe api にメディア本体を食わせて，transcribe output を得る
transcribe output -> transcript

### transcribe API

- media 本体を受け取って json で結果を返す http api
  - media: file
  - lang: string
- local での実行でも，sagemaker とか lambda とかに変えられるように http
- モデルの読み込みのオーバーヘッドがそこそこあるので常時起動的にはしたい
- vtt 自体は行志向のデータなのでちょっと扱いがめんどい
- whisper だとちょっと過剰
  - ```ts
    {
      "text":string,
      "segments": {
        "id": number,
        "start": number,
        "end": number,
        "text": string,
        "seek": number,
        "tokens":number[],
        "temperature": number,
      } []
    }
    ```
- ReazonSpeech `reasonspeach-nemo-asr` cli だと，これだけが得られる？
  - ```ts
    {
      "start_seconds":number,
      "end_seconds":number,
      "text":string
    }
    ```
- vtt だと一つ一つのを cue block と呼ぶ
- start/end/text の 3 つがあれば vtt とか他のにもなんともでできる？
  - whisper のをベースに，こうする
  - ```ts
    {
      "text": string,
      "segments": {
        "start": number,
        "end": number,
        "text": string
      } [],
      "stats": Record<string, any>
    }
    ```
  - stats には実推論時間とかそういうのをいれる予約

## local io

- baseDir に対して，channel/episode を掘り，stored/media, script のディレクトリを掘る

- channel : `${baseDir}/${channelId}/channel.json`
- episode : `${baseDir}/${channelId}/${episodeId}/episode.json`
- stored : `${baseDir}/${channelId}/${episodeId}/stored.json`
  - media : `${baseDir}/${channelId}/${episodeId}/media/${number}.${ext}`
- transcript : `${baseDir}/${channelId}/${episodeId}/transcript.json`

### index

- dir 列挙では面倒なので `baseDir/index/${model}.json` に各々の id を列挙したファイルを置きたい

### load channels

- baseDir に対して dir を列挙
- baseDir/${dir}/channel.json がアレば読む
- 基本的には channelId を条件にする

### load episodes

- 基本 channelId でのフィルタリングを前提とし，
- channelId がなければ baseDir に対して dir(channelDirs) を列挙
- 各 channelDir に対して dir (episodeDirs) を列挙
- 各 episodeDir に対して episode.json がアレば読み込む

## ディレクトリ構成とか
