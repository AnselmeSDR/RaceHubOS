import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('piper_install', Path(__file__).with_name('install.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class InstallTests(unittest.TestCase):
    def test_existing_installation_is_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'Thorsten'
            target.mkdir()
            (target/'worker.py').write_text('keep')
            with self.assertRaises(ValueError):module.install(target,['de'])
            self.assertEqual((target/'worker.py').read_text(),'keep')
            self.assertEqual(list(target.iterdir()),[target/'worker.py'])
    def test_invalid_language_does_not_create_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'new'
            with self.assertRaises(ValueError):module.install(target,['es'])
            self.assertFalse(target.exists())
    def test_failed_runtime_copy_cleans_staging(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'new'
            with self.assertRaises(FileNotFoundError):module.install(target,['de'],Path(tmp)/'missing')
            self.assertFalse(target.exists())
            self.assertFalse(target.with_name('new.installing').exists())
    def test_bad_model_checksum_never_publishes_partial_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'cache').mkdir();(root/'cache/de_DE-thorsten-medium.onnx').write_bytes(b'bad')
            def copy(source,target,**kwargs):target.mkdir()
            with patch.object(module.shutil,'copytree',copy):
                with self.assertRaises(ValueError):module.install(root/'new',['de'],root/'runtime',root/'cache')
            self.assertFalse((root/'new').exists());self.assertFalse((root/'new.installing').exists())

if __name__ == '__main__':unittest.main()
