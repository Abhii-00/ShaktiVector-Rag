import hashlib

from sentence_transformers import SentenceTransformer


class Embedder:
    _model = None
    _model_name = None

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._cache = {}

    def _load_model(self):
        if Embedder._model is None or Embedder._model_name != self.model_name:
            Embedder._model = SentenceTransformer(self.model_name)
            Embedder._model_name = self.model_name
        return Embedder._model

    def _cache_key(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    def encode(self, text: str):
        key = self._cache_key(text)
        if key in self._cache:
            return self._cache[key]

        model = self._load_model()
        vec = model.encode(text, normalize_embeddings=True).tolist()
        if len(self._cache) < 10000:
            self._cache[key] = vec
        return vec
