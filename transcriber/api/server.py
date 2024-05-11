import os
import uuid
import torch
import time
from transformers import pipeline

from flask import Flask, jsonify, request

app = Flask(__name__)

app.config["UPLOAD_DIR"] = "./tmp/trans"
app.json.ensure_ascii = False


def init_kotoba_whisper():
    # config
    model_id = "kotoba-tech/kotoba-whisper-v1.1"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    model_kwargs = {"attn_implementation": "sdpa"} if torch.cuda.is_available() else {}
    # load model
    pipe = pipeline(
        model=model_id,
        torch_dtype=torch_dtype,
        device=device,
        model_kwargs=model_kwargs,
        chunk_length_s=15,
        batch_size=16,
        trust_remote_code=True,
        stable_ts=True,
        punctuator=True,
    )
    return pipe


@app.route("/transcribe", methods=["GET", "POST"])
def transcribe():
    if app.config.get("KOTOBA_PIPELINE") is None:
        app.config["KOTOBA_PIPELINE"] = init_kotoba_whisper()

    if request.method != "POST":
        return """
        <!doctype html>
        <title>Upload new File</title>
        <h1>Upload new File</h1>
        <form method=post enctype=multipart/form-data>
        <input type=file name=media />
        <input type=text name=lang value=ja />
        <input type=submit value=Upload>
        </form>
        """

    def bad_req(msg: str):
        return jsonify({"error": msg}), 400

    # check if the post request has the file part
    if "media" not in request.files:
        return bad_req("no media file")

    media = request.files["media"]
    if media and media.filename == "":
        return bad_req("no media file")

    lang = request.form.get("lang", "ja")

    filename = os.path.join(app.config["UPLOAD_DIR"], str(uuid.uuid4()))
    media.save(filename)
    pipe = app.config["KOTOBA_PIPELINE"]
    generate_kwargs = {"language": "japanese", "task": "transcribe"}  # TODO: language
    start_time = time.time()
    # 処理時間を計測
    result = pipe(filename, return_timestamps=True, generate_kwargs=generate_kwargs)
    duration = time.time() - start_time
    try:
        os.remove(filename)
    except:
        pass
    segments = list(
        map(
            lambda c: {
                "start": c["timestamp"][0],
                "end": c["timestamp"][1],
                "text": c["text"],
            },
            result["chunks"],
        )
    )
    return jsonify(
        {
            "text": result["text"],
            "file": filename,
            "lang": lang,
            "original": media.filename,
            "segments": segments,
            "duration": duration,
        }
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 9000))
    app.run(debug=True, host="0.0.0.0", port=port)
