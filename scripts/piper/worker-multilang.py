#!/usr/bin/env python3
"""Optional Piper process. Explicit model, bounded JSON-lines requests, no network."""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import sys
import wave


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    args = parser.parse_args()
    from piper import PiperVoice, SynthesisConfig
    from piper.config import PiperConfig
    import onnxruntime
    model = Path(args.model).resolve()
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    voice = PiperVoice(session=onnxruntime.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider']), config=PiperConfig.from_dict(json.loads(Path(str(model) + '.json').read_text())))
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            text, rate = request.get('text'), request.get('rate', 0.95)
            if not isinstance(text, str) or not 1 <= len(text.strip()) <= 400 or not isinstance(rate, (float, int)) or not math.isfinite(rate) or not 0.8 <= rate <= 1.2:
                raise ValueError('Invalid speech request')
            data = io.BytesIO()
            with wave.open(data, 'wb') as wav:
                voice.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1 / rate))
            print(json.dumps({'id': request['id'], 'audio': base64.b64encode(data.getvalue()).decode()}), flush=True)
        except Exception:
            print(json.dumps({'id': request.get('id'), 'error': 'Synthesis failed'}), flush=True)


if __name__ == '__main__':
    main()
