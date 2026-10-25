# Optional offline Piper speech

Piper is optional. RaceHubOS continues to work with browser speech when it is absent. This feature adds no npm dependency, schema migration, application-start download or system service. The Python runtime and large ONNX models stay outside the Git repository and are installed separately.

## Voices and language selection

The package includes German **Thorsten** (`de_DE-thorsten-medium`), US English **LJ Speech** (`en_US-ljspeech-high`) and French **Siwis** (`fr_FR-siwis-medium`). They are different speakers, not a multilingual clone of Thorsten. In Settings, select **Piper · follow interface language** or an explicit voice, then use the existing sample button. Only a voice matching the current interface language is used. Missing, mismatched or failed local synthesis falls back to browser speech in the current language; browser quality and available languages depend on the computer. Reload the page after installing voices. The existing `_piper-thorsten` preference remains supported.

The independent branch retains upstream's French/English interface selection. German Piper output is implemented and tested, but selecting the full German interface requires the separate German translation contribution (#1). Installed model names and languages remain visible in the voice selector. No previous voice preference is overwritten automatically.

## Separate installation

A prepared offline Debian package uses the independent name `racehubos-piper-multilang`, directory `/opt/racehubos-piper-multilang` and CLI `racehubos-piper-multilang`. It can coexist with the old `racehubos-piper-thorsten` package and `/opt/racehubos-piper`. No maintainer scripts, startup service or installation-time audio/download is added. This binary package targets Linux Mint 22 / Ubuntu 24.04, amd64, Python 3.12; do not install it on another platform.

Alternatively, from a source checkout:

```sh
python3 scripts/piper/install.py --languages de,en,fr
```

The default is a **new** `~/.local/share/racehubos-piper-multilang` directory. Installation requires Python with venv/pip support and Internet access to PyPI/Hugging Face. The installer pins Piper 1.8.0, pins the model repository revision and verifies each model/config/model-card SHA256 before publishing the installation. Dependencies are supplied by pip. If venv/pip is unavailable, installation stops without changing any existing voice; no system package is installed by the script. A different destination can be specified with `--target /new/directory`; set `RACEHUBOS_PIPER_HOME=/new/directory` for RaceHubOS afterwards. Existing destinations are always refused, including upgrades. A failed installation removes only its newly created staging directory. Do not point it at an existing Thorsten installation.

For a prepared offline installation, `--runtime-from /existing/piper/home --model-cache /downloaded/models` copies an existing compatible Piper virtual environment **read-only** and uses the checksum-matching files. This is intended for the same OS, architecture and Python version. It does not modify, upgrade or remove the source. `build-deb.py --runtime-home /prepared/home --output /new/output` creates the Linux package without installing it.

The optional runtime includes a CLI for creating WAV files without automatically playing them:

```sh
python3 /new/directory/speak.py --language en --text "New best lap." --output /tmp/sample-en.wav
```

The output must not already exist. After installation, speech generation is offline. No speech text is sent to a cloud service. The browser requests WAV audio from its RaceHubOS backend. Model/runtime detection is read-only. Existing local and system Thorsten installations are still detected. Per-language detection allows a complete voice in a later installation to fill a language missing in an earlier one.

## Distribution and credits

Runtime: [Piper, GPL-3.0](https://github.com/OHF-Voice/piper1-gpl). Voice sources, fixed revisions, model cards and checksums are recorded in `scripts/piper/voices.json` and installed beside the models. Thorsten's dataset is CC0; LJ Speech's dataset is public domain; Siwis's dataset is CC-BY-4.0. Original model cards accompany each voice. Keep their attribution and the runtime/library licences when distributing packages. The thin RaceHubOS integration and packaging scripts remain part of this repository's Apache-2.0 code. Voice models/runtime binaries are not committed to this repository.

## Verification and limits

Tests cover read-only legacy detection, partial installs, language matching, explicit and automatic choices, browser fallback, completion callbacks, cancellation, stale responses, voice-specific caches, worker failure, queue limits, timeouts, invalid requests, cross-origin rejection and installation rollback/no-overwrite. Browser tests use controlled audio/speech responses and isolated `e2e.db`; they do not establish speaker playback quality. Real separate-runtime tests generate nonempty WAV files for all three languages. Human listening remains necessary to assess pronunciation, driver names and speaker quality. Runtime and Debian package validation is Linux-only; Windows/macOS packaging and playback are not claimed. No CU connection or race session is required.
