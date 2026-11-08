# Optional offline Piper voices

RaceHubOS keeps its existing browser speech. The default remains the browser's
choice for `speechLocale`, at rate 1.1 and volume 0.9; explicit browser voice
preferences, force/busy behavior, the returned utterance and durations translated
through `locales/<lang>/voice.json` retain main's behavior. Piper is an additional,
explicit voice choice, never an automatic replacement for browser speech.

## Install and remove in Settings

The Offline voices section shows the exact compressed download size for the
current platform and selected languages before installation. The interface language is included by default; additional languages are opt-in checkboxes. Already installed matching voices and the runtime are reused. Adding another language preserves existing voices. Click **Install offline voices** to download
the missing engine components and selected models (German Thorsten, English LJ Speech or French Siwis).
No engine or model is downloaded by application startup, opening Settings, normal
`npm install`, or selecting a voice. The application only reads local status until
that button is clicked. An explicit POST to `/api/voice/install` is the equivalent
API operation; cross-origin mutations are refused.

A background operation verifies every archive (runtime SHA-512 and model SHA-256),
extracts into a separate staging directory without running package install scripts,
and publishes the installation only when complete. Interrupted, truncated,
checksum-invalid or incomplete downloads do not replace an existing installation.
The UI polls local progress; failures remain visible and may be retried.

Installed Piper voices appear beside browser voices in the same selector. Only
Piper voices matching the interface language are offered. The selected voice is
saved per language, like browser voices. Missing voices, local synthesis failure
or playback failure use the original browser speech path, preserving completion
callbacks. Cancellation and language changes discard stale local audio.

Click **Remove offline voices** to stop and await the Node speech worker, then
remove only this managed installation. A saved Piper preference remains readable
and uses browser fallback after removal. Browser voices and preferences are not
removed. Legacy `_piper-auto` / `_piper-thorsten` choices remain understood; old
Python/system Piper installations are neither loaded nor modified.

## Node runtime and platforms

The optional engine is **sherpa-onnx-node 1.13.8**. It is downloaded only on opt-in
into the managed data directory, together with the exact matching prebuilt package
for Windows x64/ia32, macOS x64/arm64 or Linux x64/arm64. Unsupported CPU/platform
combinations keep browser speech and display that no prebuilt engine is available.
No Python, pip, system package manager or compiler is required.

Version 2.0.1 was evaluated with real Piper models and rejected: it removes the
integrated espeak/Piper frontend and requires external phoneme input. Pinning the
last 1.x release retains the tested Node-only phonemization path. Both the wrapper
and native platform archive are pinned with exact integrity and byte size in
`packages/backend/src/data/offlineVoices.json`; npm semver resolution is not used
for this optional runtime. The core app adds only two small JavaScript archive
readers (`tar`, `unbzip2-stream`), not the speech engine or models, to its dependencies.

The speech engine loads in a separate Node process. Native-library paths are set
for each OS before launching it. At most four requests are pending; timeouts,
worker crashes and invalid audio fail to browser fallback. Audio caches are bounded
and keyed by model/text/rate. The worker stops after an idle period and before
installation/removal, so Windows DLL handles are not left open.

## Storage, checksums and licenses

The default managed directory is `offline-voices` beside the configured SQLite
database. `RACEHUBOS_OFFLINE_VOICES_DIR` may select another dedicated directory.
Status checks do not create it. An existing directory without the RaceHubOS
installation marker is never overwritten or recursively removed. No models or
native binaries are committed to Git. Back up this optional directory separately,
or reinstall it after restoring the normal application database.

The manifest pins the official npm archives and the prepared Piper model archives
from [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models).
Model cards, espeak data and package license information remain in the downloaded
installation. Thorsten's model card identifies a CC0 dataset, LJ Speech a public
domain dataset, and Siwis a CC-BY-4.0 dataset; retain their cards and attribution.
sherpa-onnx is Apache-2.0 and its bundled espeak-ng frontend has its own GPL license.
See the [official Node addon examples](https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8/nodejs-addon-examples)
and downloaded packages for the component licenses.

## Verification

Run the normal project rules, backend tests and Piper Playwright tests. Tests use
throwaway databases and fake network/audio; they do not download voices.

For a real, explicitly requested download/synthesis/removal smoke test on any
supported machine:

```sh
node scripts/test-offline-voices.js --install
```

Add `--keep` to retain three WAV files and the temporary model installation for
listening. The test does not play audio, connect to a CU or alter real race data.
It is never run by startup, npm install, or the normal test suite.

Real synthesis has been checked locally on Linux. A path-limited, read-only GitHub
Actions workflow invokes the same explicit smoke test on Windows, macOS and Linux
runners. Its results are reported separately from local tests. Hardware speaker
playback and pronunciation still need listening checks on the target race PC.

## Installation progress and cancellation

Settings shows received MiB, the current archive and the number of archives whose checksums have passed. Downloading, checksum verification, extraction and final installation checks are distinct stages. A 100% download alone does not mean installation is complete. Cancel installation aborts the active download and removes its staging directory; an existing managed installation remains intact. During extraction, cancellation takes effect before proceeding to the next archive or publishing. The short final publication step cannot be cancelled. Installation can be retried afterward.

The existing browser voice list and normal browser preview remain unchanged. The explicit Piper preview cancels a stale speech job, resumes Web Audio during the click (with an audio-element fallback for older browsers) before waiting for synthesis, and reports completion or failure. A failed preview can be retried without reloading Settings.

The install API requires `{ "languages": ["de"] }` (supported values: `de`, `en`, `fr`). GET `/api/voice/status?languages=de` calculates the missing download for that selection without installing anything. The manual smoke script explicitly requests all three languages.
