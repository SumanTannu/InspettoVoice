import base64

from .config import Config


class SpeechService:
    def transcribe(self, audio_bytes: bytes, language_code: str):
        if not Config.USE_GOOGLE_CLOUD:
            return "Pump motor normal. Capture evidence photo."

        from google.cloud import speech

        client = speech.SpeechClient()
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            language_code=language_code,
            enable_automatic_punctuation=True,
        )
        response = client.recognize(config=config, audio=audio)
        return " ".join(result.alternatives[0].transcript for result in response.results)


class TextToSpeechService:
    def synthesize(self, text: str, language_code: str):
        if not Config.USE_GOOGLE_CLOUD:
            return {"audioContent": "", "mock": True}

        from google.cloud import texttospeech

        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(language_code=language_code)
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        return {"audioContent": base64.b64encode(response.audio_content).decode("utf-8"), "mock": False}
